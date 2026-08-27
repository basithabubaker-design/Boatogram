import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { BookingForm } from "@/components/booking-form";

export default async function BoatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const boat = await prisma.boat.findUnique({
    where: { id },
    include: { images: { orderBy: { order: "asc" } }, owner: { select: { businessName: true } } },
  });

  if (!boat || boat.status !== "APPROVED" || !boat.isActive) {
    notFound();
  }

  const user = await getCurrentUser();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="h-72 w-full overflow-hidden rounded-xl bg-zinc-100">
            {boat.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={boat.images[0].url} alt={boat.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-zinc-400">No photo</div>
            )}
          </div>
          <span className="mt-4 inline-block text-xs font-medium uppercase tracking-wide text-teal-700">
            {boat.type === "HOUSEBOAT" ? "Houseboat · overnight stay" : "Shikara · hourly ride"}
          </span>
          <h1 className="text-2xl font-semibold text-zinc-900">{boat.name}</h1>
          <p className="text-sm text-zinc-500">
            {boat.location} · Hosted by {boat.owner.businessName}
          </p>
          <p className="mt-4 whitespace-pre-line text-zinc-700">{boat.description}</p>

          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-zinc-500">Capacity</dt>
              <dd className="font-medium">{boat.capacity} guests</dd>
            </div>
            {boat.bedrooms != null && (
              <div>
                <dt className="text-zinc-500">Bedrooms</dt>
                <dd className="font-medium">{boat.bedrooms}</dd>
              </div>
            )}
            {boat.type === "SHIKARA" && (
              <div>
                <dt className="text-zinc-500">Minimum booking</dt>
                <dd className="font-medium">{boat.minHours ?? 1} hour(s)</dd>
              </div>
            )}
          </dl>

          {boat.amenities.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-medium text-zinc-900">Amenities</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {boat.amenities.map((a) => (
                  <li key={a} className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700">
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div>
          <BookingForm
            boatId={boat.id}
            boatType={boat.type}
            capacity={boat.capacity}
            minHours={boat.minHours ?? 1}
            priceOvernight={boat.basePriceOvernight}
            priceHourly={boat.basePriceHourly}
            isLoggedIn={Boolean(user)}
            isCustomer={user?.role === "CUSTOMER"}
          />
        </div>
      </div>
    </main>
  );
}
