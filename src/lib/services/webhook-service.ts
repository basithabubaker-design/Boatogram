import "server-only";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments";
import { markPaymentCaptured } from "@/lib/services/booking-service";

export class WebhookSignatureError extends Error {}

type RazorpayWebhookBody = {
  event: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; status?: string } };
    refund?: { entity?: { id?: string; payment_id?: string; status?: string; amount?: number } };
  };
};

/**
 * Processes an incoming Razorpay webhook request idempotently.
 *
 * Idempotency key: Razorpay sends `x-razorpay-event-id` on every webhook
 * delivery (including retries of the same event), so that header is the
 * primary key. If it's ever absent, we fall back to a deterministic key
 * derived from the event type + the underlying payment/refund id, which is
 * still stable across retries of the same underlying event.
 */
export async function processRazorpayWebhook(params: {
  rawBody: string;
  signatureHeader: string | null;
  eventIdHeader: string | null;
}) {
  const provider = getPaymentProvider();
  if (!params.signatureHeader) {
    throw new WebhookSignatureError("Missing X-Razorpay-Signature header");
  }
  if (!provider.verifyWebhookSignature(params.rawBody, params.signatureHeader)) {
    throw new WebhookSignatureError("Invalid webhook signature");
  }

  const body = JSON.parse(params.rawBody) as RazorpayWebhookBody;
  const fallbackEntityId =
    body.payload?.payment?.entity?.id ?? body.payload?.refund?.entity?.id ?? "unknown";
  const eventId = params.eventIdHeader ?? `${body.event}:${fallbackEntityId}`;

  const existing = await prisma.webhookEvent.findUnique({ where: { eventId } });
  if (existing && existing.status === "PROCESSED") {
    return { status: "duplicate" as const, eventId };
  }

  // A row already exists but never finished processing (a prior attempt
  // crashed mid-flight) — reuse it and retry rather than skipping. The
  // downstream handlers (markPaymentCaptured, etc.) are themselves
  // idempotent, so re-running a partially-applied event is safe.
  const record =
    existing ??
    (await prisma.webhookEvent.create({
      data: {
        eventId,
        eventType: body.event,
        payload: JSON.parse(params.rawBody),
        status: "RECEIVED",
      },
    }));

  try {
    await handleEvent(body);
    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
    return { status: "processed" as const, eventId };
  } catch (error) {
    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}

async function handleEvent(body: RazorpayWebhookBody) {
  switch (body.event) {
    case "payment.captured": {
      const entity = body.payload?.payment?.entity;
      if (!entity?.id || !entity.order_id) return;
      await markPaymentCaptured({
        providerOrderId: entity.order_id,
        providerPaymentId: entity.id,
        providerSignature: null,
        rawPayload: body,
      });
      return;
    }
    case "payment.failed": {
      const entity = body.payload?.payment?.entity;
      if (!entity?.order_id) return;
      await prisma.payment.updateMany({
        where: { providerOrderId: entity.order_id, status: { not: "PAID" } },
        data: { status: "FAILED" },
      });
      return;
    }
    case "refund.processed": {
      const entity = body.payload?.refund?.entity;
      if (!entity?.id) return;
      await prisma.refundRecord.updateMany({
        where: { providerRefundId: entity.id },
        data: { status: "PROCESSED" },
      });
      return;
    }
    default:
      return;
  }
}
