import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getEffectivePolicyForBoat } from "@/lib/services/cancellation-policy";
import { calculateRefund } from "@/lib/booking/cancellation";
import { CancelBookingForm } from "@/components/cancel-booking-form";

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { boat: { include: { owner: true } }, refunds: true },
  });

  if (!booking) notFound();
  const isOwner = booking.boat.owner.userId === user.id;
  if (booking.customerId !== user.id && !isOwner && user.role !== "ADMIN") {
    notFound();
  }

  const canCancel = booking.status === "CONFIRMED" || booking.status === "PENDING_PAYMENT";

  let refundPreview = "This booking has not been paid for yet — cancelling has no charge.";
  if (canCancel && booking.paymentStatus === "PAID") {
    const policy = await getEffectivePolicyForBoat(booking.boatId);
    const refund = calculateRefund(policy.tiers, booking.totalAmount, new Date(), booking.startAt);
    refundPreview = `Cancelling now refunds ${refund.refundPercent}% (${rupees(refund.refundAmount)}) based on the cancellation policy.`;
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <p className="text-sm text-zinc-500">{booking.bookingNumber}</p>
      <h1 className="text-2xl font-semibold text-zinc-900">{booking.boat.name}</h1>

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 text-sm">
        <div>
          <dt className="text-zinc-500">Status</dt>
          <dd className="font-medium">{booking.status}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Payment</dt>
          <dd className="font-medium">{booking.paymentStatus}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Start</dt>
          <dd className="font-medium">{new Date(booking.startAt).toLocaleString("en-IN")}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">End</dt>
          <dd className="font-medium">{new Date(booking.endAt).toLocaleString("en-IN")}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Guests</dt>
          <dd className="font-medium">{booking.guests}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Total paid</dt>
          <dd className="font-medium">{rupees(booking.totalAmount)}</dd>
        </div>
        {booking.status.startsWith("CANCELLED") && (
          <div className="col-span-2">
            <dt className="text-zinc-500">Refund</dt>
            <dd className="font-medium">
              {booking.refundPercent}% — {rupees(booking.refundAmount ?? 0)}
            </dd>
          </div>
        )}
      </dl>

      {canCancel && (booking.customerId === user.id || isOwner || user.role === "ADMIN") && (
        <CancelBookingForm bookingId={booking.id} refundPreview={refundPreview} />
      )}
    </main>
  );
}
