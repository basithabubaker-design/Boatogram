import { describe, expect, it } from "vitest";
import {
  hoursBetween,
  intervalsOverlap,
  isRangeAvailable,
  nightsBetween,
} from "@/lib/booking/availability";

describe("intervalsOverlap", () => {
  it("detects a fully overlapping interval", () => {
    const a = { startAt: new Date("2026-01-01"), endAt: new Date("2026-01-05") };
    const b = { startAt: new Date("2026-01-02"), endAt: new Date("2026-01-03") };
    expect(intervalsOverlap(a, b)).toBe(true);
  });

  it("detects a partially overlapping interval", () => {
    const a = { startAt: new Date("2026-01-01"), endAt: new Date("2026-01-05") };
    const b = { startAt: new Date("2026-01-04"), endAt: new Date("2026-01-10") };
    expect(intervalsOverlap(a, b)).toBe(true);
  });

  it("treats back-to-back intervals (checkout == checkin) as non-overlapping", () => {
    const a = { startAt: new Date("2026-01-01T14:00:00"), endAt: new Date("2026-01-05T11:00:00") };
    const b = { startAt: new Date("2026-01-05T11:00:00"), endAt: new Date("2026-01-08T11:00:00") };
    expect(intervalsOverlap(a, b)).toBe(false);
  });

  it("returns false for completely disjoint intervals", () => {
    const a = { startAt: new Date("2026-01-01"), endAt: new Date("2026-01-02") };
    const b = { startAt: new Date("2026-02-01"), endAt: new Date("2026-02-02") };
    expect(intervalsOverlap(a, b)).toBe(false);
  });
});

describe("isRangeAvailable", () => {
  const occupied = [
    { startAt: new Date("2026-03-01"), endAt: new Date("2026-03-05") },
    { startAt: new Date("2026-03-10"), endAt: new Date("2026-03-12") },
  ];

  it("returns true when no occupied slot overlaps", () => {
    expect(
      isRangeAvailable({ startAt: new Date("2026-03-06"), endAt: new Date("2026-03-09") }, occupied),
    ).toBe(true);
  });

  it("returns false when the requested range overlaps any occupied slot", () => {
    expect(
      isRangeAvailable({ startAt: new Date("2026-03-04"), endAt: new Date("2026-03-06") }, occupied),
    ).toBe(false);
  });

  it("returns true for an empty occupied list", () => {
    expect(isRangeAvailable({ startAt: new Date("2026-03-01"), endAt: new Date("2026-03-02") }, [])).toBe(
      true,
    );
  });

  it("rejects a range where end is not after start", () => {
    expect(() =>
      isRangeAvailable({ startAt: new Date("2026-03-02"), endAt: new Date("2026-03-01") }, []),
    ).toThrow();
  });
});

describe("nightsBetween", () => {
  it("computes whole nights for a multi-night stay", () => {
    expect(nightsBetween(new Date("2026-01-01"), new Date("2026-01-04"))).toBe(3);
  });

  it("throws when checkout is not after checkin", () => {
    expect(() => nightsBetween(new Date("2026-01-04"), new Date("2026-01-01"))).toThrow();
    expect(() => nightsBetween(new Date("2026-01-01"), new Date("2026-01-01"))).toThrow();
  });
});

describe("hoursBetween", () => {
  it("rounds up a partial hour to a full hour", () => {
    expect(hoursBetween(new Date("2026-01-01T10:00:00"), new Date("2026-01-01T12:30:00"))).toBe(3);
  });

  it("throws when end is not after start", () => {
    expect(() => hoursBetween(new Date("2026-01-01T12:00:00"), new Date("2026-01-01T10:00:00"))).toThrow();
  });
});
