import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments";
import { markPaymentCaptured, BookingError } from "@/lib/services/booking-service";

const bodySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

/**
 * Called by the client immediately after Razorpay Checkout reports success.
 * This gives the customer an instant confirmation without waiting for the
 * async webhook, but it is not the only path to CONFIRMED: the webhook
 * handler performs the same idempotent markPaymentCaptured call and is the
 * source of truth if this request never arrives (tab closed, network drop).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: bookingId } = await params;

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.customerId !== user.id) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  const provider = getPaymentProvider();
  const validSignature = provider.verifyCheckoutSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });
  if (!validSignature) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  try {
    await markPaymentCaptured({
      providerOrderId: razorpay_order_id,
      providerPaymentId: razorpay_payment_id,
      providerSignature: razorpay_signature,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BookingError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
