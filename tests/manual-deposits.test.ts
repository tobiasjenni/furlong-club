import fs from "node:fs";
import crypto from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let pg: PGlite;
let member: string, admin: string, payment: string, hash: string;
const address = "0x1111111111111111111111111111111111111111";
const rows = async <T>(sql: string, args: unknown[] = []) => (await pg.query<T>(sql, args)).rows;
const scalar = async (sql: string, args: unknown[] = []) => (await rows<{ result: unknown }>(sql, args))[0]?.result;
const user = async (role = "USER") => {
  const id = crypto.randomUUID();
  await pg.query(`INSERT INTO "User" (id,email,"passwordHash","ageConfirmedAt","emailVerifiedAt","updatedAt",role) VALUES ($1,$2,'x',now(),now(),now(),$3::"Role")`, [id, `${id}@example.com`, role]);
  return id;
};
const create = (pid = payment, uid = member, cents = 50000, chain = "ERC20") => scalar(`SELECT wallet_create_manual_deposit($1,$2,$3,'USDT',$4,$5) AS result`, [uid, pid, cents, chain, address]);
const report = (pid = payment, uid = member, tx = hash) => scalar(`SELECT wallet_report_manual_deposit($1,$2,$3) AS result`, [pid, uid, tx]);
const review = (pid = payment, actor = admin, approve = true, tx = hash, note = "Verified exact receipt and sender ownership") => scalar(`SELECT wallet_review_manual_deposit($1,$2,$3,$4,$5) AS result`, [pid, actor, approve, tx, note]);
const balance = (uid = member) => scalar(`SELECT "balanceCents" AS result FROM "User" WHERE id=$1`, [uid]);

beforeAll(async () => {
  pg = new PGlite();
  for (const dir of fs.readdirSync("prisma/migrations").filter(n => /^\d/.test(n)).sort()) await pg.exec(fs.readFileSync(`prisma/migrations/${dir}/migration.sql`, "utf8"));
}, 30000);
afterAll(async () => { await pg?.close(); });
beforeEach(async () => {
  member = await user(); admin = await user("SUPER_ADMIN"); payment = crypto.randomUUID(); hash = "0x" + crypto.randomBytes(32).toString("hex");
  expect(await create()).toBe("created");
});

