import { keccak_256 } from "@noble/hashes/sha3.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

// Public-address checks shared by the browser and server. No wallet keys are used.
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
  const hex = n.toString(16).padStart(50, "0");
  const decoded = Uint8Array.from(hex.match(/.{2}/g) ?? [], byte => parseInt(byte, 16));
  if (decoded.length !== 25 || decoded[0] !== 0x41) return null;
  const digest = sha256(sha256(decoded.subarray(0, 21)));
  return decoded.subarray(21).every((byte, index) => byte === digest[index]) ? address : null;
}

export type ClubReceivingAddress = { network: string; address: string };
export function isClubReceivingAddress(network: string, address: string, clubAddresses: ClubReceivingAddress[]) {
  const candidate = address.trim();
  return clubAddresses.some(club => club.network === network && (network === "TRC20" ? club.address.trim() === candidate : club.address.trim().toLowerCase() === candidate.toLowerCase()));
}

export function payoutDestinationError(network: string, address: string, confirmation: string, clubAddresses: ClubReceivingAddress[]) {
  const normalized = normalizePayoutAddress(network, address);
  if (!normalized) return network === "TRC20" ? "Paste your own Tron receiving address, starting with T. Check it in your wallet’s Receive screen." : "Paste your own Ethereum receiving address, starting with 0x. Check the address and network in your wallet’s Receive screen.";
  if (isClubReceivingAddress(network, normalized, clubAddresses)) return "This is the club’s deposit address. Open your personal wallet or exchange, choose Receive, and copy your own address here.";
  if (normalizePayoutAddress(network, confirmation) !== normalized) return "The two receiving addresses do not match. Paste the same personal wallet address again.";
  return null;
}
