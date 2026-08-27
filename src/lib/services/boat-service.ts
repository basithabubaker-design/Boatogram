import "server-only";
import { prisma } from "@/lib/prisma";
import type { BoatInput } from "@/lib/validation/boat";
import { toPricingFields } from "@/lib/validation/boat";
import { notify } from "@/lib/notifications/notify";

export class BoatError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

async function requireApprovedOwnerProfile(userId: string) {
  const ownerProfile = await prisma.ownerProfile.findUnique({ where: { userId } });
  if (!ownerProfile) {
    throw new BoatError("Complete your owner profile before listing boats", "NO_OWNER_PROFILE");
  }
  if (ownerProfile.kycStatus !== "APPROVED") {
    throw new BoatError(
      "Your KYC must be approved by an admin before you can list boats",
      "KYC_NOT_APPROVED",
    );
  }
  return ownerProfile;
}

export async function createBoat(userId: string, input: BoatInput) {
  const ownerProfile = await requireApprovedOwnerProfile(userId);
  const pricing = toPricingFields(input);

  return prisma.boat.create({
    data: {
      ownerId: ownerProfile.id,
      name: input.name,
      description: input.description,
      type: input.type,
      location: input.location,
      latitude: input.latitude,
      longitude: input.longitude,
      capacity: input.capacity,
      bedrooms: input.bedrooms,
      amenities: input.amenities,
      ...pricing,
      status: "PENDING_APPROVAL",
      images: { createMany: { data: input.imageUrls.map((url, order) => ({ url, order })) } },
    },
  });
}

export async function updateBoat(userId: string, boatId: string, input: BoatInput) {
  const ownerProfile = await requireApprovedOwnerProfile(userId);
  const boat = await prisma.boat.findUnique({ where: { id: boatId } });
  if (!boat || boat.ownerId !== ownerProfile.id) {
    throw new BoatError("Boat not found", "NOT_FOUND");
  }

  const pricing = toPricingFields(input);

  return prisma.$transaction(async (tx) => {
    await tx.boatImage.deleteMany({ where: { boatId } });
    return tx.boat.update({
      where: { id: boatId },
      data: {
        name: input.name,
        description: input.description,
        type: input.type,
        location: input.location,
        latitude: input.latitude,
        longitude: input.longitude,
        capacity: input.capacity,
        bedrooms: input.bedrooms,
        amenities: input.amenities,
        ...pricing,
        // Any edit to a live listing needs re-approval before it is public
        // again, so guests never see unreviewed changes.
        status: "PENDING_APPROVAL",
        rejectionReason: null,
        images: { createMany: { data: input.imageUrls.map((url, order) => ({ url, order })) } },
      },
    });
  });
}

export async function setBoatActive(userId: string, boatId: string, isActive: boolean) {
  const ownerProfile = await prisma.ownerProfile.findUnique({ where: { userId } });
  const boat = await prisma.boat.findUnique({ where: { id: boatId } });
  if (!boat || !ownerProfile || boat.ownerId !== ownerProfile.id) {
    throw new BoatError("Boat not found", "NOT_FOUND");
  }
  return prisma.boat.update({ where: { id: boatId }, data: { isActive } });
}

export async function reviewBoat(params: {
  boatId: string;
  reviewerId: string;
  decision: "APPROVED" | "REJECTED";
  rejectionReason?: string;
}) {
  const boat = await prisma.boat.update({
    where: { id: params.boatId },
    data: {
      status: params.decision,
      rejectionReason: params.decision === "REJECTED" ? params.rejectionReason : null,
    },
    include: { owner: { include: { user: true } } },
  });

  await notify({
    userId: boat.owner.user.id,
    type: params.decision === "APPROVED" ? "BOAT_APPROVED" : "BOAT_REJECTED",
    title: params.decision === "APPROVED" ? "Your boat listing is live" : "Your boat listing was rejected",
    body:
      params.decision === "APPROVED"
        ? `${boat.name} is now visible to customers.`
        : `${boat.name} was rejected: ${params.rejectionReason ?? "No reason given."}`,
    email: boat.owner.user.email,
    meta: { boatId: boat.id },
  });

  return boat;
}
