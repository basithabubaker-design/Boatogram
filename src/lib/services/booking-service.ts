import "server-only";
import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getPaymentProvider } from "@/lib/payments";
import { calculateBookingPrice } from "@/lib/booking/pricing";
import { isRangeAvailable, nightsBetween, hoursBetween } from "@/lib/booking/availability";
import { calculateRefund } from "@/lib/booking/cancellation";
import { getEffectivePolicyForBoat } from "@/lib/services/cancellation-policy";
import { recordBookingLedgerEntries, recordRefundLedgerEntries } from "@/lib/ledger";
import { notify } from "@/lib/notifications/notify";
import type { CreateBookingInput } from "@/lib/validation/booking";

export class BookingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

const bookingNumberId = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

/** Bookings pending payment for longer than this are treated as expired and
 * no longer block availability for other customers. */
const PENDING_HOLD_MINUTES = 20;

function pendingHoldCutoff() {
  return new Date(Date.now() - PENDING_HOLD_MINUTES * 60 * 1000);
}

export async function createBooking(customerId: string, input: CreateBookingInput) {
  const boat = await prisma.boat.findUnique({ where: { id: input.boatId } });
  if (!boat || boat.status !== "APPROVED" || !boat.isActive) {
    throw new BookingError("This boat is not available for booking", "BOAT_UNAVAILABLE");
  }

  const expectedType = boat.type === "HOUSEBOAT" ? "OVERNIGHT" : "SHIKARA_HOURLY";
  if (input.bookingType !== expectedType) {
    throw new BookingError("Booking type does not match boat type", "TYPE_MISMATCH");
  }
  if (input.guests > boat.capacity) {
    throw new BookingError(`This boat can host at most ${boat.capacity} guests`, "OVER_CAPACITY");
  }

  let units: number;
  let unitPrice: number;
  if (input.bookingType === "OVERNIGHT") {
    units = nightsBetween(input.startAt, input.endAt);
    if (!boat.basePriceOvernight) {
      throw new BookingError("This boat has no overnight pricing configured", "NO_PRICE");
    }
    unitPrice = boat.basePriceOvernight;
  } else {
    units = hoursBetween(input.startAt, input.endAt);
    const minHours = boat.minHours ?? 1;
    if (units < minHours) {
      throw new BookingError(`Minimum booking is ${minHours} hour(s)`, "BELOW_MIN_HOURS");
    }
    if (!boat.basePriceHourly) {
      throw new BookingError("This boat has no hourly pricing configured", "NO_PRICE");
    }
    unitPrice = boat.basePriceHourly;
  }

  const price = calculateBookingPrice({
    unitPrice,
    units,
    commissionPercent: config.platform.commissionPercent,
  });

  const paymentProvider = getPaymentProvider();
  if (!paymentProvider.isConfigured) {
    throw new BookingError(
      "Payments are not configured on this deployment yet. Set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.",
      "PAYMENTS_NOT_CONFIGURED",
    );
  }

  const booking = await prisma.$transaction(async (tx) => {
    // Lock the boat row so two concurrent booking attempts for overlapping
    // dates are serialized rather than both passing the availability check.
    await tx.$queryRaw`SELECT id FROM "Boat" WHERE id = ${boat.id} FOR UPDATE`;

    const [activeBookings, blocks] = await Promise.all([
      tx.booking.findMany({
        where: {
          boatId: boat.id,
          OR: [
            { status: "CONFIRMED" },
            { status: "PENDING_PAYMENT", createdAt: { gte: pendingHoldCutoff() } },
          ],
        },
        select: { startAt: true, endAt: true },
      }),
      tx.availabilityBlock.findMany({
        where: { boatId: boat.id },
        select: { startAt: true, endAt: true },
      }),
    ]);

    const occupied = [...activeBookings, ...blocks];
    if (!isRangeAvailable({ startAt: input.startAt, endAt: input.endAt }, occupied)) {
      throw new BookingError("This boat is already booked for the selected time", "SLOT_TAKEN");
    }

    return tx.booking.create({
      data: {
        bookingNumber: `BTG-${bookingNumberId()}`,
        customerId,
        boatId: boat.id,
        bookingType: input.bookingType,
        startAt: input.startAt,
        endAt: input.endAt,
        guests: input.guests,
        unitPrice: price.unitPrice,
        units: price.units,
        subtotalAmount: price.subtotalAmount,
        platformFeeAmount: price.platformFeeAmount,
        ownerAmount: price.ownerAmount,
        totalAmount: price.totalAmount,
      },
    });
  });

  const order = await paymentProvider.createOrder({
    amountPaise: booking.totalAmount,
    currency: booking.currency,
    receipt: booking.bookingNumber,
    notes: { bookingId: booking.id },
  });

  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id,
      providerOrderId: order.orderId,
      amount: order.amountPaise,
      currency: order.currency,
      rawPayload: order.raw as never,
    },
  });

  return { booking, payment, order };
}

