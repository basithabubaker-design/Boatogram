import { RazorpayProvider } from "@/lib/payments/razorpay";
import type { PaymentProvider } from "@/lib/payments/provider";

export * from "@/lib/payments/provider";

let provider: PaymentProvider | undefined;

/** Returns the configured payment provider singleton. Swap the concrete
 * class here to change providers app-wide. */
export function getPaymentProvider(): PaymentProvider {
  if (!provider) {
    provider = new RazorpayProvider();
  }
  return provider;
}
