import crypto from "node:crypto";
import type { CheckoutOption } from "./config";
import { db } from "./db";
import { walletTestMode } from "./environment";
import { paymentsReady, poolAddress } from "./payments";

export const manualDepositsEnabled = process.env.DEPOSIT_MODE === "manual";

export function depositAddress(option: CheckoutOption): string | null {
  // Staging never displays a usable real deposit address.
  if (walletTestMode()) return option.network === "POLYGON" ? null : `TEST_ONLY_${option.network}_DO_NOT_SEND_FUNDS`;
  try { return poolAddress(option); } catch { return null; }
}

export function depositsReady(option: CheckoutOption) {
  return manualDepositsEnabled ? Boolean(depositAddress(option)) : paymentsReady(option);
}

export async function createManualDeposit(userId: string, cents: number, option: CheckoutOption) {
  const address = depositAddress(option);
  if (!manualDepositsEnabled || !address) throw new Error("Deposits unavailable");
  const id = crypto.randomUUID();
  const rows = await db.$queryRaw<{ result: string }[]>`SELECT wallet_create_manual_deposit(${userId},${id},${cents}::integer,${option.currency},${option.network},${address}) AS result`;
  return { id, result: rows[0].result };
}

export function manualDepositLabel(status: string, providerStatus: string | null) {
  if (status === "CONFIRMED") return "Credited";
  if (status === "CONFIRMING") return "Awaiting admin approval";
  if (providerStatus === "admin_rejected") return "Not approved";
  if (providerStatus === "cancelled") return "Cancelled";
  return "Awaiting your transfer";
}

export function transactionUrl(network: string, hash: string | null) {
  if (!hash || !/^(0x)?[a-fA-F0-9]{64}$/.test(hash)) return null;
  const raw = hash.replace(/^0x/i, "");
  return network === "TRC20" ? `https://tronscan.org/#/transaction/${raw}`
    : `https://${network === "POLYGON" ? "polygonscan.com" : "etherscan.io"}/tx/0x${raw}`;
}
