"use client";

import { useTransition } from "react";
import { toggleBoatActiveAction } from "@/app/actions/boats";

export function ToggleBoatButton({ boatId, isActive }: { boatId: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => toggleBoatActiveAction(boatId, !isActive))}
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
    >
      {isActive ? "Hide listing" : "Show listing"}
    </button>
  );
}