/**
 * Marks a booking's payment as captured, idempotently. Safe to call from
 * both the client-side checkout success callback and the async webhook —
 * whichever arrives first does the work, the other is a no-op.
 */
export async function markPaymentCaptured(params: {
  providerOrderId: string;
  providerPaymentId: string;
  providerSignature: string | null;
  rawPayload?: unknown;
}) {
  const payment = await prisma.payment.findUnique({
    where: { providerOrderId: params.providerOrderId },
    include: { booking: { include: { boat: true } } },
  });
  if (!payment) {
    throw new BookingError("No payment found for this order", "PAYMENT_NOT_FOUND");
  }

  if (payment.status === "PAID") {
    return { payment, alreadyProcessed: true as const };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const freshPayment = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
    if (freshPayment.status === "PAID") return freshPayment;

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        providerPaymentId: params.providerPaymentId,
        providerSignature: params.providerSignature ?? undefined,
        rawPayload: (params.rawPayload as never) ?? undefined,
      },
    });

    const booking = await tx.booking.update({
      where: { id: payment.bookingId },
      data: { status: "CONFIRMED", paymentStatus: "PAID" },
    });

    await recordBookingLedgerEntries(
      tx,
      {
        id: booking.id,
        boatId: booking.boatId,
        ownerAmount: booking.ownerAmount,
        platformFeeAmount: booking.platformFeeAmount,
      },
      payment.booking.boat.ownerId,
    );

    return tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
  });

  // Route transfer to the owner's linked account is attempted best-effort
  // after the payment/booking state is durably committed: a transfer
  // failure (e.g. owner not yet onboarded on Razorpay) must not roll back
  // an already-captured payment. Admins can see/retry failed splits from
  // the ledger dashboard.
  await attemptOwnerTransfer(payment.id);

  const customer = await prisma.user.findUnique({ where: { id: payment.booking.customerId } });
  if (customer) {
    await notify({
      userId: customer.id,
      type: "BOOKING_CONFIRMED",
      title: "Booking confirmed",
      body: `Your booking ${payment.booking.bookingNumber} for ${payment.booking.boat.name} is confirmed.`,
      email: customer.email,
      meta: { bookingId: payment.booking.id },
    });
  }

  return { payment: updated, alreadyProcessed: false as const };
}

async function attemptOwnerTransfer(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: { include: { boat: { include: { owner: true } } } }, splits: true },
  });
  if (!payment || payment.splits.length > 0) return;

  const owner = payment.booking.boat.owner;
  const split = await prisma.paymentSplit.create({
    data: {
      paymentId: payment.id,
      ownerId: owner.id,
      platformAmount: payment.booking.platformFeeAmount,
      ownerAmount: payment.booking.ownerAmount,
      status: "PENDING",
    },
  });

  if (!owner.razorpayAccountId) {
    await prisma.paymentSplit.update({
      where: { id: split.id },
      data: { status: "FAILED", failureReason: "Owner has no linked Razorpay account yet" },
    });
    return;
  }

  try {
    const transfer = await getPaymentProvider().createTransfer({
      paymentId: payment.providerPaymentId ?? "",
      ownerAccountId: owner.razorpayAccountId,
      amountPaise: payment.booking.ownerAmount,
      currency: payment.currency,
      notes: { bookingId: payment.bookingId },
    });
    await prisma.paymentSplit.update({
      where: { id: split.id },
      data: { status: "TRANSFERRED", providerTransferId: transfer.transferId },
    });
  } catch (error) {
    await prisma.paymentSplit.update({
      where: { id: split.id },
      data: { status: "FAILED", failureReason: error instanceof Error ? error.message : "Unknown error" },
    });
  }
}

