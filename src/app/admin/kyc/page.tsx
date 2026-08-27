import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ReviewDecisionForm } from "@/components/review-decision-form";
import { reviewKycAction } from "@/app/actions/admin";

export default async function AdminKycPage() {
  await requireRole("ADMIN");
  const pending = await prisma.ownerProfile.findMany({
    where: { kycStatus: "PENDING" },
    include: { user: true, documents: true },
    orderBy: { submittedAt: "asc" },
  });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900">Owner KYC review</h1>
      <div className="mt-6 flex flex-col gap-4">
        {pending.map((profile) => (
          <div key={profile.id} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
            <p className="font-medium text-zinc-900">{profile.businessName}</p>
            <p className="text-sm text-zinc-500">
              {profile.user.name} · {profile.user.email}
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-zinc-500">Bank account</dt>
                <dd>{profile.bankAccountName} — {profile.bankAccountNumber}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">IFSC / PAN</dt>
                <dd>{profile.bankIfsc} / {profile.panNumber}</dd>
              </div>
            </dl>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.documents.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-teal-700 hover:underline"
                >
                  Document ↗
                </a>
              ))}
            </div>
            <ReviewDecisionForm action={reviewKycAction} idField="ownerProfileId" idValue={profile.id} />
          </div>
        ))}
        {pending.length === 0 && <p className="text-zinc-500">No pending KYC submissions.</p>}
      </div>
    </main>
  );
}
