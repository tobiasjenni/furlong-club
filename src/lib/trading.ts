import crypto from "node:crypto";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export const tradingTermsVersion = "manual-v2-2026-10-23";
export const tradingRequestsEnabled = process.env.TRADING_REQUESTS_ENABLED === "true" && process.env.WALLET_ENABLED === "true";
export const tradingOptions = [
  { currency: "USDT", network: "TRC20", label: "USDT · Tron (TRC-20)" },
  { currency: "USDT", network: "ERC20", label: "USDT · Ethereum (ERC-20)" },
  { currency: "USDC", network: "ERC20", label: "USDC · Ethereum (ERC-20)" },
] as const;

// Validate the member's destination without storing any wallet private keys.
export function normalizePayoutAddress(network: string, input: string): string | null {
  const address = input.trim();
  if (network === "ERC20") {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address) || /^0x0{40}$/.test(address)) return null;
    const lower = address.slice(2).toLowerCase();
    const hash = bytesToHex(keccak_256(utf8ToBytes(lower)));
    const checksummed = "0x" + [...lower].map((c, i) => parseInt(hash[i], 16) >= 8 ? c.toUpperCase() : c).join("");
    if (address.slice(2) !== lower && address.slice(2) !== lower.toUpperCase() && address !== checksummed) return null;
    return checksummed;
  }
  if (network !== "TRC20" || !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) return null;
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n;
  for (const c of address) n = n * 58n + BigInt(alphabet.indexOf(c));
  const decoded = Buffer.from(n.toString(16).padStart(50, "0"), "hex");
  if (decoded.length !== 25 || decoded[0] !== 0x41) return null;
  const digest = crypto.createHash("sha256").update(crypto.createHash("sha256").update(decoded.subarray(0, 21)).digest()).digest();
  return crypto.timingSafeEqual(decoded.subarray(21), digest.subarray(0, 4)) ? address : null;
}

export function tradingStatus(a: { status: string; unlocksAt: Date | null; payoutCents?: number | null }, now = new Date()) {
  if (a.status === "ACTIVE") return a.unlocksAt && a.unlocksAt <= now ? "Lock ended · result review due" : "Locked";
  return ({ PENDING: "Awaiting admin approval", PAYOUT_READY: "Awaiting manual payout", PAID: a.payoutCents === 0 ? "Closed · total loss recorded" : "Payout recorded", REJECTED: "Declined", CANCELLED: "Cancelled" } as Record<string, string>)[a.status] ?? a.status;
}

export function lockRemaining(unlocksAt: Date | null, now = new Date()) {
  if (!unlocksAt) return "Starts on admin approval";
  const hours = Math.max(0, Math.ceil((unlocksAt.getTime() - now.getTime()) / 3600000));
  return hours === 0 ? "Lock period ended" : `${Math.floor(hours / 24)} days ${hours % 24} hours remaining`;
}
