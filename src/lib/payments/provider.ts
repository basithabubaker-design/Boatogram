/**
 * Payment provider abstraction.
 *
 * Boatogram is built against Razorpay Route for marketplace split
 * settlements, but all call sites depend on this interface rather than the
 * Razorpay SDK directly, so a different provider (or a test double) can be
 * swapped in without touching booking/webhook logic.
 *
 * When RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set, `isConfigured` is
 * false and every method throws PaymentProviderNotConfiguredError instead of
 * silently faking a successful payment — the booking flow surfaces this as
 * a clear "payments not configured" error to the caller.
 */

export class PaymentProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(
      `${provider} is not configured. Set the required environment variables (see .env.example) to enable payments.`,
    );
    this.name = "PaymentProviderNotConfiguredError";
  }
}

export type CreateOrderParams = {
  /** Amount in the smallest currency unit (paise for INR). */
  amountPaise: number;
  currency: string;
  /** Our internal booking number, surfaced to the merchant dashboard. */
  receipt: string;
  notes?: Record<string, string>;
};

export type CreateOrderResult = {
  orderId: string;
  amountPaise: number;
  currency: string;
  raw: unknown;
};

export type VerifyCheckoutParams = {
  orderId: string;
  paymentId: string;
  signature: string;
};

export type CreateTransferParams = {
  paymentId: string;
  ownerAccountId: string;
  amountPaise: number;
  currency: string;
  notes?: Record<string, string>;
};

export type CreateTransferResult = {
  transferId: string;
  raw: unknown;
};

export type CreateRefundParams = {
  paymentId: string;
  amountPaise: number;
  notes?: Record<string, string>;
};

export type CreateRefundResult = {
  refundId: string;
  raw: unknown;
};

export type EnsureLinkedAccountParams = {
  ownerProfileId: string;
  email: string;
  phone: string;
  legalBusinessName: string;
  panNumber: string;
  beneficiaryName: string;
  accountNumber: string;
  ifscCode: string;
};

export type EnsureLinkedAccountResult = {
  accountId: string;
  raw: unknown;
};

export interface PaymentProvider {
  readonly name: string;
  readonly isConfigured: boolean;

  createOrder(params: CreateOrderParams): Promise<CreateOrderResult>;

  /** Verifies the signature returned by Razorpay Checkout on the client after a successful payment. */
  verifyCheckoutSignature(params: VerifyCheckoutParams): boolean;

  /** Verifies the `X-Razorpay-Signature` header on an incoming webhook request against the raw body. */
  verifyWebhookSignature(rawBody: string, signature: string): boolean;

  /** Creates a Razorpay Route transfer moving the owner's share to their linked account. */
  createTransfer(params: CreateTransferParams): Promise<CreateTransferResult>;

  /** Issues a refund against a captured payment. */
  createRefund(params: CreateRefundParams): Promise<CreateRefundResult>;

  /**
   * Creates (or would create) the Razorpay Route linked account used as the
   * transfer destination for an approved owner. Razorpay's own onboarding
   * for linked accounts additionally requires stakeholder KYC and product
   * configuration on their dashboard/API before transfers can succeed in
   * live mode — this call covers account creation only.
   */
  ensureLinkedAccount(params: EnsureLinkedAccountParams): Promise<EnsureLinkedAccountResult>;
}
