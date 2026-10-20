"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { checkoutOptions } from "@/lib/config";
import { db } from "@/lib/db";
import { applyPaymentStatus, createCheckout, mockPaymentsAllowed, paymentsReady } from "@/lib/payments";
import { rateLimit } from "@/lib/rate-limit";
import type { FormState } from "./auth";

export async function startCheckout(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user.emailVerifiedAt) return { error: "Please confirm your email address first. You'll find the link on your dashboard." };
  if (!await rateLimit(`checkout:${user.id}`, 10, 60 * 60 * 1000)) return { error: "Too many payment attempts. Please try again later." };
  const plan = await db.plan.findUnique({ where: { slug: String(form.get("plan")) } });
  const option = checkoutOptions[Number(form.get("option"))];
  if (!plan || !option) return { error: "Please choose a coin and network." };
  if (!paymentsReady(option)) return { error: "Payments on this network are not available yet. Please choose another option." };
  let paymentId: string;
  try {
    paymentId = (await createCheckout(user.id, plan.id, option)).id;
  } catch (err) {
    console.error(err);
    return { error: "We couldn't create your payment right now. Please try again." };
  }
  redirect(`/checkout/pay/${paymentId}`);
}

// Available only in development or in the explicitly enabled, isolated staging environment.
export async function simulatePayment(form: FormData) {
  const user = await requireUser();
  if (!mockPaymentsAllowed()) return;
  const payment = await db.payment.findFirst({ where: { id: String(form.get("id")), userId: user.id, provider: "mock" } });
  if (!payment?.providerRef) return;
  await applyPaymentStatus("mock", { providerRef: payment.providerRef, status: "CONFIRMED", providerStatus: "finished",
    receivedAmount: payment.payAmount ?? "0", outcomeAmount: payment.payAmount ?? "0", outcomeCurrency: payment.currency,
    payinHash: "simulation", payoutHash: "simulation" }, "local-simulation");
  redirect(`/checkout/pay/${payment.id}`);
}
