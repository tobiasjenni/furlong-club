"use server";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { normalizePayoutAddress, tradingOptions, tradingRequestsEnabled, tradingTermsVersion } from "@/lib/trading";
import type { FormState } from "./auth";

function cents(input: FormDataEntryValue | null, signed = false) {
  const text = String(input ?? "");
  if (!(signed ? /^-?\d{1,7}(\.\d{1,2})?$/ : /^\d{1,7}(\.\d{1,2})?$/).test(text)) return null;
  const [whole, fraction = ""] = text.replace("-", "").split(".");
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return text.startsWith("-") ? -value : value;
}
function refresh(userId: string, id: string) {
  for (const path of ["/trading", "/account", "/wallet", "/dashboard", "/admin", "/admin/trading", "/admin/wallet", `/admin/trading/${id}`, `/admin/users/${userId}`]) revalidatePath(path);
}
const errors: Record<string, string> = {
  closed: "Trading allocations are not open. No funds were locked.", insufficient: "Available balance is too low. Add funds or choose a smaller allocation.",
  limit: "The maximum total open allocation is $10,000 per member.", pending_exists: "You already have a request awaiting approval. Cancel it before changing the amount or destination.",
  unverified: "Confirm your email before requesting an allocation.", frozen: "The wallet is under review. Contact support.", locked: "The 33-day lock has not ended.",
  not_pending: "This request is no longer awaiting approval. Reload to see its current status.", not_active: "This allocation is no longer awaiting a result.",
  not_ready: "This allocation is not ready for payout recording.", unavailable: "The member account is not eligible for approval.",
};

export async function requestTrading(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!tradingRequestsEnabled) return { error: errors.closed };
  if (!await rateLimit(`trading-request:${user.id}`, 10, 3600000)) return { error: "Please wait before requesting again." };
  const amount = cents(form.get("amount"));
  const option = tradingOptions[Number(form.get("option"))];
  const requestKey = String(form.get("requestKey") ?? "");
  if (amount === null || amount < 50000 || amount > 1000000 || !option || !/^[a-f0-9-]{36}$/i.test(requestKey)) return { error: "Choose $500–$10,000 and a supported payout network." };
  const address = normalizePayoutAddress(option.network, String(form.get("address") ?? ""));
  const repeat = normalizePayoutAddress(option.network, String(form.get("confirmAddress") ?? ""));
  if (!address || address !== repeat) return { error: "Enter the same valid external wallet address twice. Check the network and address checksum." };
  const clubAddress = process.env[`POOL_WALLET_${option.currency}_${option.network}`]?.trim();
  if (clubAddress && (option.network === "TRC20" ? clubAddress === address : clubAddress.toLowerCase() === address.toLowerCase())) return { error: "Use your own receiving wallet, not the club's deposit address." };
  if (form.get("termsVersion") !== tradingTermsVersion || form.get("risk") !== "on" || form.get("destinationConfirmed") !== "on") return { error: "Read and accept the current draft terms and confirm your payout destination." };
  let result: string;
  try { result = (await db.$queryRaw<{ result: string }[]>`SELECT trading_request(${user.id},${crypto.randomUUID()},${user.id + ":" + requestKey},${amount}::integer,${option.currency},${option.network},${address},${tradingTermsVersion}) AS result`)[0].result; }
  catch { return { error: "Your request could not be saved. No funds were locked. Reload before retrying." }; }
  if (!["requested", "duplicate"].includes(result)) return { error: errors[result] ?? "Unable to create this request. Reload and try again." };
  refresh(user.id, "");
  return { ok: "Request saved. Your money stays available until an admin approves. Approval starts the 33-day lock." };
}

export async function cancelTrading(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "").slice(0, 100);
  const result = (await db.$queryRaw<{ result: string }[]>`SELECT trading_cancel(${id},${user.id}) AS result`)[0].result;
  refresh(user.id, id);
  return result === "cancelled" ? { ok: "Request cancelled. No money was locked." } : { error: errors.not_pending };
}

export async function manageTrading(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!await rateLimit(`trading-manage:${admin.id}`, 30, 60000)) return { error: "Please wait a minute before trying again." };
  const id = String(form.get("id") ?? "").slice(0, 100);
  const operation = String(form.get("operation") ?? "");
  const note = String(form.get("note") ?? "").trim();
  if (note.length < 5 || note.length > 1000) return { error: "Add a note of 5–1,000 characters. This note is visible to the member." };
  if (form.get("verified") !== "on") return { error: "Confirm that you have verified this action." };
  const a = await db.tradingAllocation.findUnique({ where: { id }, select: { userId: true } });
  if (!a) return { error: "Allocation not found." };
  let result: string;
  try {
    if (operation === "approve" || operation === "reject") {
      if (operation === "approve" && !tradingRequestsEnabled) return { error: errors.closed };
      result = (await db.$queryRaw<{ result: string }[]>`SELECT trading_review(${id},${admin.id},${operation === "approve"},${note}) AS result`)[0].result;
    } else if (operation === "result") {
      const profit = cents(form.get("profit"), true);
      if (profit === null || profit < -1000000 || profit > 100000000) return { error: "Enter the actual net profit or loss to two decimal places. Use a minus sign for a loss." };
      result = (await db.$queryRaw<{ result: string }[]>`SELECT trading_record_result(${id},${admin.id},${profit}::integer,${note}) AS result`)[0].result;
    } else if (operation === "payout") {
      const amount = cents(form.get("payout"));
      const hash = String(form.get("transactionHash") ?? "").trim();
      if (amount === null || (amount > 0 && !/^(0x)?[a-fA-F0-9]{64}$/.test(hash))) return { error: "Enter the exact token amount and confirmed transaction ID, or zero with no transaction for a total loss." };
      result = (await db.$queryRaw<{ result: string }[]>`SELECT trading_record_payout(${id},${admin.id},${amount}::integer,${hash},${note}) AS result`)[0].result;
    } else return { error: "Choose a valid action." };
  } catch { return { error: "The action was rolled back. This transaction may already be recorded. Check the allocation history before retrying." }; }
  refresh(a.userId, id);
  return ["approved", "rejected", "recorded", "paid", "already_paid"].includes(result)
    ? { ok: ({ approved: "Approved. Funds are locked and the 33-day period has started.", rejected: "Request declined. No money was locked.", recorded: "Actual result saved. Manual payout is now due.", paid: "Payout or total-loss closure recorded. The ledger has been reconciled.", already_paid: "Already completed. No duplicate posting was created." } as Record<string, string>)[result] }
    : { error: errors[result] ?? "The action cannot be completed. Check the amount, note and current allocation status." };
}
