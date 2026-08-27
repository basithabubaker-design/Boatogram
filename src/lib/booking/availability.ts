/**
 * Pure availability/overlap logic shared by the search page, booking
 * creation flow, and tests. Two half-open intervals [start, end) overlap iff
 * start < otherEnd && end > otherStart. Using half-open intervals means a
 * booking ending at 14:00 does not conflict with one starting at 14:00,
 * matching standard checkout/checkin semantics.
 */

export type Interval = {
  startAt: Date;
  endAt: Date;
};

export function intervalsOverlap(a: Interval, b: Interval): boolean {
  return a.startAt.getTime() < b.endAt.getTime() && a.endAt.getTime() > b.startAt.getTime();
}

/**
 * Returns true if the requested interval is free given a list of already
 * occupied intervals (confirmed/pending bookings and owner blackout blocks).
 */
export function isRangeAvailable(requested: Interval, occupied: Interval[]): boolean {
  if (requested.endAt.getTime() <= requested.startAt.getTime()) {
    throw new Error("Requested interval end must be after start");
  }
  return !occupied.some((slot) => intervalsOverlap(requested, slot));
}

export function nightsBetween(startAt: Date, endAt: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const nights = Math.round((endAt.getTime() - startAt.getTime()) / msPerDay);
  if (nights <= 0) {
    throw new Error("Check-out date must be after check-in date");
  }
  return nights;
}

export function hoursBetween(startAt: Date, endAt: Date): number {
  const msPerHour = 60 * 60 * 1000;
  const hours = Math.ceil((endAt.getTime() - startAt.getTime()) / msPerHour);
  if (hours <= 0) {
    throw new Error("End time must be after start time");
  }
  return hours;
}
