import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export default async function AdminLedgerPage() {
  await requireRole("ADMIN");

  const [commission, ownerEarnings, refundsOwner, refundsPlatform, recentEntries, splitFailures] =
    await Promise.all([
      prisma.ledgerEntry.aggregate({ where: { type: "PLATFORM_COMMISSION" }, _sum: { amount: true } }),
      prisma.ledgerEntry.aggregate({ where: { type: "OWNER_EARNING" }, _sum: { amount: true } }),
      prisma.ledgerEntry.aggregate({ where: { type: "REFUND_DEBIT_OWNER" }, _sum: { amount: true } }),
      prisma.ledgerEntry.aggregate({ where: { type: "REFUND_DEBIT_PLATFORM" }, _sum: { amount: true } }),
      prisma.ledgerEntry.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { booking: { include: { boat: true } }, owner: true },
      }),
      prisma.paymentSplit.findMany({
        where: { status: "FAILED" },
        include: { payment: { include: { booking: { include: { boat: { include: { owner: true } } } } } } },
        take: 20,
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const netPlatformCommission = (commission._sum.amount ?? 0) + (refundsPlatform._sum.amount ?? 0);
  const netOwnerEarnings = (ownerEarnings._sum.amount ?? 0) + (refundsOwner._sum.amount ?? 0);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900">Commission & ledger</h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-500">Net platform commission</p>
          <p className="text-2xl font-semibold text-zinc-900">{rupees(netPlatformCommission)}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-500">Net owner earnings</p>
          <p className="text-2xl font-semibold text-zinc-900">{rupees(netOwnerEarnings)}</p>
        </div>
      </div>

      {splitFailures.length > 0 && (
        <div className="mt-6 rounded-xl bg-amber-50 p-5 ring-1 ring-amber-200">
          <h2 className="font-medium text-amber-900">Payout transfers needing attention</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-amber-900">
            {splitFailures.map((split) => (
              <li key={split.id}>
                {split.payment.booking.boat.name} ({split.payment.booking.boat.owner.businessName}) —{" "}
                {rupees(split.ownerAmount)} — {split.failureReason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Booking</th>
              <th className="px-4 py-2">Owner</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {recentEntries.map((entry) => (
              <tr key={entry.id} className="border-t border-zinc-100">
                <td className="px-4 py-2 text-zinc-500">{entry.createdAt.toLocaleDateString("en-IN")}</td>
                <td className="px-4 py-2">{entry.type.replaceAll("_", " ")}</td>
                <td className="px-4 py-2">{entry.booking?.boat.name ?? "—"}</td>
                <td className="px-4 py-2">{entry.owner?.businessName ?? "Platform"}</td>
                <td className={`px-4 py-2 text-right ${entry.amount < 0 ? "text-red-600" : "text-zinc-900"}`}>
                  {rupees(entry.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
