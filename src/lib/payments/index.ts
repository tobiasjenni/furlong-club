import crypto from "node:crypto";
import { appUrl, type CheckoutOption } from "../config";
import { db } from "../db";
import { mockProvider } from "./mock";
import { nowPaymentsProvider } from "./nowpayments";
import type { PaymentProvider, WebhookEvent } from "./types";
import { validatePaymentEvent } from "./validation";

export function mockPaymentsAllowed() { return process.env.NODE_ENV !== "production"; }

export function getProvider(name = process.env.PAYMENT_PROVIDER ?? "mock"): PaymentProvider {
  if (name === "nowpayments") return nowPaymentsProvider();
  if (name === "mock" && mockPaymentsAllowed()) return mockProvider;
  throw new Error("Payment provider is not available");
}

export function poolAddress(option: { currency: string; network: string }) {
  const value = process.env[`POOL_WALLET_${option.currency}_${option.network}`]?.trim();
  if (!value) return null;
  const valid = option.network === "TRC20" ? /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value) : /^0x[\da-fA-F]{40}$/.test(value) && !/^0x0{40}$/.test(value);
  if (!valid) throw new Error("Invalid pooled wallet address");
  return value;
}

export function paymentsReady(option: CheckoutOption) {
  if ((process.env.PAYMENT_PROVIDER ?? "mock") === "mock") return mockPaymentsAllowed();
  try { return Boolean(process.env.PAYMENT_PROVIDER === "nowpayments" && process.env.NOWPAYMENTS_API_KEY && process.env.NOWPAYMENTS_IPN_SECRET && poolAddress(option)); }
  catch { return false; }
}

async function invoice(userId: string, option: CheckoutOption, amountCents: number, plan?: { id: string; name: string; intervalDays: number }) {
  if (!paymentsReady(option)) throw new Error("Payments are not configured for this network");
  const provider = getProvider();
  const pool = provider.name === "mock" ? null : poolAddress(option);
  const payment = await db.payment.create({ data: {
    userId, planId: plan?.id, planName: plan?.name, planDays: plan?.intervalDays,
    purpose: plan ? "SUBSCRIPTION" : "WALLET_TOPUP", amountCents,
    currency: option.currency, network: option.network, provider: provider.name,
    poolAddress: pool, settlementStatus: "PENDING",
  } });
  try {
    const created = await provider.createInvoice({
      paymentId: payment.id, amountUsd: amountCents / 100, currency: option.currency, network: option.network,
      description: plan ? `${plan.name} — ${plan.intervalDays} days` : "Furlong Club wallet top-up",
      callbackUrl: `${appUrl}/api/payments/webhook/${provider.name}`, poolAddress: pool ?? undefined,
    });
    return await db.payment.update({ where: { id: payment.id }, data: created });
  } catch (err) {
    await db.payment.updateMany({ where: { id: payment.id, status: "PENDING", providerRef: null }, data: { status: "FAILED" } });
    throw err;
  }
}

export async function createCheckout(userId: string, planId: string, option: CheckoutOption) {
  const plan = await db.plan.findUniqueOrThrow({ where: { id: planId } });
  if (!plan.active || plan.priceCents <= 0) throw new Error("Plan is not purchasable");
  return invoice(userId, option, plan.priceCents, plan);
}

export async function createTopup(userId: string, amountCents: number, option: CheckoutOption) {
  if (!Number.isInteger(amountCents) || amountCents < 2000 || amountCents > 100000) throw new Error("Top-up must be between $20 and $1,000");
  return invoice(userId, option, amountCents);
}

// Event receipt, credit, ledger and membership all commit or roll back in a single DB statement.
export async function applyPaymentStatus(provider: string, event: WebhookEvent, source = "webhook") {
  const payment = await db.payment.findUnique({ where: { provider_providerRef: { provider, providerRef: event.providerRef } } });
  if (!payment) throw new Error("Payment invoice is not yet available; retry notification");
  let validationError: string | null;
  if (provider === "mock") {
    if (!mockPaymentsAllowed()) throw new Error("Mock payments are disabled");
    validationError = null;
  } else validationError = payment.status === "CONFIRMED" && payment.settlementStatus === "LEGACY" ? null : validatePaymentEvent(payment, event);
  const payload = JSON.stringify({ ...event, validationError });
  const key = crypto.createHash("sha256").update(payload).digest("hex");
  await db.$queryRaw`SELECT wallet_apply_payment(${payment.id}, ${key}, ${source}, ${payload}::jsonb)`;
  return db.payment.findUniqueOrThrow({ where: { id: payment.id } });
}

export async function reconcilePayment(payment: { provider: string; providerRef: string | null }, source = "reconcile") {
  if (!payment.providerRef) return;
  const provider = getProvider(payment.provider);
  if (!provider.getPayment) return;
  return applyPaymentStatus(payment.provider, await provider.getPayment(payment.providerRef), source);
}

export function expireStalePayments() {
  return db.payment.updateMany({ where: { status: "PENDING", expiresAt: { lt: new Date() } }, data: { status: "EXPIRED" } });
}

export async function reconcileRecentPayments() {
  const payments = await db.payment.findMany({ where: {
    provider: "nowpayments", providerRef: { not: null },
    createdAt: { gt: new Date(Date.now() - 30 * 86400000) },
  }, orderBy: [{ lastCheckedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }], take: 20 });
  let reconciled = 0;
  let failed = 0;
  for (let i = 0; i < payments.length; i += 5) {
    await Promise.all(payments.slice(i, i + 5).map(async payment => {
      try { await reconcilePayment(payment); reconciled++; }
      catch { failed++; console.error("Payment reconciliation failed", payment.id); }
    }));
  }
  return { reconciled, failed };
}
