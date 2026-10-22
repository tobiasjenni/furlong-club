import bcrypt from "bcryptjs";
import { SignJWT, decodeJwt } from "jose";
import { beforeAll, beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CLUB_COOKIE, CLUB_ADMISSION_SECONDS, clubNext, gateExempt, signClubAdmission, verifyClubAdmission } from "@/lib/club-gate";
import { middleware } from "@/middleware";
import { signSession, SESSION_COOKIE } from "@/lib/session";
import { clubNetworkKey, trustedClubIp } from "@/lib/club-network";
const counters = vi.hoisted(() => ({ allow: true }));
const store = vi.hoisted(() => ({ members: new Set<string>(), reads: 0, networkReads: 0, networkWrites: 0, fail: false }));
vi.mock("@/lib/club-network-store", () => ({
  clubMemberAdmitted: async (uid: string, sv: number) => { store.reads++; if (store.fail) throw new Error("Storage unavailable"); return store.members.has(`${uid}:${sv}`); },
  clubNetworkAdmitted: async () => { store.networkReads++; return true; },
  rememberClubNetwork: async () => { store.networkWrites++; },
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => counters.allow }));
vi.mock("@/lib/request", () => ({ clientIp: async () => "test-ip" }));
import { POST } from "@/app/api/club-entry/route";
let hash: string;
beforeAll(async () => { hash = await bcrypt.hash("Test-club-entry-password", 12); });
beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "t".repeat(40)); vi.stubEnv("APP_URL", "https://furlong.club");
  vi.stubEnv("CLUB_GATE_ENABLED", "true"); vi.stubEnv("CLUB_PASSWORD_HASH", hash);
  counters.allow = true; store.members.clear(); store.reads = 0; store.networkReads = 0; store.networkWrites = 0; store.fail = false;
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
const request = (path: string, options: NonNullable<ConstructorParameters<typeof NextRequest>[1]> = {}) => new NextRequest("https://furlong.club" + path, options);
const entry = (input: unknown, origin = "https://furlong.club") => POST(new Request("https://furlong.club/api/club-entry", { method: "POST", headers: { origin, "Content-Type": "application/json", "cf-connecting-ip": "8.8.8.8" }, body: JSON.stringify(input) }));
const location = (response: Response) => new URL(response.headers.get("location")!);

