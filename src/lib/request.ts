import { headers } from "next/headers";

// Client IP for rate limiting. x-real-ip is set by Vercel and most reverse proxies; make sure your proxy
// overwrites (not appends to) these headers so clients can't spoof them.
export async function clientIp() {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

// Only allow same-site relative paths, so ?next= can't send people to another site.
export function safeNext(next: unknown, fallback = "/dashboard") {
  const value = typeof next === "string" ? next : "";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
