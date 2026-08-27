"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { boatSchema, availabilityBlockSchema } from "@/lib/validation/boat";
import { createBoat, updateBoat, setBoatActive, BoatError } from "@/lib/services/boat-service";
import { prisma } from "@/lib/prisma";

export type ActionState = { error?: string } | undefined;

function parseBoatForm(formData: FormData) {
  return boatSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    type: formData.get("type"),
    location: formData.get("location"),
    latitude: formData.get("latitude") || undefined,
    longitude: formData.get("longitude") || undefined,
    capacity: formData.get("capacity"),
    bedrooms: formData.get("bedrooms") || undefined,
    amenities: (formData.get("amenities") as string | null)
      ?.split(",")
      .map((a) => a.trim())
      .filter(Boolean),
    basePriceOvernightRupees: formData.get("basePriceOvernightRupees") || undefined,
    basePriceHourlyRupees: formData.get("basePriceHourlyRupees") || undefined,
    minHours: formData.get("minHours") || undefined,
    imageUrls: (formData.get("imageUrls") as string | null)
      ?.split(",")
      .map((u) => u.trim())
      .filter(Boolean),
  });
}

export async function createBoatAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole("OWNER");
  const parsed = parseBoatForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const boat = await createBoat(user.id, parsed.data);
    revalidatePath("/owner");
    redirect(`/owner/boats/${boat.id}/edit`);
  } catch (error) {
    if (error instanceof BoatError) return { error: error.message };
    throw error;
  }
}

export async function updateBoatAction(
  boatId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("OWNER");
  const parsed = parseBoatForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await updateBoat(user.id, boatId, parsed.data);
    revalidatePath("/owner");
    revalidatePath(`/owner/boats/${boatId}/edit`);
    return { error: undefined };
  } catch (error) {
    if (error instanceof BoatError) return { error: error.message };
    throw error;
  }
}

export async function toggleBoatActiveAction(boatId: string, isActive: boolean) {
  const user = await requireRole("OWNER");
  await setBoatActive(user.id, boatId, isActive);
  revalidatePath("/owner");
}

async function requireOwnedBoat(userId: string, boatId: string) {
  const ownerProfile = await prisma.ownerProfile.findUnique({ where: { userId } });
  const boat = await prisma.boat.findUnique({ where: { id: boatId } });
  if (!ownerProfile || !boat || boat.ownerId !== ownerProfile.id) {
    throw new BoatError("Boat not found", "NOT_FOUND");
  }
  return boat;
}

export async function addAvailabilityBlockAction(
  boatId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("OWNER");
  await requireOwnedBoat(user.id, boatId);

  const parsed = availabilityBlockSchema.safeParse({
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid dates" };
  }

  await prisma.availabilityBlock.create({ data: { boatId, ...parsed.data } });
  revalidatePath(`/owner/boats/${boatId}/edit`);
  return { error: undefined };
}

export async function removeAvailabilityBlockAction(boatId: string, blockId: string) {
  const user = await requireRole("OWNER");
  await requireOwnedBoat(user.id, boatId);
  await prisma.availabilityBlock.delete({ where: { id: blockId } });
  revalidatePath(`/owner/boats/${boatId}/edit`);
}
