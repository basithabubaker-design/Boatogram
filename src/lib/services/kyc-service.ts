import "server-only";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments";
import { notify } from "@/lib/notifications/notify";
import type { z } from "zod";
import type { kycSubmitSchema } from "@/lib/validation/booking";

type KycSubmitInput = z.infer<typeof kycSubmitSchema>;

export async function submitKyc(userId: string, input: KycSubmitInput) {
  return prisma.$transaction(async (tx) => {
    const ownerProfile = await tx.ownerProfile.upsert({
      where: { userId },
      create: {
        userId,
        businessName: input.businessName,
        bankAccountName: input.bankAccountName,
        bankAccountNumber: input.bankAccountNumber,
        bankIfsc: input.bankIfsc,
        panNumber: input.panNumber,
        kycStatus: "PENDING",
        submittedAt: new Date(),
      },
      update: {
        businessName: input.businessName,
        bankAccountName: input.bankAccountName,
        bankAccountNumber: input.bankAccountNumber,
        bankIfsc: input.bankIfsc,
        panNumber: input.panNumber,
        kycStatus: "PENDING",
        rejectionReason: null,
        submittedAt: new Date(),
      },
    });

    await tx.kycDocument.deleteMany({ where: { ownerProfileId: ownerProfile.id } });
    await tx.kycDocument.createMany({
      data: input.documentUrls.map((url) => ({
        ownerProfileId: ownerProfile.id,
        type: "IDENTITY_OR_ADDRESS_PROOF",
        url,
      })),
    });

    return ownerProfile;
  });
}

export async function reviewKyc(params: {
  ownerProfileId: string;
  reviewerId: string;
  decision: "APPROVED" | "REJECTED";
  rejectionReason?: string;
}) {
  const ownerProfile = await prisma.ownerProfile.update({
    where: { id: params.ownerProfileId },
    data: {
      kycStatus: params.decision,
      rejectionReason: params.decision === "REJECTED" ? params.rejectionReason : null,
      reviewedAt: new Date(),
      reviewedById: params.reviewerId,
    },
    include: { user: true },
  });

  if (params.decision === "APPROVED") {
    await tryCreateLinkedAccount(ownerProfile.id);
  }

  await notify({
    userId: ownerProfile.user.id,
    type: params.decision === "APPROVED" ? "KYC_APPROVED" : "KYC_REJECTED",
    title: params.decision === "APPROVED" ? "KYC approved" : "KYC rejected",
    body:
      params.decision === "APPROVED"
        ? "You can now list boats on Boatogram."
        : `Your KYC submission was rejected: ${params.rejectionReason ?? "No reason given."}`,
    email: ownerProfile.user.email,
  });

  return ownerProfile;
}

/** Best-effort: creates the owner's Razorpay Route linked account so future
 * booking payouts can be split automatically. If the payment provider isn't
 * configured, or the API call fails, KYC approval still succeeds — the
 * owner simply can't receive automated payouts yet, visible to admins via
 * a null razorpayAccountId and failed PaymentSplit rows on future bookings. */
async function tryCreateLinkedAccount(ownerProfileId: string) {
  const provider = getPaymentProvider();
  if (!provider.isConfigured) return;

  const ownerProfile = await prisma.ownerProfile.findUnique({
    where: { id: ownerProfileId },
    include: { user: true },
  });
  if (!ownerProfile || ownerProfile.razorpayAccountId) return;
  if (!ownerProfile.bankAccountNumber || !ownerProfile.bankIfsc || !ownerProfile.panNumber) return;

  try {
    const account = await provider.ensureLinkedAccount({
      ownerProfileId: ownerProfile.id,
      email: ownerProfile.user.email,
      phone: ownerProfile.user.phone ?? "9999999999",
      legalBusinessName: ownerProfile.businessName,
      panNumber: ownerProfile.panNumber,
      beneficiaryName: ownerProfile.bankAccountName ?? ownerProfile.businessName,
      accountNumber: ownerProfile.bankAccountNumber,
      ifscCode: ownerProfile.bankIfsc,
    });
    await prisma.ownerProfile.update({
      where: { id: ownerProfile.id },
      data: { razorpayAccountId: account.accountId },
    });
  } catch (error) {
    console.error(`[kyc] Failed to create Razorpay linked account for owner ${ownerProfileId}:`, error);
  }
}
