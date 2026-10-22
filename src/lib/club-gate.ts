import { SignJWT, jwtVerify } from "jose";

export const CLUB_COOKIE = "fc_club_entry";
export const CLUB_ADMISSION_SECONDS = 365 * 24 * 60 * 60;
export const clubGateEnabled = () => process.env.CLUB_GATE_ENABLED === "true";
const issuer = "furlong-club-entrance";
function key() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("Club admission signing is unavailable");
  return new TextEncoder().encode(value);
}
export function clubPasswordHash() {
  const hash = process.env.CLUB_PASSWORD_HASH;
  return hash && /^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(hash) ? hash : null;
}
async function version() {
  const hash = clubPasswordHash();
  if (!hash) throw new Error("Club entrance is unavailable");
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(hash))))
    .map(byte => byte.toString(16).padStart(2, "0")).join("");
}
export async function signClubAdmission() {
  return new SignJWT({ version: await version() }).setProtectedHeader({ alg: "HS256" })
    .setIssuer(issuer).setAudience("club-entry").setIssuedAt().setExpirationTime(`${CLUB_ADMISSION_SECONDS}s`).sign(key());
}
export async function verifyClubAdmission(token: string | undefined) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"], issuer, audience: "club-entry", maxTokenAge: `${CLUB_ADMISSION_SECONDS}s` });
    // Admission remembers this browser across network changes. Older signed
    // network-bound cookies remain valid until their original expiry.
    return payload.version === await version();
  } catch { return false; }
}
export const clubCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: CLUB_ADMISSION_SECONDS };

// Machine endpoints retain their own cron-secret/webhook-signature checks.
export function gateMachineEndpoint(path: string) {
  return ["/api/cron/daily", "/api/cron/payments", "/api/payments/webhook/nowpayments"].includes(path);
}
// Exact public account-form paths; this predicate does not authenticate anyone.
export function gateAccountPath(path: string) {
  return ["/login", "/forgot-password", "/reset-password", "/verify-email"].includes(path);
}
export function gateExempt(path: string) {
  return ["/entrance", "/api/club-entry", "/robots.txt", "/sitemap.xml", "/favicon.ico", "/favicon-96x96.png", "/icon.svg", "/apple-icon.png", "/brand-logo.png", "/club-entrance.webp"].includes(path)
    || path.startsWith("/_next/static/") || path === "/_next/image" || gateMachineEndpoint(path) || gateAccountPath(path);
}
export function clubNext(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]|%(?:0[0-9a-f]|1[0-9a-f]|5c|7f)/i.test(value)) return "/";
  try {
    const url = new URL(value, "https://club.invalid");
    if (url.origin !== "https://club.invalid" || /^\/(?:entrance|api|_next)(?:\/|$)/.test(url.pathname)) return "/";
    return url.pathname + url.search + url.hash;
  } catch { return "/"; }
}
