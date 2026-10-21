"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth";
import { checkoutOptions, walletEnabled } from "@/lib/config";
import { db } from "@/lib/db";
import { createTopup, reconcilePayment } from "@/lib/payments";
import { decimal } from "@/lib/payments/validation";
import { rateLimit } from "@/lib/rate-limit";
import type { FormState } from "./auth";
import { createManualDeposit, depositsReady, manualDepositsEnabled } from "@/lib/manual-deposits";

export async function startTopup(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!walletEnabled || user.walletFrozen) return { error: "Wallet top-ups are currently unavailable." };
  if (!user.emailVerifiedAt) return { error: "Please verify your email before adding funds." };
  if (!await rateLimit(`topup:${user.id}`, 10, 3600000)) return { error: "Too many attempts. Please try again later." };
  const option = checkoutOptions[Number(form.get("option"))];
  const input = String(form.get("amount") ?? "");
  const amount = /^\d{1,5}(\.\d{1,2})?$/.test(input) ? decimal(input)?.times(100) : null;
  if (!amount?.isInteger() || amount.lt(2000) || amount.gt(1000000)) return { error: "Choose an amount from $20 to $10,000, with up to two decimal places." };
  if (!option || !depositsReady(option)) return { error: "This network is not configured yet." };
  let id: string;
  try {
    if (manualDepositsEnabled) {
      const created = await createManualDeposit(user.id, amount.toNumber(), option);
      if (created.result !== "created") return { error: created.result === "too_many_open" ? "You already have three open deposits. Finish or cancel one before creating another." : "Your account cannot create a deposit right now. Contact support." };
      id = created.id;
    } else id = (await createTopup(user.id, amount.toNumber(), option)).id;
  }
  catch { return { error: manualDepositsEnabled ? "Unable to create this deposit. Please try again shortly." : "Unable to create this payment. The provider may require a higher minimum; please try another amount or network." }; }
  redirect(form.get("experience") === "v2" ? `/v2/deposits/${id}` : `/checkout/pay/${id}`);
}

function refreshDepositPages(id: string, userId: string) {
  revalidatePath("/v2", "layout");
  for (const path of ["/wallet", "/dashboard", "/account", "/admin", "/admin/deposits", "/admin/wallet", "/admin/payments", `/checkout/pay/${id}`, `/admin/payments/${id}`, `/admin/users/${userId}`]) revalidatePath(path);
}

export async function reportManualDeposit(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!await rateLimit(`report-deposit:${user.id}`, 20, 3600000)) return { error: "Too many attempts. Please try again later." };
  const parsed = z.object({ id: z.string().min(1).max(100), transactionHash: z.string().trim().regex(/^(0x)?[a-fA-F0-9]{64}$/, "Enter the transaction ID from your sending wallet."), sent: z.literal("on") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter a valid transaction ID and confirm that you sent the payment." };
  const { id, transactionHash } = parsed.data;
  const rows = await db.$queryRaw<{ result: string }[]>`SELECT wallet_report_manual_deposit(${id},${user.id},${transactionHash}) AS result`;
  if (!["submitted", "duplicate"].includes(rows[0].result)) return { error: "This deposit cannot be submitted. Reload the page or contact support." };
  refreshDepositPages(id, user.id);
  return { ok: "Payment reported. An admin will verify it before your wallet is credited." };
}

export async function cancelManualDeposit(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "").slice(0, 100);
  const rows = await db.$queryRaw<{ result: string }[]>`SELECT wallet_cancel_manual_deposit(${id},${user.id}) AS result`;
  if (rows[0].result !== "cancelled") return { error: "This deposit can no longer be cancelled. Reload the page." };
  refreshDepositPages(id, user.id);
  redirect(form.get("experience") === "v2" ? "/v2/wallet" : "/wallet");
}

export async function reviewManualDeposit(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!await rateLimit(`review-deposit:${admin.id}`, 30, 60000)) return { error: "Please wait a minute before reviewing another deposit." };
  const parsed = z.object({ id: z.string().min(1).max(100), decision: z.enum(["approve", "reject"]), note: z.string().trim().min(5, "Add a review note of at least 5 characters.").max(1000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, decision, note } = parsed.data;
  const hash = String(form.get("transactionHash") ?? "").trim();
  if (decision === "approve" && (!/^(0x)?[a-fA-F0-9]{64}$/.test(hash) || form.get("verified") !== "on")) return { error: "Enter the verified transaction ID and confirm that the exact funds arrived and belong to this member." };
  const payment = await db.payment.findUnique({ where: { id }, select: { userId: true } });
  if (!payment) return { error: "Deposit not found." };
  let result: string;
  try {
    const rows = await db.$queryRaw<{ result: string }[]>`SELECT wallet_review_manual_deposit(${id},${admin.id},${decision === "approve"},${hash},${note}) AS result`;
    result = rows[0].result;
  } catch {
    return { error: "No credit was added. This transaction may already have been credited, or the review could not be saved. Check the payment trail before retrying." };
  }
  if (!["approved", "rejected", "already_approved"].includes(result)) return { error: result === "not_pending" ? "This deposit is not awaiting review. It may already have been rejected." : "This deposit cannot be reviewed. Reload the page." };
  refreshDepositPages(id, payment.userId);
  return { ok: result === "rejected" ? "Deposit rejected. No credit was added." : result === "already_approved" ? "Already approved. No additional credit was added." : "Deposit approved and wallet credited. The review is saved in the ledger." };
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
  revalidatePath("/v2", "layout");
  redirect(form.get("experience") === "v2" ? "/v2?walletPurchase=1" : "/dashboard?walletPurchase=1");
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
