import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ReviewDecisionForm } from "@/components/review-decision-form";
import { reviewBoatAction } from "@/app/actions/admin";

function rupees(paise: number | null) {
  if (paise == null) return "—";
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export default async function AdminBoatsPage() {
  await requireRole("ADMIN");
  const pending = await prisma.boat.findMany({
    where: { status: "PENDING_APPROVAL" },
    include: { owner: { include: { user: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900">Boat listing approvals</h1>
      <div className="mt-6 flex flex-col gap-4">
        {pending.map((boat) => (
          <div key={boat.id} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
            <p className="font-medium text-zinc-900">{boat.name}</p>
            <p className="text-sm text-zinc-500">
              {boat.type} · {boat.location} · by {boat.owner.businessName} ({boat.owner.user.email})
            </p>
            <p className="mt-1 text-sm text-zinc-700">{boat.description}</p>
            <p className="mt-1 text-sm">
              {boat.type === "HOUSEBOAT" ? rupees(boat.basePriceOvernight) + " / night" : rupees(boat.basePriceHourly) + " / hour"}
              {" · "}
              {boat.capacity} guests
            </p>
            <ReviewDecisionForm action={reviewBoatAction} idField="boatId" idValue={boat.id} />
          </div>
        ))}
        {pending.length === 0 && <p className="text-zinc-500">No pending boat listings.</p>}
      </div>
    </main>
  );
}
