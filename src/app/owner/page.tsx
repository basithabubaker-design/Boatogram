import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ToggleBoatButton } from "@/components/toggle-boat-button";

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export default async function OwnerDashboardPage() {
  const user = await requireRole("OWNER");
  const ownerProfile = await prisma.ownerProfile.findUnique({ where: { userId: user.id } });

  if (!ownerProfile || ownerProfile.kycStatus !== "APPROVED") {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Owner dashboard</h1>
        <div className="mt-6 rounded-xl bg-amber-50 p-6 ring-1 ring-amber-200">
          <p className="font-medium text-amber-900">
            {!ownerProfile || ownerProfile.kycStatus === "NOT_SUBMITTED"
              ? "Complete your KYC to start listing boats."
              : ownerProfile.kycStatus === "PENDING"
                ? "Your KYC is under review by our team."
                : `Your KYC was rejected: ${ownerProfile.rejectionReason ?? ""}`}
          </p>
          <Link href="/owner/kyc" className="mt-3 inline-block text-teal-700 hover:underline">
            {ownerProfile?.kycStatus === "REJECTED" ? "Resubmit KYC" : "Go to KYC form"} →
          </Link>
        </div>
      </main>
    );
  }

  const [boats, earnings] = await Promise.all([
    prisma.boat.findMany({ where: { ownerId: ownerProfile.id }, orderBy: { createdAt: "desc" } }),
    prisma.ledgerEntry.aggregate({
      where: { ownerId: ownerProfile.id, type: "OWNER_EARNING" },
      _sum: { amount: true },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Owner dashboard</h1>
        <Link href="/owner/boats/new" className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
          List a new boat
        </Link>
      </div>

      <p className="mt-4 text-sm text-zinc-600">
        Total earnings to date: <span className="font-medium">{rupees(earnings._sum.amount ?? 0)}</span>
        {!ownerProfile.razorpayAccountId && (
          <span className="ml-2 text-amber-700">(payouts not yet linked — contact support)</span>
        )}
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {boats.map((boat) => (
          <div key={boat.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
            <div>
              <p className="font-medium text-zinc-900">{boat.name}</p>
              <p className="text-sm text-zinc-500">
                {boat.type} · {boat.location} · {boat.status}
                {!boat.isActive && " · hidden"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/owner/boats/${boat.id}/edit`} className="text-sm text-teal-700 hover:underline">
                Edit
              </Link>
              {boat.status === "APPROVED" && <ToggleBoatButton boatId={boat.id} isActive={boat.isActive} />}
            </div>
          </div>
        ))}
        {boats.length === 0 && <p className="text-zinc-500">You haven&apos;t listed any boats yet.</p>}
      </div>
    </main>
  );
}
