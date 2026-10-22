import { headers } from "next/headers";

// Client IP for rate limiting. x-real-ip is set by Vercel and most reverse proxies; make sure your proxy
// overwrites (not appends to) these headers so clients can't spoof them.
export async function clientIp() {
  const h = await headers();
  return process.env.DATABASE_DRIVER === "neon-http"
    ? h.get("cf-connecting-ip") ?? "unknown"
    : h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

// Only allow same-site relative paths, so ?next= can't send people to another site.
export function safeNext(next: unknown, fallback = "/dashboard") {
  const value = typeof next === "string" ? next : "";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u0020\u007f]|%(?:0[0-9a-f]|1[0-9a-f]|5c|7f)/i.test(value)) return fallback;
  try {
    const destination = new URL(value, "https://furlong.invalid");
    if (destination.origin !== "https://furlong.invalid" || destination.pathname.startsWith("//") || /^\/(?:entrance|login|signup|forgot-password|reset-password|verify-email)(?:\/|$)/.test(destination.pathname)) return fallback;
    return destination.pathname + destination.search + destination.hash;
  } catch { return fallback; }
}
