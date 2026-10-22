import fs from "node:fs";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { decodeJwt, SignJWT } from "jose";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { passkeyFixture } from "./helpers/passkey-fixture";

let pg: PGlite, uid: string;
const store = new Map<string, { value: string; options?: object }>();
const sql = (parts: TemplateStringsArray) => parts.reduce((s, p, i) => s + (i ? `$${i}` : "") + p, "");
vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("@/lib/config", () => ({ appUrl: "https://club.test" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => store.get(name), set: (name: string, value: string, options: object) => store.set(name, { value, options }), delete: (name: string) => store.delete(name) }), headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("@/lib/db", () => ({ db: {
  $queryRaw: async (parts: TemplateStringsArray, ...args: unknown[]) => (await pg.query(sql(parts), args)).rows,
  user: { findUnique: async ({ where }: { where: { id: string } }) => (await pg.query('SELECT * FROM "User" WHERE id=$1', [where.id])).rows[0] },
  adminPasskey: {
    findMany: async ({ where }: { where: { userId: string } }) => (await pg.query('SELECT * FROM "AdminPasskey" WHERE "userId"=$1', [where.userId])).rows,
    findFirst: async ({ where }: { where: { userId: string; id: string } }) => (await pg.query('SELECT * FROM "AdminPasskey" WHERE "userId"=$1 AND id=$2', [where.userId, where.id])).rows[0],
  },
} }));
import { POST } from "@/app/api/admin/security/route";
import { requireAdmin } from "@/lib/auth";
import { signSession, SESSION_COOKIE } from "@/lib/session";
import { CLUB_COOKIE, verifyClubAdmission } from "@/lib/club-gate";
import { ADMIN_COOKIE, ADMIN_PASSWORD_COOKIE, signAdminReauthenticationGrant, verifyAdminConfirmation } from "@/lib/admin-session";
import { unlockAdmin } from "@/app/admin-unlock/actions";

async function user() { return (await pg.query<{ id: string; sessionVersion: number }>('SELECT * FROM "User" WHERE id=$1', [uid])).rows[0]; }
async function passwordGrant() { store.set(ADMIN_PASSWORD_COOKIE, { value: await signAdminReauthenticationGrant(await user(), store.get(SESSION_COOKIE)!.value) }); }
const post = (input: object, origin = "https://club.test") => POST(new Request("https://club.test/api/admin/security", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(input) }));
const options = async (kind = "register") => { const r = await post({ action: "options", kind }); expect(r.status).toBe(200); return r.json(); };
async function enroll() {
  const device = passkeyFixture("https://club.test", uid), o = await options();
  const r = await post({ action: "register", id: o.id, credential: device.register(o.options.challenge), label: "My laptop" }); expect(r.status).toBe(200);
  return { device, result: await r.json() };
}
async function verify(device: ReturnType<typeof passkeyFixture>, count = 1) {
  const o = await options("authenticate");
  return post({ action: "authenticate", id: o.id, credential: device.authenticate(o.options.challenge, count) });
}

beforeAll(async () => {
  pg = new PGlite();
  for (const dir of fs.readdirSync("prisma/migrations").filter(n => /^\d/.test(n)).sort()) await pg.exec(fs.readFileSync(`prisma/migrations/${dir}/migration.sql`, "utf8"));
}, 30000);
afterAll(async () => { await pg?.close(); });
afterEach(() => vi.unstubAllEnvs());
beforeEach(async () => {
  vi.stubEnv("CLUB_GATE_ENABLED", "true");
  vi.stubEnv("CLUB_PASSWORD_HASH", "$2a$12$" + "a".repeat(53));
  process.env.AUTH_SECRET = "test-admin-security-key-".repeat(3); uid = crypto.randomUUID(); store.clear();
  await pg.query(`INSERT INTO "User"(id,email,"passwordHash",role,"ageConfirmedAt","emailVerifiedAt","updatedAt") VALUES($1,$2,$3,'ADMIN',now(),now(),now())`, [uid, uid + "@example.com", await bcrypt.hash("existing-admin-password", 4)]);
  store.set(SESSION_COOKIE, { value: await signSession({ uid, role: "ADMIN", sv: 0 }) });
  await passwordGrant();
});

