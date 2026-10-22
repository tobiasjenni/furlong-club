import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { beforeAll, beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CLUB_COOKIE, clubNext, gateExempt, signClubAdmission, verifyClubAdmission } from "@/lib/club-gate";
import { middleware } from "@/middleware";
import { signSession, SESSION_COOKIE } from "@/lib/session";
const counters = vi.hoisted(() => ({ allow: true, calls: 0 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => { counters.calls++; return counters.allow; } }));
vi.mock("@/lib/request", () => ({ clientIp: async () => "test-ip" }));
import { POST } from "@/app/api/club-entry/route";
let hash: string;
beforeAll(async () => { hash = await bcrypt.hash("Test-club-entry-password", 12); });
beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "t".repeat(40)); vi.stubEnv("APP_URL", "https://furlong.club");
  vi.stubEnv("CLUB_GATE_ENABLED", "true"); vi.stubEnv("CLUB_PASSWORD_HASH", hash);
  counters.allow = true; counters.calls = 0;
});
afterEach(() => vi.unstubAllEnvs());
const request = (path: string, options: NonNullable<ConstructorParameters<typeof NextRequest>[1]> = {}) => new NextRequest("https://furlong.club" + path, options);
const entry = (input: unknown, origin = "https://furlong.club") => POST(new Request("https://furlong.club/api/club-entry", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(input) }));
it("issues a distinct admission cookie and invalidates it on password rotation", async () => {
  const token = await signClubAdmission(); expect(await verifyClubAdmission(token)).toBe(true);
  expect(await verifyClubAdmission(token + "x")).toBe(false);
  expect(await verifyClubAdmission(undefined)).toBe(false);
  expect(await verifyClubAdmission(await signSession({ uid: "u", role: "SUPER_ADMIN", sv: 1 }))).toBe(false);
  vi.stubEnv("CLUB_PASSWORD_HASH", await bcrypt.hash("rotated-club-password", 12));
  expect(await verifyClubAdmission(token)).toBe(false);
});
it("rejects expired admission and fails closed when configuration is missing", async () => {
  const expired = await new SignJWT({ version: "irrelevant" }).setProtectedHeader({ alg: "HS256" }).setIssuer("furlong-club-entrance").setAudience("club-entry").setIssuedAt(1).setExpirationTime(2).sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  expect(await verifyClubAdmission(expired)).toBe(false);
  const token = await signClubAdmission(); vi.stubEnv("CLUB_PASSWORD_HASH", "");
  expect(await verifyClubAdmission(token)).toBe(false);
  expect((await entry({ password: "any" })).status).toBe(503);
  expect((await middleware(request("/"))).status).toBe(307);
});
it.each(["/", "/plans", "/login", "/signup", "/admin", "/wallet", "/legal/terms", "/_next/data/build/index.json"])("requires admission for %s including direct links", async path => {
  const r = await middleware(request(path)); expect(r.status).toBe(307);
  expect(new URL(r.headers.get("location")!).pathname).toBe("/entrance"); expect(r.headers.get("cache-control")).toContain("no-store");
});
it("blocks server actions, private APIs, forged cookies, RSC and prefetch requests", async () => {
  for (const headers of [new Headers({ RSC: "1" }), new Headers({ "Next-Router-Prefetch": "1" }), new Headers({ cookie: CLUB_COOKIE + "=fake" })]) expect((await middleware(request("/", { headers }))).status).toBe(307);
  expect((await middleware(request("/wallet", { method: "POST", headers: { "Next-Action": "forged" } }))).status).toBe(403);
  for (const path of ["/entrance", "/robots.txt", "/api/cron/unknown", "/api/payments/webhook/unknown"]) expect((await middleware(request(path, { method: "POST", headers: { "Next-Action": "forged" } }))).status).toBe(403);
  expect((await middleware(request("/api/admin/notifications"))).status).toBe(403);
  expect((await middleware(request("/", { headers: { cookie: SESSION_COOKIE + "=" + await signSession({ uid: "u", role: "SUPER_ADMIN", sv: 1 }) } }))).status).toBe(307);
});
it("retains member login and admin authorization after admission", async () => {
  const admission = CLUB_COOKIE + "=" + await signClubAdmission();
  expect((await middleware(request("/", { headers: { cookie: admission } }))).status).toBe(200);
  const member = await middleware(request("/account?tab=security", { headers: { cookie: admission } }));
  expect(new URL(member.headers.get("location")!).pathname).toBe("/login");
  expect(new URL(member.headers.get("location")!).searchParams.get("next")).toBe("/account?tab=security");
  const session = await signSession({ uid: "u", role: "USER", sv: 0 });
  const admin = await middleware(request("/admin", { headers: { cookie: admission + "; " + SESSION_COOKIE + "=" + session } }));
  expect(new URL(admin.headers.get("location")!).pathname).toBe("/dashboard");
});
it("allows only public entrance assets and separately authenticated machine endpoints", async () => {
  for (const path of ["/entrance", "/club-entrance.webp", "/favicon.ico", "/robots.txt", "/sitemap.xml", "/api/cron/payments", "/api/payments/webhook/nowpayments"]) expect((await middleware(request(path))).status).toBe(200);
  for (const path of ["/entrance/private", "/api/club-entry/private", "/api/cronology", "/_next/data/private.json"]) expect(gateExempt(path)).toBe(false);
});
it("overwrites spoofed layout hints", async () => {
  const cookie = CLUB_COOKIE + "=" + await signClubAdmission();
  const r = await middleware(request("/", { headers: { cookie, "x-furlong-entrance": "1" } }));
  expect(r.headers.get("x-middleware-request-x-furlong-entrance")).toBe("0");
});
it("checks password, bounds input, rejects cross-origin requests and throttles attempts", async () => {
  expect((await entry({ password: "wrong" })).status).toBe(401);
  expect((await entry({ password: "Test-club-entry-password" }, "https://evil.invalid")).status).toBe(403);
  expect((await entry({ password: "x".repeat(5000) })).status).toBe(413);
  expect((await entry({ password: "é".repeat(50) })).status).toBe(401);
  counters.allow = false; expect((await entry({ password: "Test-club-entry-password" })).status).toBe(429);
  counters.allow = true; const r = await entry({ password: "Test-club-entry-password", next: "/account?tab=security" });
  expect(r.status).toBe(200); expect(await r.json()).toEqual({ next: "/account?tab=security" });
  expect(r.headers.get("set-cookie")).toMatch(/fc_club_entry=.*HttpOnly.*SameSite=lax/i);
  expect(r.headers.get("cache-control")).toContain("no-store");
});
it.each(["https://evil.invalid", "//evil.invalid", "/\\evil", "/%5cevil", "/entrance", "/api/cron/daily", "/_next/data/build.json"])("rejects unsafe return destination %s", value => expect(clubNext(value)).toBe("/"));
