import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
let pg: PGlite;
const transport = vi.hoisted(() => ({ calls: 0, failBefore: 0, failAfter: 0 }));
vi.mock("@neondatabase/serverless", () => ({ neon: () => async (parts: TemplateStringsArray, ...values: unknown[]) => {
  transport.calls++;
  if (transport.failBefore-- > 0) throw new Error("Temporary connection failure");
  const query = parts.reduce((text, part, i) => text + (i ? `$${i}` : "") + part, "");
  const rows = (await pg.query(query, values)).rows;
  if (transport.failAfter-- > 0) throw new Error("Response lost after commit");
  return rows;
} }));
import { clubMemberAdmitted, clubNetworkAdmitted, rememberClubNetwork } from "@/lib/club-network-store";
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test.invalid/test");
  pg = new PGlite();
  for (const dir of fs.readdirSync("prisma/migrations").filter(n => /^\d/.test(n)).sort()) await pg.exec(fs.readFileSync(`prisma/migrations/${dir}/migration.sql`, "utf8"));
});
afterAll(async () => { await pg?.close(); vi.unstubAllEnvs(); });
beforeEach(() => { transport.calls = 0; transport.failBefore = 0; transport.failAfter = 0; });
it("persists admission idempotently and distinguishes invitation versions/networks", async () => {
  const key = "a".repeat(64), other = "b".repeat(64);
  expect(await clubNetworkAdmitted(key)).toBe(false);
  await rememberClubNetwork(key); await rememberClubNetwork(key);
  expect(await clubNetworkAdmitted(key)).toBe(true);
  expect(await clubNetworkAdmitted(other)).toBe(false);
  expect((await pg.query<{ count: number }>('SELECT count(*)::int AS count FROM "ClubAdmission"')).rows[0].count).toBe(1);
});
it("rejects raw addresses and malformed keys in the application and database", async () => {
  await expect(rememberClubNetwork("8.8.8.8")).rejects.toThrow("Invalid club network key");
  await expect(clubNetworkAdmitted("x' OR true --")).rejects.toThrow("Invalid club network key");
  await expect(pg.query('INSERT INTO "ClubAdmission" (key) VALUES ($1)', ["8.8.8.8"])).rejects.toThrow();
});
it("recovers one transient lookup failure without granting an unknown network", async () => {
  transport.failBefore = 1;
  expect(await clubNetworkAdmitted("c".repeat(64))).toBe(false);
  expect(transport.calls).toBe(2);
});
it("safely retries a committed admission whose HTTP response was lost", async () => {
  const key = "d".repeat(64); transport.failAfter = 1;
  await rememberClubNetwork(key);
  expect(transport.calls).toBe(2);
  expect(await clubNetworkAdmitted(key)).toBe(true);
  expect((await pg.query<{ count: number }>('SELECT count(*)::int AS count FROM "ClubAdmission" WHERE key=$1', [key])).rows[0].count).toBe(1);
});
it("stops after two storage failures so the caller can fail closed", async () => {
  transport.failBefore = 99;
  await expect(clubNetworkAdmitted("e".repeat(64))).rejects.toThrow("Temporary connection failure");
  expect(transport.calls).toBe(2);
});
it("uses current active account status and session version for existing-member admission", async () => {
  await pg.query('INSERT INTO "User" (id,email,"passwordHash","ageConfirmedAt","updatedAt","sessionVersion") VALUES ($1,$2,$3,now(),now(),3)', ['admission-member', 'admission@example.com', 'not-used']);
  expect(await clubMemberAdmitted('admission-member', 3)).toBe(true);
  expect(await clubMemberAdmitted('admission-member', 2)).toBe(false);
  expect(await clubMemberAdmitted('missing-member', 3)).toBe(false);
  for (const status of ['SUSPENDED', 'CLOSED']) {
    await pg.query('UPDATE "User" SET status=$1 WHERE id=$2', [status, 'admission-member']);
    expect(await clubMemberAdmitted('admission-member', 3)).toBe(false);
  }
});
