import { NextRequest, NextResponse } from "next/server";
import { processRazorpayWebhook, WebhookSignatureError } from "@/lib/services/webhook-service";

// Razorpay webhooks must be verified against the exact raw request body, so
// this route reads req.text() rather than req.json() before anything else
// touches the body.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-razorpay-signature");
  const eventIdHeader = request.headers.get("x-razorpay-event-id");

  try {
    const result = await processRazorpayWebhook({ rawBody, signatureHeader, eventIdHeader });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof WebhookSignatureError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    console.error("[webhooks/razorpay] processing failed:", error);
    // Returning 500 makes Razorpay retry the delivery; our idempotency key
    // guarantees a retry is safe even if part of the previous attempt
    // already committed.
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
