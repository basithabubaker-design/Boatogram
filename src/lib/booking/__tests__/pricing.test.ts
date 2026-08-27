import { describe, expect, it } from "vitest";
import { calculateBookingPrice } from "@/lib/booking/pricing";

describe("calculateBookingPrice", () => {
  it("splits a simple booking 85/15", () => {
    const result = calculateBookingPrice({ unitPrice: 10_000_00, units: 1, commissionPercent: 15 });
    expect(result.subtotalAmount).toBe(10_000_00);
    expect(result.platformFeeAmount).toBe(1_500_00);
    expect(result.ownerAmount).toBe(8_500_00);
    expect(result.totalAmount).toBe(result.subtotalAmount);
  });

  it("multiplies unit price by units for multi-night bookings", () => {
    const result = calculateBookingPrice({ unitPrice: 5_000_00, units: 3, commissionPercent: 15 });
    expect(result.subtotalAmount).toBe(15_000_00);
    expect(result.platformFeeAmount).toBe(2_250_00);
    expect(result.ownerAmount).toBe(12_750_00);
  });

  it("always sums owner + platform amount to exactly the subtotal, even with rounding", () => {
    // 999 paise * 15% = 149.85, a case that would round unevenly if computed independently.
    const result = calculateBookingPrice({ unitPrice: 999, units: 1, commissionPercent: 15 });
    expect(result.platformFeeAmount + result.ownerAmount).toBe(result.subtotalAmount);
  });

  it("handles 0% commission (all to owner)", () => {
    const result = calculateBookingPrice({ unitPrice: 1000, units: 2, commissionPercent: 0 });
    expect(result.platformFeeAmount).toBe(0);
    expect(result.ownerAmount).toBe(2000);
  });

  it("handles 100% commission (all to platform)", () => {
    const result = calculateBookingPrice({ unitPrice: 1000, units: 2, commissionPercent: 100 });
    expect(result.platformFeeAmount).toBe(2000);
    expect(result.ownerAmount).toBe(0);
  });

  it("rejects a negative unit price", () => {
    expect(() => calculateBookingPrice({ unitPrice: -1, units: 1, commissionPercent: 15 })).toThrow();
  });

  it("rejects zero or fractional units", () => {
    expect(() => calculateBookingPrice({ unitPrice: 100, units: 0, commissionPercent: 15 })).toThrow();
    expect(() => calculateBookingPrice({ unitPrice: 100, units: 1.5, commissionPercent: 15 })).toThrow();
  });

  it("rejects an out-of-range commission percent", () => {
    expect(() => calculateBookingPrice({ unitPrice: 100, units: 1, commissionPercent: -1 })).toThrow();
    expect(() => calculateBookingPrice({ unitPrice: 100, units: 1, commissionPercent: 101 })).toThrow();
  });
});
