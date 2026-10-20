"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth";
import { checkoutOptions, walletEnabled } from "@/lib/config";
import { db } from "@/lib/db";
import { createTopup, paymentsReady, reconcilePayment } from "@/lib/payments";
import { decimal } from "@/lib/payments/validation";
import { rateLimit } from "@/lib/rate-limit";
import type { FormState } from "./auth";

export async function startTopup(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!walletEnabled || user.walletFrozen) return { error: "Wallet top-ups are currently unavailable." };
  if (!user.emailVerifiedAt) return { error: "Please verify your email before adding funds." };
  if (!await rateLimit(`topup:${user.id}`, 10, 3600000)) return { error: "Too many attempts. Please try again later." };
  const option = checkoutOptions[Number(form.get("option"))];
  const input = String(form.get("amount") ?? "");
  const amount = /^\d{1,4}(\.\d{1,2})?$/.test(input) ? decimal(input)?.times(100) : null;
  if (!amount?.isInteger() || amount.lt(2000) || amount.gt(100000)) return { error: "Choose an amount from $20 to $1,000, with up to two decimal places." };
  if (!option || !paymentsReady(option)) return { error: "This network is not configured yet." };
  let id: string;
  try { id = (await createTopup(user.id, amount.toNumber(), option)).id; }
  catch { return { error: "Unable to create this payment. The provider may require a higher minimum; please try another amount or network." }; }
  redirect(`/checkout/pay/${id}`);
}

export async function buyWithWallet(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!walletEnabled) return { error: "Wallet payments are not yet enabled." };
  if (!await rateLimit(`wallet-buy:${user.id}`, 20, 60000)) return { error: "Please wait a minute and try again." };
  const parsed = z.object({ planId: z.string().min(1).max(100), requestKey: z.string().uuid(), priceCents: z.coerce.number().int().positive().max(10000000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Please reload this page and try again." };
  const { planId, requestKey, priceCents } = parsed.data;
  let result: string;
  try {
    const rows = await db.$queryRaw<{ result: string }[]>`SELECT wallet_buy_plan(${user.id}, ${planId}, ${priceCents}::integer, ${requestKey}) AS result`;
    result = rows[0].result;
  } catch { return { error: "Your purchase could not be completed. Please try again." }; }
  const errors: Record<string, string> = {
    insufficient: "Your balance is too low. Add funds to your wallet first.",
    frozen: "Your wallet is under review. Please contact support.",
    unverified: "Please verify your email before purchasing.",
    price_changed: "This plan or its price changed. Reload the page before purchasing.",
  };
  if (result !== "purchased" && result !== "duplicate") return { error: errors[result] ?? "Please try again." };
  revalidatePath("/wallet"); revalidatePath("/dashboard"); revalidatePath("/account");
  redirect("/dashboard?walletPurchase=1");
}

export async function refreshMyPayment(form: FormData) {
  const user = await requireUser();
  const payment = await db.payment.findFirst({ where: { id: String(form.get("id")), userId: user.id } });
  if (!payment || !await rateLimit(`payment-refresh:${payment.id}`, 3, 60000)) return;
  try { await reconcilePayment(payment, "user-refresh"); }
  catch { redirect(`/checkout/pay/${payment.id}?refresh=unavailable`); }
  revalidatePath(`/checkout/pay/${payment.id}`); revalidatePath("/wallet");
}

export async function refreshAdminPayment(form: FormData) {
  await requireAdmin();
  const payment = await db.payment.findUnique({ where: { id: String(form.get("id")) } });
  if (!payment || !await rateLimit(`payment-refresh:${payment.id}`, 3, 60000)) return;
  try { await reconcilePayment(payment, "admin-refresh"); }
  catch { redirect(`/admin/payments/${payment.id}?refresh=unavailable`); }
  revalidatePath(`/admin/payments/${payment.id}`); revalidatePath("/admin/wallet");
}
