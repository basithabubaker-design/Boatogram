/**
 * Cancellation / refund policy calculations.
 *
 * A policy is a list of tiers, each mapping a minimum number of days before
 * check-in to a refund percentage. The applicable tier is the one with the
 * highest `minDaysBefore` that the actual days-before-checkin still
 * satisfies (i.e. days-before-checkin >= tier.minDaysBefore).
 *
 * Default platform policy (see DEFAULT_CANCELLATION_TIERS in lib/config.ts):
 *   >= 7 days before check-in  -> 90% refund
 *   >= 3 days before check-in  -> 75% refund
 *   >= 1 day before check-in   -> 50% refund
 *   <  1 day before check-in   -> 0% refund
 */

export type CancellationTier = {
  minDaysBefore: number;
  refundPercent: number;
};

export function daysBeforeCheckin(now: Date, checkinAt: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = checkinAt.getTime() - now.getTime();
  // Floor rather than round: a cancellation 6 days and 23 hours out counts
  // as "6 days before", the more conservative (customer-unfavorable) choice,
  // matching how day-based cancellation windows are normally communicated.
  return Math.floor(diff / msPerDay);
}

export function findApplicableTier(
  tiers: CancellationTier[],
  daysBefore: number,
): CancellationTier {
  if (tiers.length === 0) {
    throw new Error("At least one cancellation tier is required");
  }
  const sorted = [...tiers].sort((a, b) => b.minDaysBefore - a.minDaysBefore);
  const match = sorted.find((tier) => daysBefore >= tier.minDaysBefore);
  // Fall back to the strictest (lowest minDaysBefore) tier if somehow none
  // matched (e.g. a negative days-before value with a misconfigured policy).
  return match ?? sorted[sorted.length - 1];
}

export type RefundCalculation = {
  daysBeforeCheckin: number;
  refundPercent: number;
  refundAmount: number;
};

export function calculateRefund(
  tiers: CancellationTier[],
  totalPaidAmount: number,
  now: Date,
  checkinAt: Date,
): RefundCalculation {
  if (totalPaidAmount < 0) {
    throw new Error("totalPaidAmount must be non-negative");
  }
  const daysBefore = daysBeforeCheckin(now, checkinAt);
  const tier = findApplicableTier(tiers, daysBefore);
  const refundAmount = Math.round((totalPaidAmount * tier.refundPercent) / 100);

  return {
    daysBeforeCheckin: daysBefore,
    refundPercent: tier.refundPercent,
    refundAmount,
  };
}
