"use client";

import { useActionState } from "react";
import { submitKycAction } from "@/app/actions/kyc";

type Defaults = {
  businessName: string;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  panNumber: string | null;
  documents: { url: string }[];
};

export function KycForm({ defaultValues }: { defaultValues?: Defaults }) {
  const [state, formAction, pending] = useActionState(submitKycAction, undefined);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Business name
        <input
          name="businessName"
          required
          defaultValue={defaultValues?.businessName}
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Bank account holder name
        <input
          name="bankAccountName"
          required
          defaultValue={defaultValues?.bankAccountName ?? ""}
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Bank account number
        <input
          name="bankAccountNumber"
          required
          defaultValue={defaultValues?.bankAccountNumber ?? ""}
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        IFSC code
        <input
          name="bankIfsc"
          required
          defaultValue={defaultValues?.bankIfsc ?? ""}
          className="rounded-md border border-zinc-300 px-3 py-2 uppercase"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        PAN number
        <input
          name="panNumber"
          required
          defaultValue={defaultValues?.panNumber ?? ""}
          className="rounded-md border border-zinc-300 px-3 py-2 uppercase"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Document URLs (comma-separated links to ID/address proof)
        <textarea
          name="documentUrls"
          required
          defaultValue={defaultValues?.documents.map((d) => d.url).join(", ")}
          placeholder="https://..."
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-teal-700">Submitted for review.</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
      >
        {pending ? "Submitting..." : "Submit for review"}
      </button>
    </form>
  );
}
