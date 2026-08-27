"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import Link from "next/link";
import { createBookingAction } from "@/app/actions/bookings";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function rupees(paise: number | null) {
  if (paise == null) return "—";
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export function BookingForm(props: {
  boatId: string;
  boatType: "HOUSEBOAT" | "SHIKARA";
  capacity: number;
  minHours: number;
  priceOvernight: number | null;
  priceHourly: number | null;
  isLoggedIn: boolean;
  isCustomer: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [hours, setHours] = useState(props.minHours);
  const [guests, setGuests] = useState(Math.min(4, props.capacity));
  const [minCheckinDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [minShikaraDate] = useState(() => new Date().toISOString().slice(0, 10));

  const isOvernight = props.boatType === "HOUSEBOAT";
  const estimatedTotal = isOvernight
    ? props.priceOvernight && date && endDate
      ? props.priceOvernight * Math.max(1, Math.round((+new Date(endDate) - +new Date(date)) / 86400000))
      : null
    : props.priceHourly
      ? props.priceHourly * hours
      : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const startAt = isOvernight ? new Date(`${date}T14:00:00`) : new Date(`${date}T${startTime}:00`);
    const endAt = isOvernight
      ? new Date(`${endDate}T11:00:00`)
      : new Date(startAt.getTime() + hours * 60 * 60 * 1000);

    startTransition(async () => {
      const result = await createBookingAction({
        boatId: props.boatId,
        bookingType: isOvernight ? "OVERNIGHT" : "SHIKARA_HOURLY",
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        guests,
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      if (!window.Razorpay) {
        setError("Payment gateway is still loading, please try again in a moment.");
        return;
      }

      const razorpay = new window.Razorpay({
        key: result.keyId,
        amount: result.amount,
        currency: result.currency,
        name: "Boatogram",
        description: `Booking ${result.bookingNumber}`,
        order_id: result.orderId,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verifyRes = await fetch(`/api/bookings/${result.bookingId}/verify-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          if (verifyRes.ok) {
            router.push(`/dashboard/bookings/${result.bookingId}`);
          } else {
            setError("Payment succeeded but confirmation failed — check My Bookings shortly.");
          }
        },
        modal: { ondismiss: () => setError("Payment was cancelled.") },
      });
      razorpay.open();
    });
  }

  if (!props.isLoggedIn) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
        <p className="text-sm text-zinc-600">
          <Link href="/login" className="text-teal-700 hover:underline">
            Log in
          </Link>{" "}
          to book this boat.
        </p>
      </div>
    );
  }

  if (!props.isCustomer) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 text-sm text-zinc-600">
        Only customer accounts can make bookings.
      </div>
    );
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
        <p className="text-lg font-semibold text-zinc-900">
          {isOvernight ? `${rupees(props.priceOvernight)} / night` : `${rupees(props.priceHourly)} / hour`}
        </p>

        {isOvernight ? (
          <>
            <label className="flex flex-col gap-1 text-sm">
              Check-in
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={minCheckinDate}
                className="rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Check-out
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={date || undefined}
                className="rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm">
              Date
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={minShikaraDate}
                className="rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Start time
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Duration (hours)
              <input
                type="number"
                min={props.minHours}
                required
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
          </>
        )}

        <label className="flex flex-col gap-1 text-sm">
          Guests
          <input
            type="number"
            min={1}
            max={props.capacity}
            required
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>

        {estimatedTotal != null && (
          <p className="text-sm text-zinc-600">Estimated total: {rupees(estimatedTotal)}</p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {pending ? "Processing..." : "Book & pay"}
        </button>
      </form>
    </>
  );
}
