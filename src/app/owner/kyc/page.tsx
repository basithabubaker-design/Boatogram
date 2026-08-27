import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { KycForm } from "@/components/kyc-form";

export default async function OwnerKycPage() {
  const user = await requireRole("OWNER");
  const ownerProfile = await prisma.ownerProfile.findUnique({
    where: { userId: user.id },
    include: { documents: true },
  });

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900">Owner KYC</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Submit your business and bank details for admin review. Approval is required before you can list
        boats and receive payouts.
      </p>
      {ownerProfile?.kycStatus === "PENDING" && (
        <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Your submission is under review.
        </p>
      )}
      {ownerProfile?.kycStatus === "REJECTED" && (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">
          Rejected: {ownerProfile.rejectionReason}
        </p>
      )}
      {ownerProfile?.kycStatus === "APPROVED" && (
        <p className="mt-4 rounded-md bg-teal-50 p-3 text-sm text-teal-800 ring-1 ring-teal-200">
          Your KYC is approved.
        </p>
      )}
      <KycForm defaultValues={ownerProfile ?? undefined} />
    </main>
  );
}
