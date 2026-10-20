import crypto from "node:crypto";
import type { PaymentStatus } from "@prisma/client";
import type { PaymentProvider } from "./types";

// https://documenter.getpostman.com/view/7907941/2s93JusNJt
const payCurrency: Record<string, string> = {
  "USDT:TRC20": "usdttrc20",
  "USDT:ERC20": "usdterc20",
  "USDC:ERC20": "usdc",
  "USDC:POLYGON": "usdcmatic",
};

const statusMap: Record<string, PaymentStatus> = {
  waiting: "PENDING",
  confirming: "CONFIRMING",
  sending: "CONFIRMING",
  confirmed: "CONFIRMED",
  finished: "CONFIRMED",
  partially_paid: "PARTIAL",
  failed: "FAILED",
  refunded: "FAILED",
  expired: "EXPIRED",
};

export function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as object)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

// Returns the parsed body when the HMAC-SHA512 signature over the key-sorted JSON matches, otherwise null.
export function verifyNowPaymentsSignature(rawBody: string, signature: string | null, secret: string): Record<string, unknown> | null {
  if (!signature) return null;
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const expected = crypto.createHmac("sha512", secret).update(JSON.stringify(sortKeys(body))).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? body : null;
}

export function nowPaymentsProvider(): PaymentProvider {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!apiKey || !ipnSecret) throw new Error("NOWPAYMENTS_API_KEY and NOWPAYMENTS_IPN_SECRET are required");
  const base = process.env.NOWPAYMENTS_SANDBOX === "true" ? "https://api-sandbox.nowpayments.io/v1" : "https://api.nowpayments.io/v1";

  return {
    name: "nowpayments",
    async createInvoice(input) {
      const currency = payCurrency[`${input.currency}:${input.network}`];
      if (!currency) throw new Error(`Unsupported currency ${input.currency} on ${input.network}`);
      const res = await fetch(`${base}/payment`, {
        method: "POST",
        headers: { "x-api-key": apiKey, "content-type": "application/json" },
        body: JSON.stringify({
          price_amount: input.amountUsd,
          price_currency: "usd",
          pay_currency: currency,
          order_id: input.paymentId,
          order_description: input.description,
          ipn_callback_url: input.callbackUrl,
        }),
      });
      if (!res.ok) throw new Error(`NOWPayments error ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return {
        providerRef: String(data.payment_id),
        payAddress: data.pay_address,
        payAmount: String(data.pay_amount),
        expiresAt: data.expiration_estimate_date ? new Date(data.expiration_estimate_date) : null,
      };
    },
    async parseWebhook(rawBody, headers) {
      const body = verifyNowPaymentsSignature(rawBody, headers.get("x-nowpayments-sig"), ipnSecret);
      if (!body) return null;
      const status = statusMap[String(body.payment_status)];
      if (!status) return null;
      const payAmount = Number(body.pay_amount);
      const actuallyPaid = Number(body.actually_paid);
      return {
        providerRef: String(body.payment_id),
        status,
        orderId: body.order_id ? String(body.order_id) : undefined,
        priceAmountUsd: Number(body.price_amount),
        fullyPaid: Number.isFinite(payAmount) && Number.isFinite(actuallyPaid) ? actuallyPaid >= payAmount * 0.995 : undefined,
      };
    },
  };
}
