import type { PaymentStatus } from "@prisma/client";
import { audit } from "../audit";
import { appUrl, type CheckoutOption } from "../config";
import { db } from "../db";
import { grantSubscription } from "../subscriptions";
import { mockProvider } from "./mock";
import { nowPaymentsProvider } from "./nowpayments";
import type { PaymentProvider } from "./types";

export function getProvider(name = process.env.PAYMENT_PROVIDER ?? "mock"): PaymentProvider {
  if (name === "nowpayments") return nowPaymentsProvider();
  if (name === "mock") {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_PAYMENTS !== "true") {
      throw new Error("The mock payment provider is disabled in production");
    }
    return mockProvider;
  }
  throw new Error(`Unknown payment provider: ${name}`);
}

export async function createCheckout(userId: string, planId: string, option: CheckoutOption) {
  const plan = await db.plan.findUniqueOrThrow({ where: { id: planId } });
  if (!plan.active || plan.priceCents <= 0) throw new Error("Plan is not purchasable");
  const provider = getProvider();
  const payment = await db.payment.create({
    data: { userId, planId, amountCents: plan.priceCents, currency: option.currency, network: option.network, provider: provider.name },
  });
  const invoice = await provider.createInvoice({
    paymentId: payment.id,
    amountUsd: plan.priceCents / 100,
    currency: option.currency,
    network: option.network,
    description: `${plan.name} — ${plan.intervalDays} days`,
    callbackUrl: `${appUrl}/api/payments/webhook/${provider.name}`,
  });
  return db.payment.update({ where: { id: payment.id }, data: invoice });
}

// Idempotent: a payment grants its subscription exactly once, on the first transition to CONFIRMED.
export async function applyPaymentStatus(provider: string, providerRef: string, status: PaymentStatus) {
  const payment = await db.payment.findUnique({ where: { provider_providerRef: { provider, providerRef } }, include: { plan: true } });
  if (!payment || payment.status === "CONFIRMED") return payment;

  if (status !== "CONFIRMED") {
    return db.payment.update({ where: { id: payment.id }, data: { status } });
  }

  const claimed = await db.payment.updateMany({
    where: { id: payment.id, status: { not: "CONFIRMED" } },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });
  if (claimed.count === 1) {
    await grantSubscription(payment.userId, payment.planId, payment.plan.intervalDays, "payment");
    await audit(null, "payment.confirmed", payment.id, { provider, providerRef, amountCents: payment.amountCents });
  }
  return db.payment.findUnique({ where: { id: payment.id } });
}
