import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let pg: PGlite;
const sql = (parts: TemplateStringsArray) => parts.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, "");
vi.mock("@/lib/db", () => ({ db: {
  $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => (await pg.query(sql(parts), values)).rows,
  $executeRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => (await pg.query(sql(parts), values)).affectedRows,
} }));
import { consumeToken, issueToken } from "@/lib/tokens";
import { rateLimit } from "@/lib/rate-limit";

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(fs.readFileSync("prisma/migrations/20261020124520_init/migration.sql", "utf8"));
  await pg.exec(fs.readFileSync("prisma/migrations/20261021010000_release_hardening/migration.sql", "utf8"));
  await pg.exec(`INSERT INTO "User" (id,email,"passwordHash","ageConfirmedAt","updatedAt") VALUES ('u','u@example.com','x',now(),now())`);
}, 30000);
afterAll(async () => { await pg?.close(); });
beforeEach(async () => { await pg.exec('DELETE FROM "AuthToken"; DELETE FROM "RateLimit"'); });

describe("database-backed auth tokens", () => {
  it("stores only a hash and consumes a token once across repeated claims", async () => {
    const token = await issueToken("u", "RESET_PASSWORD");
    const stored = (await pg.query<{ tokenHash: string }>('SELECT "tokenHash" FROM "AuthToken"')).rows[0];
    expect(stored.tokenHash).not.toContain(token);
    const claims = await Promise.all(Array.from({ length: 10 }, () => consumeToken(token, "RESET_PASSWORD")));
    expect(claims.filter(Boolean)).toEqual(["u"]);
  });
  it("invalidates an earlier link when a new link is issued", async () => {
    const old = await issueToken("u", "VERIFY_EMAIL");
    const current = await issueToken("u", "VERIFY_EMAIL");
    expect(await consumeToken(old, "VERIFY_EMAIL")).toBeNull();
    expect(await consumeToken(current, "VERIFY_EMAIL")).toBe("u");
  });
  it("rejects expired tokens, a different purpose and malformed tokens", async () => {
    const token = await issueToken("u", "RESET_PASSWORD", -1000);
    expect(await consumeToken(token, "RESET_PASSWORD")).toBeNull();
    const live = await issueToken("u", "VERIFY_EMAIL");
    expect(await consumeToken(live, "RESET_PASSWORD")).toBeNull();
    expect(await consumeToken("arbitrary", "VERIFY_EMAIL")).toBeNull();
    expect(await consumeToken(live, "VERIFY_EMAIL")).toBe("u");
  });
});

describe("shared rate limits", () => {
  it("permits only the configured count across calls and hashes identifying keys", async () => {
    const results = await Promise.all(Array.from({ length: 15 }, () => rateLimit("login:user@example.com", 8, 60000)));
    expect(results.filter(Boolean)).toHaveLength(8);
    const stored = (await pg.query<{ key: string; hits: number }>('SELECT key,hits FROM "RateLimit"')).rows[0];
    expect(stored.key).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.hits).toBe(9);
  });
  it("resets an expired window and keeps unrelated accounts independent", async () => {
    expect(await rateLimit("a", 1, 60000)).toBe(true);
    expect(await rateLimit("a", 1, 60000)).toBe(false);
    expect(await rateLimit("b", 1, 60000)).toBe(true);
    await pg.exec(`UPDATE "RateLimit" SET "resetAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')-interval '1 second'`);
    expect(await rateLimit("a", 1, 60000)).toBe(true);
  });
});