describe("manual deposit lifecycle and financial controls", () => {
  it("allows an unconfirmed member only during the owner-requested verification pause and still blocks frozen wallets", async () => {
    const other = await user();
    await pg.query('UPDATE "User" SET "emailVerifiedAt"=NULL WHERE id=$1', [other]);
    expect(await create(crypto.randomUUID(), other)).toBe('unverified');
    await pg.exec('UPDATE "AuthPolicy" SET "emailVerificationRequired"=false');
    try {
      expect(await create(crypto.randomUUID(), other)).toBe('created');
      expect(await balance(other)).toBe(0);
      await pg.query('UPDATE "User" SET "walletFrozen"=true WHERE id=$1', [other]);
      expect(await create(crypto.randomUUID(), other)).toBe('frozen');
    } finally { await pg.exec('UPDATE "AuthPolicy" SET "emailVerificationRequired"=true'); }
    await pg.query('UPDATE "User" SET "walletFrozen"=false WHERE id=$1', [other]);
    expect(await create(crypto.randomUUID(), other)).toBe('unverified');
  });
  it("snapshots amount/network/address without adding spendable money", async () => {
    const p = (await rows<{ payAddress: string; poolAddress: string; amountCents: number; provider: string }>(`SELECT "payAddress","poolAddress","amountCents",provider FROM "Payment" WHERE id=$1`, [payment]))[0];
    expect(p).toEqual({ payAddress: address, poolAddress: address, amountCents: 50000, provider: "manual" });
    expect(await balance()).toBe(0);
    expect(await scalar(`SELECT count(*)::int AS result FROM "WalletJournal" WHERE "paymentId"=$1`, [payment])).toBe(0);
  });
  it("notifies the queue only when the owner reports sending, without credit", async () => {
    expect(await report()).toBe("submitted");
    expect(await balance()).toBe(0);
    expect(await scalar(`SELECT status::text AS result FROM "Payment" WHERE id=$1`, [payment])).toBe("CONFIRMING");
    expect(await scalar(`SELECT count(*)::int AS result FROM "PaymentEvent" WHERE "paymentId"=$1 AND decision='awaiting admin approval'`, [payment])).toBe(1);
  });
  it("rejects another member's report and malformed transaction IDs", async () => {
    expect(await report(payment, admin)).toBe("missing");
    expect(await report(payment, member, "not-a-transaction")).toBe("invalid_hash");
    expect(await balance()).toBe(0);
  });
  it("does not allow approval before a reported transfer or by a member", async () => {
    expect(await review()).toBe("not_pending");
    await report();
    expect(await review(payment, member)).toBe("forbidden");
    expect(await balance()).toBe(0);
  });
  it("rechecks the admin's current role/status", async () => {
    await report();
    const observer = await user("ADMIN");
    expect(await review(payment, observer)).toBe("forbidden");
    expect(await review(payment, observer, false)).toBe("forbidden");
    await pg.query(`UPDATE "User" SET status='SUSPENDED' WHERE id=$1`, [observer]);
    expect(await review(payment, observer)).toBe("forbidden");
    expect(await balance()).toBe(0);
  });
  it("approves exactly once and preserves reviewer, hash, receipt and balanced journal", async () => {
    await report();
    expect(await review()).toBe("approved");
    expect(await review()).toBe("already_approved");
    expect(await balance()).toBe(50000);
    const p = (await rows<{ reviewedById: string; payinHash: string; payoutHash: string | null; amount: string }>(`SELECT "reviewedById","payinHash","payoutHash","receivedAmount"::text AS amount FROM "Payment" WHERE id=$1`, [payment]))[0];
    expect(p).toMatchObject({ reviewedById: admin, payinHash: hash, payoutHash: null, amount: "500.000000000000000000" });
    expect(await scalar(`SELECT count(*)::int AS result FROM "WalletJournal" WHERE "paymentId"=$1`, [payment])).toBe(1);
    expect(await scalar(`SELECT ("userDeltaCents"+"clearingDeltaCents"+"revenueDeltaCents") AS result FROM "WalletJournal" WHERE "paymentId"=$1`, [payment])).toBe(0);
    expect(await scalar(`SELECT count(*)::int AS result FROM "AuditLog" WHERE target=$1 AND action='manual_deposit.approved'`, [payment])).toBe(1);
  });
  it("handles duplicate reports and competing approval retries idempotently", async () => {
    expect(await report()).toBe("submitted");
    expect(await report()).toBe("duplicate");
    const results = await Promise.all(Array.from({ length: 10 }, () => review()));
    expect(results.filter(r => r === "approved")).toHaveLength(1);
    expect(await balance()).toBe(50000);
  });
  it("rejects a transfer without credit and retains the member-visible reason", async () => {
    await report();
    expect(await review(payment, admin, false, "", "Amount does not match; submit the received amount")).toBe("rejected");
    expect(await balance()).toBe(0);
    expect(await review()).toBe("not_pending");
    expect(await scalar(`SELECT "reviewReason" AS result FROM "Payment" WHERE id=$1`, [payment])).toBe("Amount does not match; submit the received amount");
  });
  it("requires a review note and a valid verified hash", async () => {
    await report();
    expect(await review(payment, admin, true, hash, "x")).toBe("invalid_note");
    expect(await review(payment, admin, true, "bad")).toBe("invalid_hash");
    expect(await balance()).toBe(0);
  });
  it("prevents the same chain transaction from crediting another member or token", async () => {
    await report(); await review();
    const other = await user(); const pid = crypto.randomUUID();
    await create(pid, other); await report(pid, other, hash.toUpperCase().replace("0X", "0x"));
    await expect(review(pid)).rejects.toThrow("receipt_already_used");
    expect(await balance(other)).toBe(0);
    expect(await scalar(`SELECT status::text AS result FROM "Payment" WHERE id=$1`, [pid])).toBe("CONFIRMING");
  });
  it("does not reuse a provider's pooled payout as a manual deposit", async () => {
    const old = crypto.randomUUID();
    await create(old); await report(old, member, hash); await review(old);
    const payout = "0x" + crypto.randomBytes(32).toString("hex");
    await pg.query(`UPDATE "Payment" SET provider='nowpayments',"payoutHash"=$2 WHERE id=$1`, [old, payout]);
    await report(payment, member, payout);
    await expect(review(payment, admin, true, payout)).rejects.toThrow("receipt_already_used");
    expect(await balance()).toBe(50000);
  });
  it("allows distinct networks to use the same hash without conflating the chain", async () => {
    await report(); await review();
    const pid = crypto.randomUUID(); await create(pid, member, 2000, "TRC20");
    await report(pid, member, hash.slice(2));
    expect(await review(pid, admin, true, hash.slice(2))).toBe("approved");
    expect(await balance()).toBe(52000);
  });
  it("rolls back status, receipt reservation, credit and audit together if posting fails", async () => {
    await report();
    await pg.exec(`CREATE FUNCTION fail_manual_post() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='MANUAL_TOPUP' THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_manual BEFORE INSERT ON "WalletJournal" FOR EACH ROW EXECUTE FUNCTION fail_manual_post();`);
    try { await expect(review()).rejects.toThrow("injected failure"); } finally { await pg.exec('DROP TRIGGER fail_manual ON "WalletJournal"; DROP FUNCTION fail_manual_post()'); }
    expect(await balance()).toBe(0);
    expect(await scalar(`SELECT status::text AS result FROM "Payment" WHERE id=$1`, [payment])).toBe("CONFIRMING");
    expect(await scalar(`SELECT count(*)::int AS result FROM "ReceiptClaim" WHERE "paymentId"=$1`, [payment])).toBe(0);
    expect(await review()).toBe("approved");
  });
  it("preserves an existing wallet freeze when crediting a verified receipt", async () => {
    await report(); await pg.query(`UPDATE "User" SET "walletFrozen"=true WHERE id=$1`, [member]);
    expect(await review()).toBe("approved");
    expect(await scalar(`SELECT "walletFrozen" AS result FROM "User" WHERE id=$1`, [member])).toBe(true);
  });
  it("caps open requests and prevents unverified or frozen users from creating deposits", async () => {
    await create(crypto.randomUUID()); await create(crypto.randomUUID());
    expect(await create(crypto.randomUUID())).toBe("too_many_open");
    const other = await user();
    await pg.query(`UPDATE "User" SET "emailVerifiedAt"=NULL WHERE id=$1`, [other]);
    expect(await create(crypto.randomUUID(), other)).toBe("unverified");
    await pg.query(`UPDATE "User" SET "emailVerifiedAt"=now(),"walletFrozen"=true WHERE id=$1`, [other]);
    expect(await create(crypto.randomUUID(), other)).toBe("frozen");
  });
  it.each([0, 1999, 1000001, -2000])("rejects invalid requested cents %s", async cents => {
    expect(await create(crypto.randomUUID(), member, cents)).toBe("invalid");
  });
  it("cancels only an unsent request and retains late-transfer reporting", async () => {
    expect(await scalar(`SELECT wallet_cancel_manual_deposit($1,$2) AS result`, [payment, member])).toBe("cancelled");
    expect(await report()).toBe("submitted");
    expect(await scalar(`SELECT wallet_cancel_manual_deposit($1,$2) AS result`, [payment, member])).toBe("unavailable");
    expect(await scalar(`SELECT wallet_close_account($1) AS result`, [member])).toBe("wallet_unresolved");
  });
  it("keeps reviewed financial evidence append-only", async () => {
    await report(); await review();
    await expect(pg.query(`DELETE FROM "ReceiptClaim" WHERE "paymentId"=$1`, [payment])).rejects.toThrow("append-only");
    await expect(pg.query(`UPDATE "PaymentEvent" SET decision='changed' WHERE "paymentId"=$1`, [payment])).rejects.toThrow("append-only");
  });
});
