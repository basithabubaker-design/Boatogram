"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createBookingSchema, cancelBookingSchema } from "@/lib/validation/booking";
import { createBooking, cancelBooking, BookingError } from "@/lib/services/booking-service";
import { config } from "@/lib/config";

export type CreateBookingResult =
  | { error: string }
  | {
      bookingId: string;
      bookingNumber: string;
      orderId: string;
      amount: number;
      currency: string;
      keyId: string;
    };

export async function createBookingAction(input: {
  boatId: string;
  bookingType: "OVERNIGHT" | "SHIKARA_HOURLY";
  startAt: string;
  endAt: string;
  guests: number;
}): Promise<CreateBookingResult> {
  const user = await requireUser();
  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid booking details" };
  }

  try {
    const { booking, order } = await createBooking(user.id, parsed.data);
    return {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      orderId: order.orderId,
      amount: order.amountPaise,
      currency: order.currency,
      keyId: config.razorpay.keyId,
    };
  } catch (error) {
    if (error instanceof BookingError) return { error: error.message };
    throw error;
  }
}

export type ActionState = { error?: string; success?: boolean } | undefined;

export async function cancelBookingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = cancelBookingSchema.safeParse({
    bookingId: formData.get("bookingId"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await cancelBooking({
      bookingId: parsed.data.bookingId,
      actingUserId: user.id,
      actingRole: user.role,
      reason: parsed.data.reason,
    });
    revalidatePath("/dashboard");
    revalidatePath("/owner");
    revalidatePath(`/dashboard/bookings/${parsed.data.bookingId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof BookingError) return { error: error.message };
    throw error;
  }
}
