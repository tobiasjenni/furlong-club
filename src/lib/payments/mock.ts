import crypto from "node:crypto";
import type { PaymentProvider } from "./types";

// Local-only provider: hands out a fake address and lets you confirm the payment from the checkout page.
export const mockProvider: PaymentProvider = {
  name: "mock",
  async createInvoice(input) {
    const prefix = input.network === "TRC20" ? "T" : "0x";
    return {
      providerRef: `mock_${input.paymentId}`,
      payAddress: prefix + crypto.randomBytes(20).toString("hex").slice(0, prefix === "T" ? 33 : 40),
      payAmount: input.amountUsd.toFixed(2),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  },
  async parseWebhook(rawBody) {
    const body = JSON.parse(rawBody);
    return body.providerRef && body.status ? { providerRef: body.providerRef, status: body.status } : null;
  },
};
