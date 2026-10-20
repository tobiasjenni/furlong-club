import type { PaymentStatus } from "@prisma/client";

export type CreateInvoiceInput = {
  paymentId: string;
  amountUsd: number;
  currency: string; // USDT | USDC
  network: string; // TRC20 | ERC20 | POLYGON
  description: string;
  callbackUrl: string;
  poolAddress?: string;
};

export type Invoice = {
  providerRef: string;
  payAddress: string;
  payAmount: string;
  expiresAt: Date | null;
};

export type WebhookEvent = {
  providerRef: string;
  status: PaymentStatus;
  orderId?: string; // our Payment.id, echoed back by the provider
  priceAmountUsd?: number; // invoice price the provider says was paid for
  fullyPaid?: boolean; // false when the provider reports less crypto received than invoiced
  providerStatus?: string;
  priceAmount?: string;
  priceCurrency?: string;
  payCurrency?: string;
  payAddress?: string;
  quotedAmount?: string;
  receivedAmount?: string;
  outcomeAmount?: string;
  outcomeCurrency?: string;
  payoutAddress?: string;
  payinHash?: string;
  payoutHash?: string;
  updatedAt?: string;
};

// Every crypto processor (NOWPayments, Coinbase Commerce, a self-hosted gateway, ...) is wrapped in this interface,
// so the rest of the app never talks to a provider directly.
export interface PaymentProvider {
  readonly name: string;
  createInvoice(input: CreateInvoiceInput): Promise<Invoice>;
  // Returns null when the signature is invalid or the event is not about a payment.
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent | null>;
  getPayment?(providerRef: string): Promise<WebhookEvent>;
}
