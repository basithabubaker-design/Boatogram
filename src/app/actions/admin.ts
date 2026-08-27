"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { kycReviewSchema, boatReviewSchema, cancellationPolicySchema } from "@/lib/validation/booking";
import { reviewKyc } from "@/lib/services/kyc-service";
import { reviewBoat } from "@/lib/services/boat-service";
import { ensureDefaultCancellationPolicy } from "@/lib/services/cancellation-policy";

export type ActionState = { error?: string; success?: boolean } | undefined;

export async function reviewKycAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const parsed = kycReviewSchema.safeParse({
    ownerProfileId: formData.get("ownerProfileId"),
    decision: formData.get("decision"),
    rejectionReason: formData.get("rejectionReason") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await reviewKyc({ ...parsed.data, reviewerId: admin.id });
  revalidatePath("/admin/kyc");
  return { success: true };
}

export async function reviewBoatAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const parsed = boatReviewSchema.safeParse({
    boatId: formData.get("boatId"),
    decision: formData.get("decision"),
    rejectionReason: formData.get("rejectionReason") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await reviewBoat({ ...parsed.data, reviewerId: admin.id });
  revalidatePath("/admin/boats");
  return { success: true };
}

export async function updateCancellationPolicyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("ADMIN");

  const minDaysBefore = formData.getAll("minDaysBefore").map(Number);
  const refundPercent = formData.getAll("refundPercent").map(Number);
  const tiers = minDaysBefore.map((minDaysBefore, i) => ({ minDaysBefore, refundPercent: refundPercent[i] }));

  const parsed = cancellationPolicySchema.safeParse({ name: "Platform default", tiers });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid tiers" };

  const policy = await ensureDefaultCancellationPolicy();
  await prisma.$transaction([
    prisma.cancellationPolicyTier.deleteMany({ where: { policyId: policy.id } }),
    prisma.cancellationPolicyTier.createMany({
      data: parsed.data.tiers.map((tier) => ({ ...tier, policyId: policy.id })),
    }),
  ]);

  revalidatePath("/admin/cancellation-policy");
  return { success: true };
}
