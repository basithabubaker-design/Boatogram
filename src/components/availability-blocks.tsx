"use client";

import { useActionState, useTransition } from "react";
import { addAvailabilityBlockAction, removeAvailabilityBlockAction } from "@/app/actions/boats";

type Block = { id: string; startAt: Date; endAt: Date; reason: string | null };

export function AvailabilityBlocks({ boatId, blocks }: { boatId: string; blocks: Block[] }) {
  const addAction = addAvailabilityBlockAction.bind(null, boatId);
  const [state, formAction, pending] = useActionState(addAction, undefined);
  const [removing, startRemoving] = useTransition();

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
      <h2 className="font-medium text-zinc-900">Blocked / maintenance dates</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {blocks.map((block) => (
          <li key={block.id} className="flex items-center justify-between text-sm">
            <span>
              {new Date(block.startAt).toLocaleDateString("en-IN")} –{" "}
              {new Date(block.endAt).toLocaleDateString("en-IN")}
              {block.reason ? ` (${block.reason})` : ""}
            </span>
            <button
              disabled={removing}
              onClick={() => startRemoving(() => removeAvailabilityBlockAction(boatId, block.id))}
              className="text-red-600 hover:underline"
            >
              Remove
            </button>
          </li>
        ))}
        {blocks.length === 0 && <li className="text-sm text-zinc-500">No blocked dates.</li>}
      </ul>

      <form action={formAction} className="mt-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          From
          <input type="date" name="startAt" required className="rounded-md border border-zinc-300 px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          To
          <input type="date" name="endAt" required className="rounded-md border border-zinc-300 px-2 py-1" />
        </label>
        <input name="reason" placeholder="Reason (optional)" className="rounded-md border border-zinc-300 px-2 py-1 text-sm" />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-60"
        >
          Add block
        </button>
      </form>
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
    </div>
  );
}