export async function cancelBooking(params: {
  bookingId: string;
  actingUserId: string;
  actingRole: "CUSTOMER" | "OWNER" | "ADMIN";
  reason?: string;
}) {
  const booking = await prisma.booking.findUnique({
    where: { id: params.bookingId },
    include: { boat: { include: { owner: true } }, payments: true },
  });
  if (!booking) throw new BookingError("Booking not found", "NOT_FOUND");

  const isOwnerOfBoat = booking.boat.owner.userId === params.actingUserId;
  const isCustomer = booking.customerId === params.actingUserId;
  if (params.actingRole !== "ADMIN" && !isOwnerOfBoat && !isCustomer) {
    throw new BookingError("Not authorized to cancel this booking", "FORBIDDEN");
  }

  if (booking.status !== "CONFIRMED" && booking.status !== "PENDING_PAYMENT") {
    throw new BookingError("This booking can no longer be cancelled", "NOT_CANCELLABLE");
  }

  const cancelledByStatus = isCustomer && params.actingRole !== "ADMIN" ? "CANCELLED_BY_CUSTOMER" : "CANCELLED_BY_OWNER";

  if (booking.status === "PENDING_PAYMENT" || booking.paymentStatus !== "PAID") {
    return prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: cancelledByStatus,
        cancelledAt: new Date(),
        cancelledBy: params.actingUserId,
        cancellationReason: params.reason,
        refundPercent: 0,
        refundAmount: 0,
      },
    });
  }

  const policy = await getEffectivePolicyForBoat(booking.boatId);
  const refund = calculateRefund(policy.tiers, booking.totalAmount, new Date(), booking.startAt);

  const paidPayment = booking.payments.find((p) => p.status === "PAID");

  const updatedBooking = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: cancelledByStatus,
        cancelledAt: new Date(),
        cancelledBy: params.actingUserId,
        cancellationReason: params.reason,
        refundPercent: refund.refundPercent,
        refundAmount: refund.refundAmount,
        paymentStatus:
          refund.refundAmount === 0
            ? booking.paymentStatus
            : refund.refundAmount >= booking.totalAmount
              ? "REFUNDED"
              : "PARTIALLY_REFUNDED",
      },
    });

    if (refund.refundAmount > 0 && paidPayment) {
      await tx.refundRecord.create({
        data: {
          bookingId: booking.id,
          paymentId: paidPayment.id,
          amount: refund.refundAmount,
          reason: params.reason,
          policyRefundPercent: refund.refundPercent,
          daysBeforeCheckin: refund.daysBeforeCheckin,
          status: "PENDING",
        },
      });

      await recordRefundLedgerEntries(
        tx,
        {
          id: booking.id,
          subtotalAmount: booking.subtotalAmount,
          platformFeeAmount: booking.platformFeeAmount,
        },
        booking.boat.ownerId,
        refund.refundAmount,
      );
    }

    return cancelled;
  });

  if (refund.refundAmount > 0 && paidPayment) {
    await processRefund(booking.id, paidPayment.id, paidPayment.providerPaymentId, refund.refundAmount);
  }

  const [customer, ownerUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: booking.customerId } }),
    prisma.user.findUnique({ where: { id: booking.boat.owner.userId } }),
  ]);
  if (customer) {
    await notify({
      userId: customer.id,
      type: "BOOKING_CANCELLED",
      title: "Booking cancelled",
      body: `Your booking ${booking.bookingNumber} was cancelled. Refund: ${refund.refundPercent}% (₹${(refund.refundAmount / 100).toFixed(2)}).`,
      email: customer.email,
      meta: { bookingId: booking.id },
    });
  }
  if (ownerUser) {
    await notify({
      userId: ownerUser.id,
      type: "BOOKING_CANCELLED",
      title: "A booking was cancelled",
      body: `Booking ${booking.bookingNumber} for ${booking.boat.name} was cancelled.`,
      email: ownerUser.email,
      meta: { bookingId: booking.id },
    });
  }

  return updatedBooking;
}

async function processRefund(
  bookingId: string,
  paymentId: string,
  providerPaymentId: string | null,
  amount: number,
) {
  const refundRecord = await prisma.refundRecord.findFirst({
    where: { bookingId, paymentId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  if (!refundRecord || !providerPaymentId) return;

  try {
    const refund = await getPaymentProvider().createRefund({
      paymentId: providerPaymentId,
      amountPaise: amount,
      notes: { bookingId },
    });
    await prisma.refundRecord.update({
      where: { id: refundRecord.id },
      data: { status: "PROCESSED", providerRefundId: refund.refundId },
    });
  } catch (error) {
    await prisma.refundRecord.update({
      where: { id: refundRecord.id },
      data: {
        status: "FAILED",
        failureReason: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}
