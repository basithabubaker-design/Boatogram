import { z } from "zod";

const rupeesToPaise = (rupees: number) => Math.round(rupees * 100);

export const boatSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    description: z.string().trim().min(20).max(4000),
    type: z.enum(["HOUSEBOAT", "SHIKARA"]),
    location: z.string().trim().min(2).max(120),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    capacity: z.coerce.number().int().min(1).max(200),
    bedrooms: z.coerce.number().int().min(0).max(50).optional(),
    amenities: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
    // Prices are entered in rupees in the UI and converted to paise here.
    basePriceOvernightRupees: z.coerce.number().min(0).max(1_000_000).optional(),
    basePriceHourlyRupees: z.coerce.number().min(0).max(1_000_000).optional(),
    minHours: z.coerce.number().int().min(1).max(24).optional(),
    imageUrls: z.array(z.string().trim().url()).max(20).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.type === "HOUSEBOAT" && !data.basePriceOvernightRupees) {
      ctx.addIssue({
        code: "custom",
        path: ["basePriceOvernightRupees"],
        message: "Overnight price is required for houseboats",
      });
    }
    if (data.type === "SHIKARA" && !data.basePriceHourlyRupees) {
      ctx.addIssue({
        code: "custom",
        path: ["basePriceHourlyRupees"],
        message: "Hourly price is required for Shikaras",
      });
    }
  });

export type BoatInput = z.infer<typeof boatSchema>;

export function toPricingFields(input: BoatInput) {
  return {
    basePriceOvernight: input.basePriceOvernightRupees
      ? rupeesToPaise(input.basePriceOvernightRupees)
      : null,
    basePriceHourly: input.basePriceHourlyRupees
      ? rupeesToPaise(input.basePriceHourlyRupees)
      : null,
    minHours: input.minHours ?? 1,
  };
}

export const availabilityBlockSchema = z
  .object({
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    reason: z.string().trim().max(200).optional(),
  })
  .refine((data) => data.endAt > data.startAt, {
    message: "End date must be after start date",
    path: ["endAt"],
  });

export const searchSchema = z.object({
  type: z.enum(["HOUSEBOAT", "SHIKARA"]).optional(),
  location: z.string().trim().max(120).optional(),
  minCapacity: z.coerce.number().int().min(1).optional(),
  maxPriceRupees: z.coerce.number().min(0).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
  sort: z.enum(["price_asc", "price_desc", "capacity_desc", "newest"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
});