it("requires the current password first and never grants admin access from it alone", async () => {
  store.delete(ADMIN_PASSWORD_COOKIE);
  expect((await post({ action: "options", kind: "register" })).status).toBe(401);
  const form = new FormData(); form.set("password", "existing-admin-password");
  await expect(unlockAdmin(null, form)).rejects.toThrow("REDIRECT:/admin-unlock/security");
  expect(store.has(ADMIN_PASSWORD_COOKIE)).toBe(true); expect(store.has(ADMIN_COOKIE)).toBe(false);
  await expect(requireAdmin()).rejects.toThrow("REDIRECT:/admin-unlock");
});
it("registers a real verified public key, stores only recovery hashes and requires a signed assertion", async () => {
  const oldSession = store.get(SESSION_COOKIE)!.value;
  const { device, result } = await enroll();
  expect(result.recoveryCodes).toHaveLength(8); expect(result.needsVerification).toBe(true);
  expect(store.has(ADMIN_COOKIE)).toBe(false); expect(store.get(SESSION_COOKIE)!.value).not.toBe(oldSession);
  expect(await verifyClubAdmission(store.get(CLUB_COOKIE)?.value)).toBe(true);
  const hashes = (await pg.query<{ hash: string }>('SELECT hash FROM "AdminRecoveryCode" WHERE "userId"=$1', [uid])).rows;
  expect(hashes).toHaveLength(8); expect(JSON.stringify(hashes)).not.toContain(result.recoveryCodes[0]);
  expect((await verify(device)).status).toBe(200);
  expect(await verifyAdminConfirmation(store.get(ADMIN_COOKIE)?.value, await user(), store.get(SESSION_COOKIE)?.value)).toBe(true);
  expect((await requireAdmin()).id).toBe(uid);
  const k = (await pg.query<{ counter: bigint; verifiedAt: Date }>('SELECT counter,"verifiedAt" FROM "AdminPasskey" WHERE id=$1', [device.id])).rows[0];
  expect(Number(k.counter)).toBe(1); expect(k.verifiedAt).not.toBeNull();
});
it.each(["wrong-origin", "missing-uv", "wrong-rp", "forged-signature"])("rejects a %s assertion without granting privileged access", async attack => {
  const { device } = await enroll(); const o = await options("authenticate");
  const credential = device.authenticate(o.options.challenge, 1, attack === "missing-uv" ? 1 : 5, attack === "wrong-origin" ? "https://evil.test" : undefined, attack === "wrong-rp" ? "evil.test" : undefined);
  if (attack === "forged-signature") credential.response.signature = crypto.randomBytes(70).toString("base64url");
  expect((await post({ action: "authenticate", id: o.id, credential })).status).toBe(400);
  expect(store.has(ADMIN_COOKIE)).toBe(false);
});
it("consumes challenges once and rejects counter rollback", async () => {
  const { device } = await enroll(); const o = await options("authenticate"); const request = { action: "authenticate", id: o.id, credential: device.authenticate(o.options.challenge, 2) };
  expect((await post(request)).status).toBe(200);
  expect((await post(request)).status).toBe(400);
  store.delete(ADMIN_COOKIE); expect((await verify(device, 1)).status).toBe(400); expect(store.has(ADMIN_COOKIE)).toBe(false);
});
it("rejects an expired challenge and a challenge from another browser session", async () => {
  const { device } = await enroll(); const o = await options("authenticate");
  await pg.query('UPDATE "AdminSecurityChallenge" SET "expiresAt"=TIMESTAMP \'2000-01-01\' WHERE id=$1', [o.id]);
  expect((await post({ action: "authenticate", id: o.id, credential: device.authenticate(o.options.challenge) })).status).toBe(400);
  const another = await options("authenticate"); store.set(SESSION_COOKIE, { value: await signSession({ uid, role: "ADMIN", sv: (await user()).sessionVersion }) }); await passwordGrant();
  expect((await post({ action: "authenticate", id: another.id, credential: device.authenticate(another.options.challenge) })).status).toBe(400);
});
it("uses a recovery code only once, revokes sessions and does not expose it in the audit trail", async () => {
  const { result } = await enroll(); const r = await post({ action: "recover", code: result.recoveryCodes[0] });
  expect(r.status).toBe(200); expect(await verifyAdminConfirmation(store.get(ADMIN_COOKIE)?.value, await user(), store.get(SESSION_COOKIE)?.value)).toBe(true);
  expect((await post({ action: "recover", code: result.recoveryCodes[0] })).status).toBe(400);
  const logs = (await pg.query('SELECT meta FROM "AuditLog" WHERE "actorId"=$1', [uid])).rows;
  expect(JSON.stringify(logs)).not.toContain(result.recoveryCodes[0]);
});
it("blocks cross-origin requests, ordinary members and stale roles", async () => {
  expect((await post({ action: "options", kind: "register" }, "https://evil.test")).status).toBe(403);
  await pg.query('UPDATE "User" SET role=\'USER\' WHERE id=$1', [uid]);
  expect((await post({ action: "options", kind: "register" })).status).toBe(403);
});
it("never lets a password-only session add or replace devices after enrollment", async () => {
  await enroll();
  expect((await post({ action: "options", kind: "register" })).status).toBe(403);
  expect((await post({ action: "rotate_codes" })).status).toBe(403);
});
it("preserves the last verified device, and invalidates replaced recovery codes", async () => {
  const { device, result } = await enroll(); expect((await verify(device)).status).toBe(200);
  expect((await post({ action: "remove", credentialId: device.id })).status).toBe(409);
  const second = passkeyFixture("https://club.test", uid), o = await options();
  expect((await post({ action: "register", id: o.id, credential: second.register(o.options.challenge) })).status).toBe(200);
  // Verify with the old key: an untested replacement must not make it removable.
  expect((await verify(device, 2)).status).toBe(200);
  expect((await post({ action: "remove", credentialId: device.id })).status).toBe(409);
  expect((await verify(second, 1)).status).toBe(200);
  expect((await post({ action: "remove", credentialId: device.id })).status).toBe(200);
  const rotated = await post({ action: "rotate_codes" }); expect(rotated.status).toBe(200);
  expect((await rotated.json()).recoveryCodes).toHaveLength(8);
  expect((await post({ action: "recover", code: result.recoveryCodes[0] })).status).toBe(400);
});

