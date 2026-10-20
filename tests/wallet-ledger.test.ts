import fs from "node:fs";
import crypto from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let pg: PGlite;
let uid: string, plan: string, payment: string;
const query = async <T>(sql: string, values: unknown[] = []) => (await pg.query<T>(sql, values)).rows;
const scalar = async (sql: string, values: unknown[] = []) => (await query<Record<string, unknown>>(sql, values))[0]?.result;
const balance = () => scalar('SELECT "balanceCents" AS result FROM "User" WHERE id=$1', [uid]);
const event = (extra: object = {}) => ({ status: "CONFIRMED", providerStatus: "finished", receivedAmount: "50.000001", outcomeAmount: "49.5", outcomeCurrency: "usdcmatic", payinHash: "incoming", payoutHash: "outgoing", updatedAt: "2026-10-20T15:00:00.000Z", validationError: null, ...extra });
const apply = (e = event(), key: string = crypto.randomUUID()) => scalar('SELECT wallet_apply_payment($1,$2,$3,$4::jsonb) AS result', [payment, key, "test", JSON.stringify(e)]);
const buy = (key = crypto.randomUUID(), price = 2900) => scalar('SELECT wallet_buy_plan($1,$2,$3,$4) AS result', [uid, plan, price, key]);

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(fs.readFileSync("prisma/migrations/20261020124520_init/migration.sql", "utf8"));
  await pg.exec(`INSERT INTO "User" (id,email,"passwordHash","ageConfirmedAt","updatedAt","balanceCents") VALUES ('legacy','legacy@example.com','x',now(),now(),1234)`);
  await pg.exec(fs.readFileSync("prisma/migrations/20261020160000_wallet/migration.sql", "utf8"));
}, 30000);
afterAll(async () => { await pg?.close(); });
beforeEach(async () => {
  uid = crypto.randomUUID(); plan = crypto.randomUUID(); payment = crypto.randomUUID();
  await pg.query(`INSERT INTO "User" (id,email,"passwordHash","ageConfirmedAt","emailVerifiedAt","updatedAt") VALUES ($1,$2,'x',now(),now(),now())`, [uid, `${uid}@example.com`]);
  await pg.query(`INSERT INTO "Plan" (id,slug,name,tagline,"priceCents",tier,features) VALUES ($1,$1,'Form Room','test',2900,1,'{}')`, [plan]);
  await pg.query(`INSERT INTO "Payment" (id,"userId","amountCents",currency,network,provider,purpose,"settlementStatus","updatedAt") VALUES ($1,$2,5000,'USDC','POLYGON','nowpayments','WALLET_TOPUP','PENDING',now())`, [payment, uid]);
});