it("issues only two-hour guest admission and rejects forged or personal session tokens", async () => {
  const token = await signClubAdmission(); expect(await verifyClubAdmission(token)).toBe(true);
  const payload = decodeJwt(token); expect(payload.exp! - payload.iat!).toBe(CLUB_ADMISSION_SECONDS); expect(CLUB_ADMISSION_SECONDS).toBe(7200);
  expect(await verifyClubAdmission(token + "x")).toBe(false); expect(await verifyClubAdmission(undefined)).toBe(false);
  expect(await verifyClubAdmission(await signSession({ uid: "u", role: "SUPER_ADMIN", sv: 1 }))).toBe(false);
});
it("retires legacy year-long cookies even if signed recently with the same invitation hash", async () => {
  const current = decodeJwt(await signClubAdmission());
  const legacy = await new SignJWT({ version: current.version }).setProtectedHeader({ alg: "HS256" }).setIssuer("furlong-club-entrance").setAudience("club-entry").setIssuedAt().setExpirationTime("365d").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  expect(await verifyClubAdmission(legacy)).toBe(false);
});
it("expires guest access after two hours and sends the browser back to the door", async () => {
  vi.useFakeTimers(); const now = Date.now(); vi.setSystemTime(now); const token = await signClubAdmission();
  vi.setSystemTime(now + 7201 * 1000); expect(await verifyClubAdmission(token)).toBe(false);
  expect(location(await middleware(request("/", { headers: { cookie: CLUB_COOKIE + "=" + token } }))).pathname).toBe("/entrance");
});
it("rotating the invitation invalidates current guest admission", async () => {
  const token = await signClubAdmission(); vi.stubEnv("CLUB_PASSWORD_HASH", await bcrypt.hash("rotated-club-password", 12)); expect(await verifyClubAdmission(token)).toBe(false);
});
it("fails closed when invitation configuration is unavailable", async () => {
  const token = await signClubAdmission(); vi.stubEnv("CLUB_PASSWORD_HASH", ""); expect(await verifyClubAdmission(token)).toBe(false);
  expect((await entry({ password: "any" })).status).toBe(503); expect(location(await middleware(request("/"))).pathname).toBe("/entrance");
});
it.each(["/", "/plans", "/signup", "/admin", "/wallet", "/legal/terms", "/_next/data/build/index.json"])("requires entry for a signed-out direct request: %s", async path => {
  const response = await middleware(request(path)); expect(response.status).toBe(307); expect(location(response).pathname).toBe("/entrance"); expect(location(response).searchParams.get("next")).toBe(path.startsWith("/_next/data/") ? "/" : path);
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("blocks forged cookies, private APIs, RSC, prefetch and protected server actions", async () => {
  for (const headers of [new Headers({ RSC: "1" }), new Headers({ "Next-Router-Prefetch": "1" }), new Headers({ cookie: CLUB_COOKIE + "=fake" })]) expect((await middleware(request("/", { headers }))).status).toBe(307);
  for (const path of ["/wallet", "/robots.txt", "/api/cron/unknown", "/api/payments/webhook/unknown"]) expect((await middleware(request(path, { method: "POST", headers: { "Next-Action": "forged" } }))).status).toBe(403);
  expect((await middleware(request("/api/admin/notifications"))).status).toBe(403);
});
it("guest invitations allow public browsing and signup but never replace personal login", async () => {
  const cookie = CLUB_COOKIE + "=" + await signClubAdmission();
  expect((await middleware(request("/", { headers: { cookie } }))).status).toBe(200);
  expect((await middleware(request("/signup", { headers: { cookie } }))).status).toBe(200);
  const personal = await middleware(request("/account?tab=security", { headers: { cookie } }));
  expect(location(personal).pathname).toBe("/entrance"); expect(location(personal).searchParams.get("mode")).toBe("member"); expect(location(personal).searchParams.get("next")).toBe("/account?tab=security");
});
it("never uses an old remembered network or writes a new one", async () => {
  vi.stubEnv("DATABASE_DRIVER", "neon-http");
  const headers = { "cf-connecting-ip": "8.8.8.8" };
  expect((await entry({ password: "Test-club-entry-password" })).status).toBe(200);
  expect(location(await middleware(request("/", { headers }))).pathname).toBe("/entrance");
  expect(store.networkReads).toBe(0); expect(store.networkWrites).toBe(0);
});
it("keeps the entrance available to invited guests for switching to member sign-in", async () => {
  const cookie = CLUB_COOKIE + "=" + await signClubAdmission();
  const response = await middleware(request("/entrance", { headers: { cookie } })); expect(response.status).toBe(200); expect(response.headers.get("x-middleware-request-x-furlong-entrance")).toBe("1");
});
it.each(["/entrance", "/login", "/forgot-password", "/reset-password", "/verify-email"])("keeps personal access forms usable without invitation: %s", async path => {
  store.fail = true;
  for (const method of ["GET", "POST"]) expect((await middleware(request(path, { method }))).status).toBe(200);
  expect(store.reads).toBe(0); expect(gateExempt(path + "/private")).toBe(false);
});
it.each(["USER", "ADMIN", "SUPER_ADMIN"] as const)("admits an active %s session directly without an invitation", async role => {
  store.members.add("member:3"); const cookie = `${SESSION_COOKIE}=${await signSession({ uid: "member", role, sv: 3 })}`;
  const account = await middleware(request("/account", { headers: { cookie } })); expect(account.status).toBe(200); expect(account.headers.get("set-cookie")).toBeNull();
  expect(location(await middleware(request("/entrance", { headers: { cookie } }))).pathname).toBe("/dashboard");
  expect(location(await middleware(request("/entrance?next=%2Fwallet", { headers: { cookie } }))).pathname).toBe("/wallet");
});
it("a member still cannot access admin pages", async () => {
  store.members.add("member:0"); const cookie = `${SESSION_COOKIE}=${await signSession({ uid: "member", role: "USER", sv: 0 })}`;
  expect(location(await middleware(request("/admin", { headers: { cookie } }))).pathname).toBe("/dashboard");
});
it("revoked/suspended sessions cannot fall back to an invitation cookie", async () => {
  store.members.add("member:4"); const session = await signSession({ uid: "member", role: "SUPER_ADMIN", sv: 3 });
  const cookie = `${SESSION_COOKIE}=${session}; ${CLUB_COOKIE}=${await signClubAdmission()}`;
  expect(location(await middleware(request("/", { headers: { cookie } }))).pathname).toBe("/entrance");
  store.members.clear(); expect(location(await middleware(request("/account", { headers: { cookie } }))).pathname).toBe("/entrance");
});
it("handles an expired personal login without a redirect loop", async () => {
  vi.useFakeTimers(); const now = Date.now(); vi.setSystemTime(now);
  const token = await signSession({ uid: "member", role: "USER", sv: 0 }); vi.setSystemTime(now + 15 * 86400000);
  expect(location(await middleware(request("/account", { headers: { cookie: `${SESSION_COOKIE}=${token}` } }))).pathname).toBe("/entrance");
  expect((await middleware(request("/entrance", { headers: { cookie: `${SESSION_COOKIE}=${token}` } }))).status).toBe(200);
});
it("fails closed on member-store errors while leaving reauthentication available", async () => {
  store.fail = true; const cookie = `${SESSION_COOKIE}=${await signSession({ uid: "member", role: "USER", sv: 3 })}`;
  const response = await middleware(request("/account", { headers: { cookie } })); expect(location(response).pathname).toBe("/entrance"); expect(location(response).searchParams.get("reauth")).toBe("1"); expect(location(response).searchParams.get("next")).toBe("/account");
  expect((await middleware(request("/entrance?reauth=1", { headers: { cookie } }))).status).toBe(200);
  expect((await middleware(request("/entrance", { headers: { cookie } }))).status).toBe(200);
  expect((await middleware(request("/wallet", { method: "POST", headers: { cookie } }))).status).toBe(403);
  expect((await middleware(request("/api/admin/notifications", { headers: { cookie } }))).status).toBe(403);
  expect((await entry({ password: "Test-club-entry-password" })).status).toBe(200);
});
it("limits public endpoints and cannot spoof the entrance layout hint", async () => {
  expect((await middleware(request("/api/cron/payments"))).status).toBe(200); expect(gateExempt("/api/payments/webhook/unknown")).toBe(false);
  const cookie = CLUB_COOKIE + "=" + await signClubAdmission(); const response = await middleware(request("/", { headers: { cookie, "x-furlong-entrance": "1" } })); expect(response.headers.get("x-middleware-request-x-furlong-entrance")).toBe("0");
  expect((await middleware(request("/login"))).headers.get("x-middleware-request-x-furlong-entrance")).toBe("1");
});
it("checks invitation password, bounds input, rejects cross-origin and throttles attempts", async () => {
  expect((await entry({ password: "wrong" })).status).toBe(401);
  expect((await entry({ password: "Test-club-entry-password" }, "https://evil.invalid")).status).toBe(403);
  expect((await entry({ password: "x".repeat(5000) })).status).toBe(413); expect((await entry({ password: "é".repeat(50) })).status).toBe(401);
  counters.allow = false; expect((await entry({ password: "Test-club-entry-password" })).status).toBe(429); counters.allow = true;
  const response = await entry({ password: "Test-club-entry-password", next: "/signup" }); expect(response.status).toBe(200); expect(await response.json()).toEqual({ next: "/signup" });
  expect(response.headers.get("set-cookie")).toMatch(/fc_club_entry=.*Max-Age=7200.*HttpOnly.*SameSite=lax/i);
  expect(response.cookies.get(SESSION_COOKIE)?.value).toBe("");
});
it.each(["https://evil.invalid", "//evil.invalid", "/\\evil", "/%5cevil", "/entrance", "/api/cron/daily", "/_next/data/build.json"])("rejects unsafe return destination %s", value => expect(clubNext(value)).toBe("/"));
it("unlocked deployments retain their normal login and public pages", async () => {
  vi.stubEnv("CLUB_GATE_ENABLED", "false"); expect((await middleware(request("/"))).status).toBe(200);
  expect(location(await middleware(request("/account"))).pathname).toBe("/login");
  expect((await middleware(request("/login"))).headers.get("x-middleware-request-x-furlong-entrance")).toBe("0");
});
// Legacy fingerprint helpers remain for historical records, but no entry path uses them.
it("does not trust arbitrary forwarded headers for legacy fingerprints", async () => {
  expect(trustedClubIp(new Headers({ "cf-connecting-ip": "8.8.8.8" }))).toBeNull(); vi.stubEnv("DATABASE_DRIVER", "neon-http");
  expect(trustedClubIp(new Headers({ "x-forwarded-for": "8.8.8.8" }))).toBeNull(); expect(await clubNetworkKey(new Headers({ "cf-connecting-ip": "127.0.0.1" }))).toBeNull();
});