it("does not accept a password grant or an old password-only confirmation as the second factor", async () => {
  const account = await user(), session = store.get(SESSION_COOKIE)!.value;
  expect(await verifyAdminConfirmation(store.get(ADMIN_PASSWORD_COOKIE)?.value, account, session)).toBe(false);
  const old = await new SignJWT({ uid, sv: account.sessionVersion, sid: crypto.createHash("sha256").update(session).digest("hex") })
    .setProtectedHeader({ alg: "HS256" }).setIssuer("furlong-club").setAudience("furlong-admin-confirmation")
    .setIssuedAt().setExpirationTime("15m").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  expect(await verifyAdminConfirmation(old, account, session)).toBe(false);
});
it("preserves the password deadline when changing security settings", async () => {
  store.set(ADMIN_PASSWORD_COOKIE, { value: await signAdminReauthenticationGrant(await user(), store.get(SESSION_COOKIE)!.value, 25) });
  const deadline = decodeJwt(store.get(ADMIN_PASSWORD_COOKIE)!.value).exp!;
  await enroll();
  expect(decodeJwt(store.get(ADMIN_PASSWORD_COOKIE)!.value).exp).toBeLessThanOrEqual(deadline);
  const expired = await new SignJWT({ uid, sv: (await user()).sessionVersion, sid: crypto.createHash("sha256").update(store.get(SESSION_COOKIE)!.value).digest("hex") })
    .setProtectedHeader({ alg: "HS256" }).setIssuer("furlong-club").setAudience("furlong-admin-password")
    .setIssuedAt(Math.floor(Date.now() / 1000) - 400).setExpirationTime(Math.floor(Date.now() / 1000) - 100).sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  store.set(ADMIN_PASSWORD_COOKIE, { value: expired });
  expect((await post({ action: "options", kind: "authenticate" })).status).toBe(401);
});
it("rejects a credential or recovery code owned by another administrator", async () => {
  const { device, result } = await enroll(), owner = uid;
  uid = crypto.randomUUID();
  await pg.query(`INSERT INTO "User"(id,email,"passwordHash",role,"ageConfirmedAt","emailVerifiedAt","updatedAt") VALUES($1,$2,'unused','ADMIN',now(),now(),now())`, [uid, uid + "@example.com"]);
  store.clear(); store.set(SESSION_COOKIE, { value: await signSession({ uid, role: "ADMIN", sv: 0 }) }); await passwordGrant();
  await enroll(); const o = await options("authenticate");
  expect((await post({ action: "authenticate", id: o.id, credential: device.authenticate(o.options.challenge) })).status).toBe(400);
  expect((await post({ action: "recover", code: result.recoveryCodes[0] })).status).toBe(400);
  expect((await pg.query<{ usedAt: Date | null }>('SELECT "usedAt" FROM "AdminRecoveryCode" WHERE "userId"=$1', [owner])).rows.every(r => r.usedAt === null)).toBe(true);
});
it("rejects a pending assertion after account revocation", async () => {
  const { device } = await enroll(), o = await options("authenticate");
  await pg.query('UPDATE "User" SET "sessionVersion"="sessionVersion"+1 WHERE id=$1', [uid]);
  expect((await post({ action: "authenticate", id: o.id, credential: device.authenticate(o.options.challenge) })).status).toBe(403);
  expect(store.has(ADMIN_COOKIE)).toBe(false);
});
