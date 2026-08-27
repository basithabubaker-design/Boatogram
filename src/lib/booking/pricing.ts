/**
 * Pure pricing/split calculations. All monetary amounts are integers in
 * paise (1 INR = 100 paise) to avoid floating point rounding issues.
 */

export type BookingPriceInput = {
  /** Price per night (overnight) or per hour (Shikara), in paise. */
  unitPrice: number;
  /** Number of nights or hours booked. */
  units: number;
  /** Platform commission percentage, 0-100. */
  commissionPercent: number;
};

export type BookingPriceBreakdown = {
  unitPrice: number;
  units: number;
  subtotalAmount: number;
  platformFeeAmount: number;
  ownerAmount: number;
  totalAmount: number;
};

/**
 * Splits a booking's subtotal into the platform commission and the owner's
 * payout. The owner amount is computed as the remainder (subtotal minus
 * platform fee) rather than independently rounded, so the two always sum
 * exactly to the subtotal regardless of rounding.
 */
export function calculateBookingPrice({
  unitPrice,
  units,
  commissionPercent,
}: BookingPriceInput): BookingPriceBreakdown {
  if (unitPrice < 0 || !Number.isFinite(unitPrice)) {
    throw new Error("unitPrice must be a non-negative finite number");
  }
  if (units <= 0 || !Number.isInteger(units)) {
    throw new Error("units must be a positive integer");
  }
  if (commissionPercent < 0 || commissionPercent > 100) {
    throw new Error("commissionPercent must be between 0 and 100");
  }

  const subtotalAmount = Math.round(unitPrice * units);
  const platformFeeAmount = Math.round((subtotalAmount * commissionPercent) / 100);
  const ownerAmount = subtotalAmount - platformFeeAmount;

  return {
    unitPrice,
    units,
    subtotalAmount,
    platformFeeAmount,
    ownerAmount,
    totalAmount: subtotalAmount,
  };
}
