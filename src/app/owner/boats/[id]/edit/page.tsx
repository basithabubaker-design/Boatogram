import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { BoatForm } from "@/components/boat-form";
import { AvailabilityBlocks } from "@/components/availability-blocks";

export default async function EditBoatPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("OWNER");
  const { id } = await params;

  const ownerProfile = await prisma.ownerProfile.findUnique({ where: { userId: user.id } });
  const boat = await prisma.boat.findUnique({
    where: { id },
    include: { images: { orderBy: { order: "asc" } }, blocks: { orderBy: { startAt: "asc" } } },
  });

  if (!boat || !ownerProfile || boat.ownerId !== ownerProfile.id) notFound();

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900">Edit {boat.name}</h1>
      {boat.status === "REJECTED" && (
        <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">
          Rejected: {boat.rejectionReason}
        </p>
      )}
      <BoatForm boatId={boat.id} defaultValues={boat} />

      <div className="mt-8">
        <AvailabilityBlocks boatId={boat.id} blocks={boat.blocks} />
      </div>
    </main>
  );
}
