import { clubPasswordHash } from "./club-gate";

// Only the Cloudflare deployment's edge-supplied address can remember a network.
// Forwarded-For/Real-IP and the shared cross-zone Worker address are not identities.
export function trustedClubIp(headers: Headers) {
  if (process.env.DATABASE_DRIVER !== "neon-http" || headers.has("cf-worker")) return null;
  const raw = headers.get("cf-connecting-ip")?.toLowerCase();
  if (!raw || raw.length > 45 || !/^[0-9a-f:.]+$/.test(raw)) return null;
  let ip = raw;
  if (raw.includes(":")) {
    try { ip = new URL(`https://[${raw}]/`).hostname.slice(1, -1); } catch { return null; }
    // Normalize IPv4-mapped IPv6 to the same network identity as IPv4.
    const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(ip);
    if (mapped) {
      const high = parseInt(mapped[1], 16), low = parseInt(mapped[2], 16);
      ip = `${high >>> 8}.${high & 255}.${low >>> 8}.${low & 255}`;
    } else {
      if (ip === "::" || ip === "::1" || ip === "2a06:98c0:3600::103" || /^(?:f[cd]|fe[89ab]|ff)/.test(ip)) return null;
      return ip;
    }
  }
  const parts = ip.split(".");
  if (parts.length !== 4 || parts.some(p => !/^(?:0|[1-9][0-9]{0,2})$/.test(p) || Number(p) > 255)) return null;
  const [a, b] = parts.map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return null;
  return ip;
}

export async function clubNetworkKey(headers: Headers) {
  const ip = trustedClubIp(headers), hash = clubPasswordHash(), secret = process.env.AUTH_SECRET;
  if (!ip || !hash || !secret || secret.length < 32) return null;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`club-network-v1\0${hash}\0${ip}`));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
