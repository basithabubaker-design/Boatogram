"use client";

import { useActionState } from "react";
import { cancelBookingAction } from "@/app/actions/bookings";

export function CancelBookingForm({ bookingId, refundPreview }: { bookingId: string; refundPreview: string }) {
  const [state, formAction, pending] = useActionState(cancelBookingAction, undefined);

  if (state?.success) {
    return <p className="text-sm text-teal-700">Booking cancelled.</p>;
  }

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <p className="text-sm text-zinc-700">{refundPreview}</p>
      <textarea
        name="reason"
        placeholder="Reason for cancellation (optional)"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "Cancelling..." : "Cancel booking"}
      </button>
    </form>
  );
}
