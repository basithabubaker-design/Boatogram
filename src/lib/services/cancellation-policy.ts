import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CANCELLATION_TIERS } from "@/lib/config";

/** Ensures a single default, platform-wide cancellation policy exists and
 * returns it. Safe to call repeatedly (idempotent). */
export async function ensureDefaultCancellationPolicy() {
  const existing = await prisma.cancellationPolicy.findFirst({ where: { isDefault: true } });
  if (existing) return existing;

  return prisma.cancellationPolicy.create({
    data: {
      name: "Platform default",
      isDefault: true,
      tiers: { createMany: { data: DEFAULT_CANCELLATION_TIERS } },
    },
  });
}

/** Returns the policy that applies to a boat: its own override if set,
 * otherwise the platform default (created on demand if missing). */
export async function getEffectivePolicyForBoat(boatId: string) {
  const boat = await prisma.boat.findUniqueOrThrow({
    where: { id: boatId },
    include: { cancellationPolicy: { include: { tiers: true } } },
  });
  if (boat.cancellationPolicy) return boat.cancellationPolicy;

  const defaultPolicy = await ensureDefaultCancellationPolicy();
  return prisma.cancellationPolicy.findUniqueOrThrow({
    where: { id: defaultPolicy.id },
    include: { tiers: true },
  });
}
