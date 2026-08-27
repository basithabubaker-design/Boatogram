import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  CONFIRMED: "Confirmed",
  CANCELLED_BY_CUSTOMER: "Cancelled",
  CANCELLED_BY_OWNER: "Cancelled by owner",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
};

export default async function DashboardPage() {
  const user = await requireRole("CUSTOMER");
  const bookings = await prisma.booking.findMany({
    where: { customerId: user.id },
    include: { boat: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900">My bookings</h1>

      <div className="mt-6 flex flex-col gap-3">
        {bookings.map((booking) => (
          <Link
            key={booking.id}
            href={`/dashboard/bookings/${booking.id}`}
            className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 hover:shadow-md"
          >
            <div>
              <p className="font-medium text-zinc-900">{booking.boat.name}</p>
              <p className="text-sm text-zinc-500">
                {booking.bookingNumber} · {new Date(booking.startAt).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium">{rupees(booking.totalAmount)}</p>
              <p className="text-sm text-zinc-500">{STATUS_LABEL[booking.status] ?? booking.status}</p>
            </div>
          </Link>
        ))}
        {bookings.length === 0 && <p className="text-zinc-500">You haven&apos;t booked any boats yet.</p>}
      </div>
    </main>
  );
}
