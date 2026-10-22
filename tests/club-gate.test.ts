import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { beforeAll, beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CLUB_COOKIE, clubNext, gateExempt, signClubAdmission, verifyClubAdmission } from "@/lib/club-gate";
import { middleware } from "@/middleware";
import { signSession, SESSION_COOKIE } from "@/lib/session";
import { clubNetworkKey, trustedClubIp } from "@/lib/club-network";
const counters = vi.hoisted(() => ({ allow: true, calls: 0 }));
const networks = vi.hoisted(() => ({ admitted: new Set<string>(), members: new Set<string>(), reads: 0, memberReads: 0, fail: false }));
vi.mock("@/lib/club-network-store", () => ({
  clubMemberAdmitted: async (uid: string, sv: number) => { networks.memberReads++; if (networks.fail) throw new Error("Storage unavailable"); return networks.members.has(`${uid}:${sv}`); },
  clubNetworkAdmitted: async (key: string) => { networks.reads++; if (networks.fail) throw new Error("Storage unavailable"); return networks.admitted.has(key); },
  rememberClubNetwork: async (key: string) => { if (networks.fail) throw new Error("Storage unavailable"); networks.admitted.add(key); },
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => { counters.calls++; return counters.allow; } }));
vi.mock("@/lib/request", () => ({ clientIp: async () => "test-ip" }));
import { POST } from "@/app/api/club-entry/route";
let hash: string;
beforeAll(async () => { hash = await bcrypt.hash("Test-club-entry-password", 12); });
beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "t".repeat(40)); vi.stubEnv("APP_URL", "https://furlong.club");
  vi.stubEnv("CLUB_GATE_ENABLED", "true"); vi.stubEnv("CLUB_PASSWORD_HASH", hash);
  counters.allow = true; counters.calls = 0;
  networks.admitted.clear(); networks.members.clear(); networks.reads = 0; networks.memberReads = 0; networks.fail = false;
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
it.each(["/", "/plans", "/signup", "/admin", "/wallet", "/legal/terms", "/_next/data/build/index.json"])("requires admission for %s including direct links", async path => {
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

const networkHeaders = (ip = "8.8.8.8") => new Headers({ "cf-connecting-ip": ip });
const networkEntry = () => POST(new Request("https://furlong.club/api/club-entry", {
  method: "POST", headers: { origin: "https://furlong.club", "content-type": "application/json", "cf-connecting-ip": "8.8.8.8" },
  body: JSON.stringify({ password: "Test-club-entry-password" }),
}));
it("remembers a successful password once per trusted network across browsers, preserving personal login", async () => {
  vi.stubEnv("DATABASE_DRIVER", "neon-http");
  expect((await middleware(request("/", { headers: networkHeaders() }))).status).toBe(307);
  expect((await networkEntry()).status).toBe(200);
  expect([...networks.admitted]).toEqual([expect.stringMatching(/^[0-9a-f]{64}$/)]);
  expect([...networks.admitted][0]).not.toContain("8.8.8.8");
  const freshBrowser = await middleware(request("/", { headers: networkHeaders() }));
  expect(freshBrowser.status).toBe(200);
  expect(freshBrowser.cookies.get(CLUB_COOKIE)?.value).toBeTruthy();
  const account = await middleware(request("/account", { headers: networkHeaders() }));
  expect(new URL(account.headers.get("location")!).pathname).toBe("/login");
  expect(account.cookies.get(CLUB_COOKIE)?.value).toBeTruthy();
  expect((await middleware(request("/", { headers: networkHeaders("1.1.1.1") }))).status).toBe(307);
});
it("remembers the browser across network changes and skips database reads", async () => {
  vi.stubEnv("DATABASE_DRIVER", "neon-http");
  const cookie = `${CLUB_COOKIE}=${await signClubAdmission()}`;
  expect((await middleware(request("/", { headers: { "cf-connecting-ip": "8.8.8.8", cookie } }))).status).toBe(200);
  expect(networks.reads).toBe(0);
  expect((await middleware(request("/", { headers: { "cf-connecting-ip": "1.1.1.1", cookie } }))).status).toBe(200);
  expect(networks.reads).toBe(0);
});
it("password rotation revokes both the cookie and remembered network", async () => {
  vi.stubEnv("DATABASE_DRIVER", "neon-http");
  await networkEntry();
  const cookie = `${CLUB_COOKIE}=${await signClubAdmission()}`;
  vi.stubEnv("CLUB_PASSWORD_HASH", await bcrypt.hash("rotated-club-password", 12));
  expect((await middleware(request("/", { headers: { "cf-connecting-ip": "8.8.8.8", cookie } }))).status).toBe(307);
});
it("skips an admitted entrance and old preview links while sanitizing destinations", async () => {
  vi.stubEnv("DATABASE_DRIVER", "neon-http"); await networkEntry();
  const enter = await middleware(request("/entrance?next=%2Faccount", { headers: networkHeaders() }));
  expect(new URL(enter.headers.get("location")!).pathname).toBe("/account");
  const unsafe = await middleware(request("/entrance?next=https://evil.invalid", { headers: networkHeaders() }));
  expect(new URL(unsafe.headers.get("location")!).pathname).toBe("/");
  const preview = await middleware(request("/entrance?preview=1", { headers: networkHeaders() }));
  expect(preview.status).toBe(307); expect(new URL(preview.headers.get("location")!).pathname).toBe("/login");
  expect((await middleware(request("/?preview=1", { headers: networkHeaders("1.1.1.1") }))).status).toBe(307);
});
it.each(["/login", "/forgot-password", "/reset-password", "/verify-email"])("keeps existing-account access directly available: %s", async path => {
  vi.stubEnv("DATABASE_DRIVER", "neon-http"); networks.fail = true;
  for (const method of ["GET", "POST"]) expect((await middleware(request(path, { method, headers: networkHeaders() }))).status).toBe(200);
  expect(networks.reads).toBe(0); expect(networks.memberReads).toBe(0);
  expect(gateExempt(path + "/private")).toBe(false);
});
it.each(["USER", "ADMIN", "SUPER_ADMIN"] as const)("admits a currently active %s session without another invitation", async role => {
  networks.members.add("member:3");
  const cookie = `${SESSION_COOKIE}=${await signSession({ uid: "member", role, sv: 3 })}`;
  const member = await middleware(request("/account", { headers: { cookie } }));
  expect(member.status).toBe(200); expect(member.cookies.get(CLUB_COOKIE)?.value).toBeTruthy();
  const entrance = await middleware(request("/entrance?preview=1", { headers: { cookie } }));
  expect(new URL(entrance.headers.get("location")!).pathname).toBe("/dashboard");
  expect(networks.reads).toBe(0);
});
it("does not admit revoked, suspended or forged sessions without invitation", async () => {
  networks.members.add("member:4");
  const revoked = await signSession({ uid: "member", role: "SUPER_ADMIN", sv: 3 });
  for (const token of [revoked, revoked + "forged"]) expect((await middleware(request("/", { headers: { cookie: `${SESSION_COOKIE}=${token}` } }))).status).toBe(307);
  networks.members.clear();
  expect((await middleware(request("/", { headers: { cookie: `${SESSION_COOKIE}=${await signSession({ uid: "member", role: "USER", sv: 4 })}` } }))).status).toBe(307);
});
it("fails closed on network storage failure without issuing an admission cookie", async () => {
  vi.stubEnv("DATABASE_DRIVER", "neon-http"); networks.fail = true;
  const r = await middleware(request("/", { headers: networkHeaders() }));
  expect(r.status).toBe(503); expect(r.headers.get("set-cookie")).toBeNull();
  const entry = await networkEntry(); expect(entry.status).toBe(503); expect(entry.headers.get("set-cookie")).toBeNull();
  expect((await middleware(request("/api/cron/payments", { headers: networkHeaders() }))).status).toBe(200);
});
it("does not trust arbitrary forwarded headers or non-Cloudflare deployments", async () => {
  expect(trustedClubIp(networkHeaders())).toBeNull();
  vi.stubEnv("DATABASE_DRIVER", "neon-http");
  expect(trustedClubIp(new Headers({ "x-forwarded-for": "8.8.8.8", "x-real-ip": "8.8.8.8" }))).toBeNull();
  expect(trustedClubIp(new Headers({ "cf-connecting-ip": "8.8.8.8", "cf-worker": "other.example" }))).toBeNull();
});
it.each(["unknown", "", "8.8.8.8,1.1.1.1", "8.8.8.999", "127.0.0.1", "10.0.0.1", "192.168.1.1", "240.0.0.1", "::1", "fe80::1234", "fd00::1", "2a06:98c0:3600::103", "[2606:4700::1111]", "2606:4700::1111%eth0"])("never remembers an invalid, private or shared proxy address: %s", async ip => {
  vi.stubEnv("DATABASE_DRIVER", "neon-http");
  expect(await clubNetworkKey(networkHeaders(ip))).toBeNull();
});
it("normalizes IPv6 spellings and IPv4-mapped addresses to one keyed identity", async () => {
  vi.stubEnv("DATABASE_DRIVER", "neon-http");
  expect(await clubNetworkKey(networkHeaders("2606:4700:0000:0000:0000:0000:0000:1111"))).toBe(await clubNetworkKey(networkHeaders("2606:4700::1111")));
  expect(await clubNetworkKey(networkHeaders("::ffff:8.8.8.8"))).toBe(await clubNetworkKey(networkHeaders()));
});
