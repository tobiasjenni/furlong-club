import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ cookies: new Map<string, string>(), options: new Map<string, { maxAge?: number }>(), headers: new Headers(), admitted: false }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => state.cookies.has(key) ? { value: state.cookies.get(key)! } : undefined,
  set: (key: string, value: string, options: { maxAge?: number }) => { state.cookies.set(key, value); state.options.set(key, options); }, delete: (key: string) => state.cookies.delete(key) }), headers: async () => state.headers }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/club-network-store", () => ({ clubNetworkAdmitted: async () => state.admitted }));
import { startSession, endSession } from "@/lib/auth";
import { CLUB_COOKIE, signClubAdmission, verifyClubAdmission } from "@/lib/club-gate";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { hasClubInvitation } from "@/lib/club-invitation";
beforeEach(() => {
  state.cookies.clear(); state.options.clear(); state.headers = new Headers(); state.admitted = false;
  vi.stubEnv("AUTH_SECRET", "s".repeat(40)); vi.stubEnv("CLUB_GATE_ENABLED", "true");
  vi.stubEnv("CLUB_PASSWORD_HASH", "$2a$12$" + "a".repeat(53));
});
afterEach(() => vi.unstubAllEnvs());
it("personal login replaces guest access and logout clears both kinds of access", async () => {
  state.cookies.set(CLUB_COOKIE, await signClubAdmission());
  await startSession({ id: "member", role: "USER", sessionVersion: 2 });
  expect(await verifySession(state.cookies.get(SESSION_COOKIE))).toEqual({ uid: "member", role: "USER", sv: 2 });
  expect(state.cookies.has(CLUB_COOKIE)).toBe(false);
  state.cookies.set(CLUB_COOKIE, await signClubAdmission());
  await endSession(); expect(state.cookies.has(SESSION_COOKIE)).toBe(false);
  expect(await verifyClubAdmission(state.cookies.get(CLUB_COOKIE))).toBe(false);
});
it("signup requires a current guest invitation; remembered networks never grant it", async () => {
  expect(await hasClubInvitation()).toBe(false);
  state.cookies.set(CLUB_COOKIE, "forged"); expect(await hasClubInvitation()).toBe(false);
  state.cookies.set(CLUB_COOKIE, await signClubAdmission()); expect(await hasClubInvitation()).toBe(true);
  state.cookies.clear(); vi.stubEnv("DATABASE_DRIVER", "neon-http"); state.headers.set("cf-connecting-ip", "8.8.8.8");
  expect(await hasClubInvitation()).toBe(false); state.admitted = true; expect(await hasClubInvitation()).toBe(false);
});
