"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/actions/admin";

export function ReviewDecisionForm({
  action,
  idField,
  idValue,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  idField: string;
  idValue: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-2 border-t border-zinc-100 pt-3">
      <input type="hidden" name={idField} value={idValue} />
      <textarea
        name="rejectionReason"
        placeholder="Reason if rejecting (optional for approval)"
        className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          name="decision"
          value="APPROVED"
          disabled={pending}
          className="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
        >
          Approve
        </button>
        <button
          type="submit"
          name="decision"
          value="REJECTED"
          disabled={pending}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          Reject
        </button>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-teal-700">Saved.</p>}
    </form>
  );
}
