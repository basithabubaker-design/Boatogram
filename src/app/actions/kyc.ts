"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { kycSubmitSchema } from "@/lib/validation/booking";
import { submitKyc } from "@/lib/services/kyc-service";

export type ActionState = { error?: string; success?: boolean } | undefined;

export async function submitKycAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole("OWNER");
  const parsed = kycSubmitSchema.safeParse({
    businessName: formData.get("businessName"),
    bankAccountName: formData.get("bankAccountName"),
    bankAccountNumber: formData.get("bankAccountNumber"),
    bankIfsc: formData.get("bankIfsc"),
    panNumber: formData.get("panNumber"),
    documentUrls: (formData.get("documentUrls") as string | null)
      ?.split(",")
      .map((u) => u.trim())
      .filter(Boolean),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await submitKyc(user.id, parsed.data);
  revalidatePath("/owner/kyc");
  return { success: true };
}
