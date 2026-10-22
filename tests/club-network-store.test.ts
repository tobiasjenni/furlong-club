import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
let pg: PGlite;
vi.mock("@neondatabase/serverless", () => ({ neon: () => async (parts: TemplateStringsArray, ...values: unknown[]) => {
  const query = parts.reduce((text, part, i) => text + (i ? `$${i}` : "") + part, "");
  return (await pg.query(query, values)).rows;
} }));
import { clubNetworkAdmitted, rememberClubNetwork } from "@/lib/club-network-store";
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test.invalid/test");
  pg = new PGlite();
  await pg.exec(fs.readFileSync("prisma/migrations/20261022150000_club_network_admission/migration.sql", "utf8"));
});
afterAll(async () => { await pg?.close(); vi.unstubAllEnvs(); });
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
