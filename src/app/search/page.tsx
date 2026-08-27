import Link from "next/link";
import { searchSchema } from "@/lib/validation/boat";
import { searchBoats } from "@/lib/services/search-service";

function rupees(paise: number | null) {
  if (paise == null) return "—";
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = searchSchema.safeParse({
    type: raw.type || undefined,
    location: raw.location || undefined,
    minCapacity: raw.minCapacity || undefined,
    maxPriceRupees: raw.maxPriceRupees || undefined,
    startAt: raw.startAt || undefined,
    endAt: raw.endAt || undefined,
    sort: raw.sort || undefined,
    page: raw.page || undefined,
  });
  const input = parsed.success ? parsed.data : searchSchema.parse({});

  const { boats, total, pageSize, page } = await searchBoats(input);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900">Browse boats</h1>

      <form className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 sm:grid-cols-3 lg:grid-cols-6">
        <input
          name="location"
          defaultValue={input.location}
          placeholder="Location"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <select name="type" defaultValue={input.type ?? ""} className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
          <option value="">Any type</option>
          <option value="HOUSEBOAT">Houseboat</option>
          <option value="SHIKARA">Shikara</option>
        </select>
        <input
          name="minCapacity"
          type="number"
          min={1}
          defaultValue={input.minCapacity}
          placeholder="Min guests"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <input
          name="maxPriceRupees"
          type="number"
          min={0}
          defaultValue={input.maxPriceRupees}
          placeholder="Max price ₹"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <input
          name="startAt"
          type="date"
          defaultValue={raw.startAt as string | undefined}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <select name="sort" defaultValue={input.sort} className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="capacity_desc">Capacity</option>
        </select>
        <button className="col-span-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 sm:col-span-1 lg:col-span-6">
          Apply filters
        </button>
      </form>

      <p className="mt-4 text-sm text-zinc-500">{total} boat{total === 1 ? "" : "s"} found</p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {boats.map((boat) => (
          <Link
            key={boat.id}
            href={`/boats/${boat.id}`}
            className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200 transition hover:shadow-md"
          >
            <div className="h-40 w-full bg-zinc-100">
              {boat.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={boat.images[0].url} alt={boat.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-400">No photo</div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-4">
              <span className="text-xs font-medium uppercase tracking-wide text-teal-700">
                {boat.type === "HOUSEBOAT" ? "Houseboat" : "Shikara"}
              </span>
              <h2 className="font-semibold text-zinc-900">{boat.name}</h2>
              <p className="text-sm text-zinc-500">{boat.location} · up to {boat.capacity} guests</p>
              <p className="mt-auto pt-2 font-medium text-zinc-900">
                {boat.type === "HOUSEBOAT"
                  ? `${rupees(boat.basePriceOvernight)} / night`
                  : `${rupees(boat.basePriceHourly)} / hour`}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {boats.length === 0 && (
        <p className="mt-12 text-center text-zinc-500">No boats match your filters yet.</p>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={{ pathname: "/search", query: { ...raw, page: p } }}
              className={`rounded-md px-3 py-1.5 ${p === page ? "bg-teal-600 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200"}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