describe("Postgres wallet ledger and migration", () => {
  it("carries forward existing balances without doubling or inventing a payment", async () => {
    expect(await scalar(`SELECT "balanceCents" AS result FROM "User" WHERE id='legacy'`)).toBe(1234);
    expect(await scalar(`SELECT "userDeltaCents" AS result FROM "WalletJournal" WHERE "userId"='legacy'`)).toBe(1234);
  });
  it("credits once when duplicate and simultaneous notifications arrive", async () => {
    await Promise.all([apply(event(), "repeat"), apply(event(), "repeat"), apply(event(), "other")]);
    expect(await balance()).toBe(5000);
    expect(await scalar('SELECT count(*)::int AS result FROM "WalletJournal" WHERE "paymentId"=$1', [payment])).toBe(1);
    expect(await scalar('SELECT count(*)::int AS result FROM "PaymentEvent" WHERE "paymentId"=$1', [payment])).toBe(2);
  });
  it("writes receipt and journal times in UTC even if the database session uses another timezone", async () => {
    await pg.exec("SET TIME ZONE 'Asia/Bangkok'");
    try {
      await apply();
      expect(await scalar(`SELECT ABS(EXTRACT(EPOCH FROM ("confirmedAt"-(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')))) < 10 AS result FROM "Payment" WHERE id=$1`, [payment])).toBe(true);
      expect(await scalar(`SELECT ABS(EXTRACT(EPOCH FROM ("createdAt"-(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')))) < 10 AS result FROM "WalletJournal" WHERE "paymentId"=$1`, [payment])).toBe(true);
    } finally { await pg.exec("SET TIME ZONE 'UTC'"); }
  });
  it("does not credit during incoming confirmation or transfer", async () => {
    await apply(event({ status: "CONFIRMING", providerStatus: "confirmed" }));
    expect(await balance()).toBe(0);
    expect(await scalar('SELECT "settlementStatus" AS result FROM "Payment" WHERE id=$1', [payment])).toBe("TRANSFERRING");
  });
  it("retains partial receipt quantities without issuing spendable credit", async () => {
    await apply(event({ status: "PARTIAL", providerStatus: "partially_paid", receivedAmount: "12.123456" }));
    expect(await balance()).toBe(0);
    expect(await scalar('SELECT "receivedAmount"::text AS result FROM "Payment" WHERE id=$1', [payment])).toBe("12.123456000000000000");
  });
  it("records failed validation and never credits it", async () => {
    await apply(event({ validationError: "Token or network mismatch" }));
    expect(await balance()).toBe(0);
    expect(await scalar('SELECT decision AS result FROM "PaymentEvent" WHERE "paymentId"=$1', [payment])).toBe("review: Token or network mismatch");
  });
  it("ignores stale events and keeps the newest crypto receipt", async () => {
    await apply(event({ status: "CONFIRMING", providerStatus: "sending" }));
    expect(await apply(event({ status: "PENDING", providerStatus: "waiting", updatedAt: "2026-10-19T12:00:00Z", receivedAmount: "0" }))).toBe("stale");
    expect(await scalar('SELECT status AS result FROM "Payment" WHERE id=$1', [payment])).toBe("CONFIRMING");
  });
  it("does not regress final payment status on an out-of-order waiting event", async () => {
    await apply(); await apply(event({ status: "PENDING", providerStatus: "waiting", updatedAt: undefined }));
    expect(await scalar('SELECT status AS result FROM "Payment" WHERE id=$1', [payment])).toBe("CONFIRMED");
    expect(await balance()).toBe(5000);
  });
  it("freezes spending when a credited payment is refunded, preserving the original posting", async () => {
    await apply(); await apply(event({ status: "FAILED", providerStatus: "refunded", updatedAt: "2026-10-21T12:00:00Z" }));
    expect(await buy()).toBe("frozen"); expect(await balance()).toBe(5000);
    expect(await scalar('SELECT "settlementStatus" AS result FROM "Payment" WHERE id=$1', [payment])).toBe("REVIEW");
  });
  it("credits a late valid payment after local expiry exactly once", async () => {
    await pg.query('UPDATE "Payment" SET status=\'EXPIRED\' WHERE id=$1', [payment]);
    await apply(); expect(await balance()).toBe(5000);
  });
  it("never spends more than the available balance during two purchases", async () => {
    await apply();
    const results = await Promise.all([buy(), buy()]);
    expect(results.sort()).toEqual(["insufficient", "purchased"]); expect(await balance()).toBe(2100);
    expect(await scalar('SELECT count(*)::int AS result FROM "Subscription" WHERE "userId"=$1', [uid])).toBe(1);
  });
  it("makes purchase retries idempotent and binds each key to its price", async () => {
    await apply(); const key = crypto.randomUUID();
    expect(await buy(key)).toBe("purchased"); expect(await buy(key)).toBe("duplicate");
    expect(await buy(key, 100)).toBe("request_conflict"); expect(await balance()).toBe(2100);
  });
  it("rejects changed plan prices without debiting credit", async () => {
    await apply(); expect(await buy(undefined, 100)).toBe("price_changed"); expect(await balance()).toBe(5000);
  });
  it("rejects suspended or unverified account purchases", async () => {
    await apply(); await pg.query('UPDATE "User" SET "emailVerifiedAt"=NULL WHERE id=$1', [uid]);
    expect(await buy()).toBe("unverified"); expect(await balance()).toBe(5000);
  });
  it("fulfills direct crypto membership atomically using invoice terms", async () => {
    await pg.query(`UPDATE "Payment" SET purpose='SUBSCRIPTION',"planId"=$2,"planName"='Snapshot name',"planDays"=45 WHERE id=$1`, [payment, plan]);
    await pg.query('UPDATE "Plan" SET "intervalDays"=1 WHERE id=$1', [plan]);
    await apply(); await apply();
    expect(await balance()).toBe(0);
    expect(await scalar('SELECT count(*)::int AS result FROM "Subscription" WHERE "userId"=$1', [uid])).toBe(1);
    expect(await scalar('SELECT EXTRACT(DAY FROM ("endsAt"-"startsAt"))::int AS result FROM "Subscription" WHERE "userId"=$1', [uid])).toBe(45);
  });
  it("rolls back payment status, credit, event, and journal together on a later failure", async () => {
    await pg.exec(`CREATE FUNCTION test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$;
      CREATE TRIGGER test_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION test_fail_audit();`);
    try { await expect(apply()).rejects.toThrow("injected failure"); }
    finally { await pg.exec('DROP TRIGGER test_failure ON "AuditLog"; DROP FUNCTION test_fail_audit()'); }
    expect(await balance()).toBe(0);
    expect(await scalar('SELECT count(*)::int AS result FROM "PaymentEvent" WHERE "paymentId"=$1', [payment])).toBe(0);
    expect(await scalar('SELECT status AS result FROM "Payment" WHERE id=$1', [payment])).toBe("PENDING");
    await apply(); expect(await balance()).toBe(5000);
  });
  it("rolls back a purchase debit if membership creation fails", async () => {
    await apply();
    await pg.exec(`CREATE FUNCTION test_fail_sub() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'subscription failure'; END $$;
      CREATE TRIGGER test_failure BEFORE INSERT ON "Subscription" FOR EACH ROW EXECUTE FUNCTION test_fail_sub();`);
    try { await expect(buy()).rejects.toThrow("subscription failure"); }
    finally { await pg.exec('DROP TRIGGER test_failure ON "Subscription"; DROP FUNCTION test_fail_sub()'); }
    expect(await balance()).toBe(5000);
  });
  it("enforces balanced, immutable financial postings and blocks direct balance edits", async () => {
    await apply();
    await expect(pg.query('UPDATE "WalletJournal" SET "userDeltaCents"=0 WHERE "userId"=$1', [uid])).rejects.toThrow("append-only");
    await expect(pg.query('DELETE FROM "PaymentEvent" WHERE "paymentId"=$1', [payment])).rejects.toThrow("append-only");
    await expect(pg.query('UPDATE "User" SET "balanceCents"=100 WHERE id=$1', [uid])).rejects.toThrow("journal posting");
    await expect(pg.query(`INSERT INTO "WalletJournal" (id,"userId","operationKey",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents") VALUES ('bad',$1,'bad','TOPUP','bad',100,0,0)`, [uid])).rejects.toThrow("balanced_posting");
  });
  it("reconciles all cached balances to the journal after funding and spending", async () => {
    await apply(); await buy();
    const drift = await query(`SELECT u.id FROM "User" u LEFT JOIN "WalletJournal" j ON j."userId"=u.id GROUP BY u.id HAVING u."balanceCents"<>COALESCE(sum(j."userDeltaCents"),0)`);
    expect(drift).toHaveLength(0);
    expect(await scalar('SELECT SUM("userDeltaCents"+"clearingDeltaCents"+"revenueDeltaCents")::int AS result FROM "WalletJournal"')).toBe(0);
  });
});
