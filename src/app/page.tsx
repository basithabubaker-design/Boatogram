import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-teal-50 to-zinc-50 px-4 py-24 text-center">
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
        Kerala houseboats & Shikaras, booked directly from local owners
      </h1>
      <p className="mt-4 max-w-xl text-lg text-zinc-600">
        Overnight houseboat stays on the backwaters, or an hourly Shikara ride — search, compare
        availability, and pay securely.
      </p>
      <form action="/search" className="mt-8 flex w-full max-w-xl flex-col gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 sm:flex-row">
        <input
          name="location"
          placeholder="Alleppey, Kumarakom, Kochi..."
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <select name="type" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
          <option value="">Any boat type</option>
          <option value="HOUSEBOAT">Houseboat (overnight)</option>
          <option value="SHIKARA">Shikara (hourly)</option>
        </select>
        <button className="rounded-md bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700">
          Search
        </button>
      </form>
      <Link href="/search" className="mt-4 text-sm text-teal-700 hover:underline">
        Or browse all boats →
      </Link>
    </main>
  );
}
