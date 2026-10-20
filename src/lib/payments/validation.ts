import { Prisma } from "@prisma/client";
import type { WebhookEvent } from "./types";
const ExactDecimal = Prisma.Decimal.clone({ precision: 60 });

export const providerCoins: Record<string, string> = {
  "USDT:TRC20": "usdttrc20", "USDT:ERC20": "usdterc20",
  "USDC:ERC20": "usdc", "USDC:POLYGON": "usdcmatic",
};

// Exact decimal quantities. Never use floating point arithmetic for crypto comparisons.
export function decimal(value: unknown): Prisma.Decimal | null {
  const text = typeof value === "number" || typeof value === "string" ? String(value) : "";
  if (!/^\d{1,18}(\.\d{1,18})?$/.test(text)) return null;
  return new ExactDecimal(text);
}

export function sameAddress(a: string, b: string, network: string) {
  return network === "TRC20" ? a === b : a.toLowerCase() === b.toLowerCase();
}

type PaymentIdentity = {
  id: string; providerRef: string | null; amountCents: number; currency: string; network: string;
  payAddress: string | null; payAmount: string | null; poolAddress: string | null;
};

export function validatePaymentEvent(p: PaymentIdentity, e: WebhookEvent): string | null {
  if (e.providerRef !== p.providerRef || e.orderId !== p.id) return "Payment reference mismatch";
  if (e.priceCurrency !== "usd" || !decimal(e.priceAmount)?.times(100).equals(p.amountCents)) return "Invoice USD price mismatch";
  const coin = providerCoins[`${p.currency}:${p.network}`];
  if (!coin || e.payCurrency !== coin) return "Token or network mismatch";
  if (!p.payAddress || !e.payAddress || !sameAddress(p.payAddress, e.payAddress, p.network)) return "Deposit address mismatch";
  const quoted = decimal(p.payAmount);
  if (!quoted?.gt(0) || !decimal(e.quotedAmount)?.equals(quoted)) return "Crypto quote mismatch";
  if (!decimal(e.receivedAmount)) return "Missing or invalid received amount";
  if (e.status === "CONFIRMED") {
    if (e.providerStatus !== "finished") return "Provider settlement is not finished";
    if (decimal(e.receivedAmount)!.lt(quoted)) return "Payment is below the quoted amount";
    if (!p.poolAddress) return "No pooled wallet was recorded";
    if (e.payoutAddress && !sameAddress(p.poolAddress, e.payoutAddress, p.network)) return "Pooled wallet mismatch";
    if (e.outcomeCurrency !== coin || !decimal(e.outcomeAmount)?.gt(0) || !e.payoutHash) return "Missing pooled-wallet settlement evidence";
  }
  return null;
}
