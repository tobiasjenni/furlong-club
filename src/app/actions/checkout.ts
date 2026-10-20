"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { checkoutOptions } from "@/lib/config";
import { db } from "@/lib/db";
import { applyPaymentStatus, createCheckout } from "@/lib/payments";
import type { FormState } from "./auth";

export async function startCheckout(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const plan = await db.plan.findUnique({ where: { slug: String(form.get("plan")) } });
  const option = checkoutOptions[Number(form.get("option"))];
  if (!plan || !option) return { error: "Please choose a coin and network." };
  let paymentId: string;
  try {
    paymentId = (await createCheckout(user.id, plan.id, option)).id;
  } catch (err) {
    console.error(err);
    return { error: "We couldn't create your payment right now. Please try again." };
  }
  redirect(`/checkout/pay/${paymentId}`);
}

// Only available with the mock provider, to test the full flow locally.
export async function simulatePayment(form: FormData) {
  const user = await requireUser();
  const payment = await db.payment.findFirst({ where: { id: String(form.get("id")), userId: user.id, provider: "mock" } });
  if (!payment?.providerRef) return;
  await applyPaymentStatus("mock", payment.providerRef, "CONFIRMED");
  redirect(`/checkout/pay/${payment.id}`);
}
