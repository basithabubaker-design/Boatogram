import { describe, expect, it } from "vitest";
import { calculateRefund, daysBeforeCheckin, findApplicableTier } from "@/lib/booking/cancellation";

const DEFAULT_TIERS = [
  { minDaysBefore: 7, refundPercent: 90 },
  { minDaysBefore: 3, refundPercent: 75 },
  { minDaysBefore: 1, refundPercent: 50 },
  { minDaysBefore: 0, refundPercent: 0 },
];

describe("daysBeforeCheckin", () => {
  it("floors partial days down (conservative rounding)", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const checkin = new Date("2026-01-07T23:00:00Z"); // 6 days, 23 hours out
    expect(daysBeforeCheckin(now, checkin)).toBe(6);
  });

  it("returns 0 for a same-day checkin", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    const checkin = new Date("2026-01-01T18:00:00Z");
    expect(daysBeforeCheckin(now, checkin)).toBe(0);
  });

  it("returns a negative number after checkin has passed", () => {
    const now = new Date("2026-01-05T00:00:00Z");
    const checkin = new Date("2026-01-01T00:00:00Z");
    expect(daysBeforeCheckin(now, checkin)).toBeLessThan(0);
  });
});

describe("findApplicableTier", () => {
  it("picks the highest tier the days-before satisfies", () => {
    expect(findApplicableTier(DEFAULT_TIERS, 10).refundPercent).toBe(90);
    expect(findApplicableTier(DEFAULT_TIERS, 7).refundPercent).toBe(90);
    expect(findApplicableTier(DEFAULT_TIERS, 6).refundPercent).toBe(75);
    expect(findApplicableTier(DEFAULT_TIERS, 3).refundPercent).toBe(75);
    expect(findApplicableTier(DEFAULT_TIERS, 2).refundPercent).toBe(50);
    expect(findApplicableTier(DEFAULT_TIERS, 1).refundPercent).toBe(50);
    expect(findApplicableTier(DEFAULT_TIERS, 0).refundPercent).toBe(0);
  });

  it("falls back to the strictest tier for a negative days-before (past checkin)", () => {
    expect(findApplicableTier(DEFAULT_TIERS, -5).refundPercent).toBe(0);
  });

  it("throws with an empty tier list", () => {
    expect(() => findApplicableTier([], 10)).toThrow();
  });
});

describe("calculateRefund", () => {
  it("applies the 90% tier at exactly 7 days out", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const checkin = new Date("2026-01-08T00:00:00Z");
    const result = calculateRefund(DEFAULT_TIERS, 10_000_00, now, checkin);
    expect(result.daysBeforeCheckin).toBe(7);
    expect(result.refundPercent).toBe(90);
    expect(result.refundAmount).toBe(9_000_00);
  });

  it("applies 0% refund on a last-minute (same day) cancellation", () => {
    const now = new Date("2026-01-01T09:00:00Z");
    const checkin = new Date("2026-01-01T20:00:00Z");
    const result = calculateRefund(DEFAULT_TIERS, 10_000_00, now, checkin);
    expect(result.refundPercent).toBe(0);
    expect(result.refundAmount).toBe(0);
  });

  it("applies the 75% tier between 3 and 6 days out", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const checkin = new Date("2026-01-04T12:00:00Z"); // 3 days, 12 hours out -> floors to 3
    const result = calculateRefund(DEFAULT_TIERS, 20_000_00, now, checkin);
    expect(result.refundPercent).toBe(75);
    expect(result.refundAmount).toBe(15_000_00);
  });

  it("rejects a negative total paid amount", () => {
    expect(() =>
      calculateRefund(DEFAULT_TIERS, -1, new Date(), new Date(Date.now() + 86400000)),
    ).toThrow();
  });
});
