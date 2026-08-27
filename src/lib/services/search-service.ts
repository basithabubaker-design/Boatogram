import "server-only";
import { prisma } from "@/lib/prisma";
import { isRangeAvailable } from "@/lib/booking/availability";
import type { z } from "zod";
import type { searchSchema } from "@/lib/validation/boat";

type SearchInput = z.infer<typeof searchSchema>;

const PAGE_SIZE = 12;

export async function searchBoats(input: SearchInput) {
  const orderBy =
    input.sort === "price_asc"
      ? undefined // handled after price coalescing below
      : input.sort === "capacity_desc"
        ? ({ capacity: "desc" } as const)
        : ({ createdAt: "desc" } as const);

  const boats = await prisma.boat.findMany({
    where: {
      status: "APPROVED",
      isActive: true,
      type: input.type,
      location: input.location ? { contains: input.location, mode: "insensitive" } : undefined,
      capacity: input.minCapacity ? { gte: input.minCapacity } : undefined,
    },
    include: { images: { orderBy: { order: "asc" }, take: 1 }, owner: { select: { businessName: true } } },
    orderBy,
  });

  let filtered = boats;

  if (input.maxPriceRupees) {
    const maxPaise = input.maxPriceRupees * 100;
    filtered = filtered.filter((boat) => {
      const price = boat.type === "HOUSEBOAT" ? boat.basePriceOvernight : boat.basePriceHourly;
      return price != null && price <= maxPaise;
    });
  }

  if (input.startAt && input.endAt) {
    const boatIds = filtered.map((b) => b.id);
    const [bookings, blocks] = await Promise.all([
      prisma.booking.findMany({
        where: { boatId: { in: boatIds }, status: { in: ["CONFIRMED", "PENDING_PAYMENT"] } },
        select: { boatId: true, startAt: true, endAt: true },
      }),
      prisma.availabilityBlock.findMany({
        where: { boatId: { in: boatIds } },
        select: { boatId: true, startAt: true, endAt: true },
      }),
    ]);
    const occupiedByBoat = new Map<string, { startAt: Date; endAt: Date }[]>();
    for (const row of [...bookings, ...blocks]) {
      const list = occupiedByBoat.get(row.boatId) ?? [];
      list.push({ startAt: row.startAt, endAt: row.endAt });
      occupiedByBoat.set(row.boatId, list);
    }
    filtered = filtered.filter((boat) =>
      isRangeAvailable({ startAt: input.startAt!, endAt: input.endAt! }, occupiedByBoat.get(boat.id) ?? []),
    );
  }

  if (input.sort === "price_asc" || input.sort === "price_desc") {
    const priceOf = (boat: (typeof filtered)[number]) =>
      (boat.type === "HOUSEBOAT" ? boat.basePriceOvernight : boat.basePriceHourly) ?? Number.MAX_SAFE_INTEGER;
    filtered = [...filtered].sort((a, b) =>
      input.sort === "price_asc" ? priceOf(a) - priceOf(b) : priceOf(b) - priceOf(a),
    );
  }

  const total = filtered.length;
  const start = (input.page - 1) * PAGE_SIZE;
  const page = filtered.slice(start, start + PAGE_SIZE);

  return { boats: page, total, pageSize: PAGE_SIZE, page: input.page };
}
