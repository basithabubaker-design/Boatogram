import { requireRole } from "@/lib/auth/session";
import { ensureDefaultCancellationPolicy } from "@/lib/services/cancellation-policy";
import { prisma } from "@/lib/prisma";
import { CancellationPolicyForm } from "@/components/cancellation-policy-form";

export default async function AdminCancellationPolicyPage() {
  await requireRole("ADMIN");
  const policy = await ensureDefaultCancellationPolicy();
  const tiers = await prisma.cancellationPolicyTier.findMany({
    where: { policyId: policy.id },
    orderBy: { minDaysBefore: "desc" },
  });

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900">Default cancellation policy</h1>
      <p className="mt-1 text-sm text-zinc-600">Applies to every boat unless a boat has its own override.</p>
      <CancellationPolicyForm
        tiers={tiers.map((t) => ({ minDaysBefore: t.minDaysBefore, refundPercent: t.refundPercent }))}
      />
    </main>
  );
}
