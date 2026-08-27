import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function AdminHomePage() {
  await requireRole("ADMIN");

  const [pendingKyc, pendingBoats, confirmedBookings] = await Promise.all([
    prisma.ownerProfile.count({ where: { kycStatus: "PENDING" } }),
    prisma.boat.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.booking.count({ where: { status: "CONFIRMED" } }),
  ]);

  const links = [
    { href: "/admin/kyc", label: "Owner KYC review", badge: pendingKyc },
    { href: "/admin/boats", label: "Boat listing approvals", badge: pendingBoats },
    { href: "/admin/ledger", label: "Commission & ledger", badge: confirmedBookings },
    { href: "/admin/cancellation-policy", label: "Cancellation policy", badge: null },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900">Admin panel</h1>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center justify-between rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 hover:shadow-md"
          >
            <span className="font-medium text-zinc-900">{link.label}</span>
            {link.badge != null && (
              <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-800">
                {link.badge}
              </span>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}
