"use client";

import { useActionState, useState } from "react";
import { updateCancellationPolicyAction } from "@/app/actions/admin";

type Tier = { minDaysBefore: number; refundPercent: number };

export function CancellationPolicyForm({ tiers }: { tiers: Tier[] }) {
  const [rows, setRows] = useState<Tier[]>(tiers);
  const [state, formAction, pending] = useActionState(updateCancellationPolicyAction, undefined);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
      <p className="text-sm text-zinc-600">
        A cancellation at least <em>N</em> days before check-in refunds the paired percentage of the total
        paid. The highest matching tier applies.
      </p>
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            ≥
            <input
              type="number"
              name="minDaysBefore"
              min={0}
              value={row.minDaysBefore}
              onChange={(e) =>
                setRows((r) => r.map((t, idx) => (idx === i ? { ...t, minDaysBefore: Number(e.target.value) } : t)))
              }
              className="w-20 rounded-md border border-zinc-300 px-2 py-1"
            />
            days before →
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="number"
              name="refundPercent"
              min={0}
              max={100}
              value={row.refundPercent}
              onChange={(e) =>
                setRows((r) => r.map((t, idx) => (idx === i ? { ...t, refundPercent: Number(e.target.value) } : t)))
              }
              className="w-20 rounded-md border border-zinc-300 px-2 py-1"
            />
            % refund
          </label>
          <button
            type="button"
            onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}
            className="text-sm text-red-600 hover:underline"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((r) => [...r, { minDaysBefore: 0, refundPercent: 0 }])}
        className="self-start text-sm text-teal-700 hover:underline"
      >
        + Add tier
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-teal-700">Policy updated.</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save policy"}
      </button>
    </form>
  );
}
