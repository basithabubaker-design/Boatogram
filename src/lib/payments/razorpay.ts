import crypto from "node:crypto";
import Razorpay from "razorpay";
import { config } from "@/lib/config";
import {
  PaymentProviderNotConfiguredError,
  type CreateOrderParams,
  type CreateOrderResult,
  type CreateRefundParams,
  type CreateRefundResult,
  type CreateTransferParams,
  type CreateTransferResult,
  type EnsureLinkedAccountParams,
  type EnsureLinkedAccountResult,
  type PaymentProvider,
  type VerifyCheckoutParams,
} from "@/lib/payments/provider";

export class RazorpayProvider implements PaymentProvider {
  readonly name = "Razorpay";

  get isConfigured(): boolean {
    return config.razorpay.isConfigured;
  }

  private get client(): Razorpay {
    if (!this.isConfigured) {
      throw new PaymentProviderNotConfiguredError(this.name);
    }
    return new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  }

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const order = await this.client.orders.create({
      amount: params.amountPaise,
      currency: params.currency,
      receipt: params.receipt,
      notes: params.notes,
    });
    return {
      orderId: order.id,
      amountPaise: Number(order.amount),
      currency: order.currency,
      raw: order,
    };
  }

  verifyCheckoutSignature({ orderId, paymentId, signature }: VerifyCheckoutParams): boolean {
    if (!this.isConfigured) {
      throw new PaymentProviderNotConfiguredError(this.name);
    }
    const expected = crypto
      .createHmac("sha256", config.razorpay.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    return timingSafeEqualHex(expected, signature);
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!config.razorpay.webhookSecret) {
      throw new PaymentProviderNotConfiguredError(`${this.name} webhook`);
    }
    const expected = crypto
      .createHmac("sha256", config.razorpay.webhookSecret)
      .update(rawBody)
      .digest("hex");
    return timingSafeEqualHex(expected, signature);
  }

  async createTransfer(params: CreateTransferParams): Promise<CreateTransferResult> {
    // Route transfers linked to a specific captured payment (rather than a
    // standalone balance transfer) go through POST /payments/:id/transfers,
    // which the SDK does not wrap with a dedicated method — call the
    // underlying API client directly.
    const result = await this.client.api.post<
      { transfers: Array<{ account: string; amount: number; currency: string; notes?: Record<string, string> }> },
      { items: Array<{ id: string }> }
    >({
      url: `payments/${params.paymentId}/transfers`,
      data: {
        transfers: [
          {
            account: params.ownerAccountId,
            amount: params.amountPaise,
            currency: params.currency,
            notes: params.notes,
          },
        ],
      },
    });
    const transfer = result.items[0];
    return { transferId: transfer.id, raw: result };
  }

  async createRefund(params: CreateRefundParams): Promise<CreateRefundResult> {
    const refund = await this.client.payments.refund(params.paymentId, {
      amount: params.amountPaise,
      notes: params.notes,
      speed: "normal",
    });
    return { refundId: refund.id, raw: refund };
  }

  async ensureLinkedAccount(
    params: EnsureLinkedAccountParams,
  ): Promise<EnsureLinkedAccountResult> {
    const account = await this.client.accounts.create({
      email: params.email,
      phone: params.phone,
      type: "route",
      reference_id: params.ownerProfileId,
      legal_business_name: params.legalBusinessName,
      business_type: "individual",
      contact_name: params.beneficiaryName,
      profile: {
        category: "tours_and_travel",
        subcategory: "travel_agency",
      },
      legal_info: {
        pan: params.panNumber,
      },
    } as never);
    return { accountId: (account as { id: string }).id, raw: account };
  }
}

function timingSafeEqualHex(expectedHex: string, actualHex: string): boolean {
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}
