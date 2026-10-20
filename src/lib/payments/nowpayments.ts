import crypto from "node:crypto";
import { parse as parseLossless } from "lossless-json";
import type { PaymentStatus } from "@prisma/client";
import type { PaymentProvider } from "./types";
import type { WebhookEvent } from "./types";
import { decimal, providerCoins, sameAddress } from "./validation";

// https://documenter.getpostman.com/view/7907941/2s93JusNJt
const payCurrency = providerCoins;

const statusMap: Record<string, PaymentStatus> = {
  waiting: "PENDING",
  confirming: "CONFIRMING",
  sending: "CONFIRMING",
  confirmed: "CONFIRMING",
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
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  } catch {
    return null;
  }
  const expected = crypto.createHmac("sha512", secret).update(JSON.stringify(sortKeys(body))).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? body : null;
}

export function parseNowPayment(body: Record<string, unknown>): WebhookEvent | null {
  const status = Object.hasOwn(statusMap, String(body.payment_status)) ? statusMap[String(body.payment_status)] : undefined;
  if (!status || !/^\d+$/.test(String(body.payment_id))) return null;
  const amount = (v: unknown) => decimal(v)?.toFixed();
  const str = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 512 ? v : undefined;
  const updated = str(body.updated_at);
  return {
    providerRef: String(body.payment_id), status, providerStatus: String(body.payment_status),
    orderId: str(body.order_id), priceAmount: amount(body.price_amount), priceCurrency: str(body.price_currency)?.toLowerCase(),
    payCurrency: str(body.pay_currency)?.toLowerCase(), payAddress: str(body.pay_address),
    quotedAmount: amount(body.pay_amount), receivedAmount: amount(body.actually_paid),
    outcomeAmount: amount(body.outcome_amount), outcomeCurrency: str(body.outcome_currency)?.toLowerCase(),
    payoutAddress: str(body.payout_address), payinHash: str(body.payin_hash), payoutHash: str(body.payout_hash),
    updatedAt: updated && Number.isFinite(Date.parse(updated)) ? new Date(updated).toISOString() : undefined,
  };
}

export function parseProviderJson(text: string): Record<string, unknown> {
  const body = parseLossless(text, undefined, value => value);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid provider JSON");
  return body as Record<string, unknown>;
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
      if (!input.poolAddress) throw new Error("A pooled payout wallet is required");
      const available = await fetch(`${base}/currencies`, { headers: { "x-api-key": apiKey }, cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (!available.ok || !(await available.json()).currencies?.includes(currency)) throw new Error("This payment network is unavailable");
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
          payout_address: input.poolAddress,
          payout_currency: currency,
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`NOWPayments could not create this invoice (${res.status}); check account minimums and settings`);
      const data = parseProviderJson(await res.text());
      if (!/^\d+$/.test(String(data.payment_id)) || typeof data.pay_address !== "string" || !decimal(data.pay_amount)?.gt(0)) throw new Error("Invalid payment provider invoice");
      if (data.order_id !== input.paymentId || data.pay_currency !== currency || data.price_currency !== "usd" || !decimal(data.price_amount)?.equals(input.amountUsd)) throw new Error("Provider invoice identity mismatch");
      if (typeof data.payout_address === "string" && !sameAddress(input.poolAddress, data.payout_address, input.network)) throw new Error("Provider payout destination mismatch");
      return {
        providerRef: String(data.payment_id),
        payAddress: data.pay_address as string,
        payAmount: String(data.pay_amount),
        expiresAt: typeof data.expiration_estimate_date === "string" && Number.isFinite(Date.parse(data.expiration_estimate_date)) ? new Date(data.expiration_estimate_date) : null,
      };
    },
    async parseWebhook(rawBody, headers) {
      const body = verifyNowPaymentsSignature(rawBody, headers.get("x-nowpayments-sig"), ipnSecret);
      if (!body) return null;
      return parseNowPayment(parseProviderJson(rawBody));
    },
    async getPayment(providerRef) {
      if (!/^\d+$/.test(providerRef)) throw new Error("Invalid provider reference");
      const res = await fetch(`${base}/payment/${providerRef}`, { headers: { "x-api-key": apiKey }, cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`Payment status unavailable (${res.status})`);
      const event = parseNowPayment(parseProviderJson(await res.text()));
      if (!event || event.providerRef !== providerRef) throw new Error("Invalid payment status response");
      return event;
    },
  };
}
