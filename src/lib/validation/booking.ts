import { z } from "zod";

export const createBookingSchema = z
  .object({
    boatId: z.string().min(1),
    bookingType: z.enum(["OVERNIGHT", "SHIKARA_HOURLY"]),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    guests: z.coerce.number().int().min(1).max(200),
  })
  .refine((data) => data.endAt > data.startAt, {
    message: "End time must be after start time",
    path: ["endAt"],
  })
  .refine((data) => data.startAt.getTime() > Date.now(), {
    message: "Start time must be in the future",
    path: ["startAt"],
  });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const cancelBookingSchema = z.object({
  bookingId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
});

export const kycSubmitSchema = z.object({
  businessName: z.string().trim().min(2).max(150),
  bankAccountName: z.string().trim().min(2).max(150),
  bankAccountNumber: z.string().trim().regex(/^[0-9]{6,20}$/, "Enter a valid account number"),
  bankIfsc: z
    .string()
    .trim()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i, "Enter a valid IFSC code")
    .transform((v) => v.toUpperCase()),
  panNumber: z
    .string()
    .trim()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/i, "Enter a valid PAN number")
    .transform((v) => v.toUpperCase()),
  documentUrls: z.array(z.string().trim().url()).min(1, "Upload at least one KYC document").max(10),
});

export const kycReviewSchema = z.object({
  ownerProfileId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().trim().max(500).optional(),
});

export const boatReviewSchema = z.object({
  boatId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().trim().max(500).optional(),
});

export const cancellationPolicySchema = z.object({
  name: z.string().trim().min(2).max(120),
  tiers: z
    .array(
      z.object({
        minDaysBefore: z.coerce.number().int().min(0).max(365),
        refundPercent: z.coerce.number().int().min(0).max(100),
      }),
    )
    .min(1),
});
