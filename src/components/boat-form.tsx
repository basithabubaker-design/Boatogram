"use client";

import { useActionState } from "react";
import { createBoatAction, updateBoatAction } from "@/app/actions/boats";

type Defaults = {
  name: string;
  description: string;
  type: "HOUSEBOAT" | "SHIKARA";
  location: string;
  capacity: number;
  bedrooms: number | null;
  amenities: string[];
  basePriceOvernight: number | null;
  basePriceHourly: number | null;
  minHours: number | null;
  images: { url: string }[];
};

export function BoatForm({ boatId, defaultValues }: { boatId?: string; defaultValues?: Defaults }) {
  const action = boatId ? updateBoatAction.bind(null, boatId) : createBoatAction;
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Boat type
        <select
          name="type"
          defaultValue={defaultValues?.type ?? "HOUSEBOAT"}
          disabled={Boolean(boatId)}
          className="rounded-md border border-zinc-300 px-3 py-2 disabled:bg-zinc-100"
        >
          <option value="HOUSEBOAT">Houseboat (overnight)</option>
          <option value="SHIKARA">Shikara (hourly)</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input name="name" required defaultValue={defaultValues?.name} className="rounded-md border border-zinc-300 px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Description
        <textarea
          name="description"
          required
          rows={4}
          defaultValue={defaultValues?.description}
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Location
        <input
          name="location"
          required
          defaultValue={defaultValues?.location}
          placeholder="Alleppey, Kerala"
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Capacity (guests)
          <input
            name="capacity"
            type="number"
            min={1}
            required
            defaultValue={defaultValues?.capacity}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Bedrooms
          <input
            name="bedrooms"
            type="number"
            min={0}
            defaultValue={defaultValues?.bedrooms ?? undefined}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Overnight price (₹/night)
          <input
            name="basePriceOvernightRupees"
            type="number"
            min={0}
            defaultValue={defaultValues?.basePriceOvernight ? defaultValues.basePriceOvernight / 100 : undefined}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Hourly price (₹/hour)
          <input
            name="basePriceHourlyRupees"
            type="number"
            min={0}
            defaultValue={defaultValues?.basePriceHourly ? defaultValues.basePriceHourly / 100 : undefined}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Minimum hours (Shikara only)
        <input
          name="minHours"
          type="number"
          min={1}
          defaultValue={defaultValues?.minHours ?? 1}
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Amenities (comma-separated)
        <input
          name="amenities"
          defaultValue={defaultValues?.amenities.join(", ")}
          placeholder="AC, Kitchen, Sundeck"
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Photo URLs (comma-separated)
        <textarea
          name="imageUrls"
          defaultValue={defaultValues?.images.map((i) => i.url).join(", ")}
          placeholder="https://..."
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
      >
        {pending ? "Saving..." : boatId ? "Save changes" : "Submit for approval"}
      </button>
      {boatId && <p className="text-xs text-zinc-500">Saving changes sends this listing back for admin re-approval.</p>}
    </form>
  );
}
