export { normalizePayoutAddress } from "./payout-address";

export const tradingTermsVersion = "lunar-v1-2026-10-23";
export const tradingRequestsEnabled = process.env.TRADING_REQUESTS_ENABLED === "true" && process.env.WALLET_ENABLED === "true";
export const tradingOptions = [
  { currency: "USDT", network: "TRC20", label: "USDT · Tron (TRC-20)" },
  { currency: "USDT", network: "ERC20", label: "USDT · Ethereum (ERC-20)" },
  { currency: "USDC", network: "ERC20", label: "USDC · Ethereum (ERC-20)" },
] as const;

export function tradingStatus(a: { status: string; unlocksAt: Date | null; payoutCents?: number | null; startsAt?: Date | null }, now = new Date()) {
  if (a.status === "ACTIVE" && a.startsAt && a.startsAt > now) return "Reserved · awaiting syndicate start";
  if (a.status === "ACTIVE") return a.unlocksAt && a.unlocksAt <= now ? "Lock ended · result review due" : "Locked";
  return ({ PENDING: "Awaiting admin approval", PAYOUT_READY: "Awaiting manual payout", PAID: a.payoutCents === 0 ? "Closed · total loss recorded" : "Payout recorded", REJECTED: "Declined", CANCELLED: "Cancelled" } as Record<string, string>)[a.status] ?? a.status;
}

export function lockRemaining(unlocksAt: Date | null, now = new Date(), startsAt?: Date | null) {
  if (startsAt && startsAt > now) { const hours = Math.ceil((startsAt.getTime() - now.getTime()) / 3600000); return `Entry in ${Math.floor(hours / 24)} days ${hours % 24} hours`; }
  if (!unlocksAt) return "Awaiting approval";
  const hours = Math.max(0, Math.ceil((unlocksAt.getTime() - now.getTime()) / 3600000));
  return hours === 0 ? "Lock period ended" : `${Math.floor(hours / 24)} days ${hours % 24} hours remaining`;
}

export function allocationLockDays(a: { startsAt?: Date | null; approvedAt: Date | null; unlocksAt: Date | null }) {
  const start = a.startsAt ?? a.approvedAt;
  return start && a.unlocksAt ? Math.round((a.unlocksAt.getTime() - start.getTime()) / 86400000) : a.startsAt ? 28 : 33;
}
