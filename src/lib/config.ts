function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  auth: {
    secret: process.env.AUTH_SECRET ?? "",
    sessionCookieName: "boatogram_session",
    sessionTtlSeconds: 60 * 60 * 24 * 30, // 30 days
  },
  platform: {
    /** Percentage (0-100) of every booking retained as platform commission. */
    commissionPercent: readIntEnv("PLATFORM_COMMISSION_PERCENT", 15),
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? "",
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
    get isConfigured() {
      return Boolean(this.keyId && this.keySecret);
    },
  },
  notifications: {
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    fromEmail: process.env.NOTIFICATION_FROM_EMAIL ?? "Boatogram <notifications@boatogram.example>",
    get emailConfigured() {
      return Boolean(this.resendApiKey);
    },
  },
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

/** Default cancellation policy tiers, used to seed the platform default policy. */
export const DEFAULT_CANCELLATION_TIERS = [
  { minDaysBefore: 7, refundPercent: 90 },
  { minDaysBefore: 3, refundPercent: 75 },
  { minDaysBefore: 1, refundPercent: 50 },
  { minDaysBefore: 0, refundPercent: 0 },
];
