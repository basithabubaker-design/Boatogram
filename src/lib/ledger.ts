import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/** Records the owner-earning and platform-commission ledger entries for a
 * booking once its payment has been captured. Call inside the same
 * transaction that marks the booking/payment as PAID. */
export async function recordBookingLedgerEntries(
  tx: Tx,
  booking: { id: string; boatId: string; ownerAmount: number; platformFeeAmount: number },
  ownerId: string,
) {
  await tx.ledgerEntry.createMany({
    data: [
      {
        type: "OWNER_EARNING",
        amount: booking.ownerAmount,
        description: `Owner earning for booking ${booking.id}`,
        bookingId: booking.id,
        ownerId,
      },
      {
        type: "PLATFORM_COMMISSION",
        amount: booking.platformFeeAmount,
        description: `Platform commission for booking ${booking.id}`,
        bookingId: booking.id,
        ownerId: null,
      },
    ],
  });
}

/** Records debit entries reversing the proportional owner/platform split of
 * a refunded amount, using the same split ratio the original booking's
 * payment was captured at (so a partial refund debits each side
 * proportionally to what they were originally credited). */
export async function recordRefundLedgerEntries(
  tx: Tx,
  booking: { id: string; subtotalAmount: number; platformFeeAmount: number },
  ownerId: string,
  refundAmount: number,
) {
  const platformFeeAmount =
    booking.subtotalAmount === 0
      ? 0
      : Math.round((refundAmount * booking.platformFeeAmount) / booking.subtotalAmount);
  const ownerAmount = refundAmount - platformFeeAmount;

  await tx.ledgerEntry.createMany({
    data: [
      {
        type: "REFUND_DEBIT_OWNER",
        amount: -ownerAmount,
        description: `Refund debit (owner share) for booking ${booking.id}`,
        bookingId: booking.id,
        ownerId,
      },
      {
        type: "REFUND_DEBIT_PLATFORM",
        amount: -platformFeeAmount,
        description: `Refund debit (platform share) for booking ${booking.id}`,
        bookingId: booking.id,
        ownerId: null,
      },
    ],
  });
}
