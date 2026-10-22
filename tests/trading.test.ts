import fs from "node:fs";
import crypto from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { lockRemaining, normalizePayoutAddress, tradingStatus } from "../src/lib/trading";

let pg: PGlite;
let member: string, admin: string, allocation: string, requestKey: string;
const address = "0x7d0bDf5510620428330E9FD08d806ED7C87b163c";
const tron = "TPGPga3MfPrFThgFeGnBrfQN4aRCMPH5mf";
const hash = () => "0x" + crypto.randomBytes(32).toString("hex");
const scalar = async (sql: string, args: unknown[] = []) => (await pg.query<{ result: unknown }>(sql, args)).rows[0]?.result;
const user = async (role = "USER") => {
  const id = crypto.randomUUID();
  await pg.query(`INSERT INTO "User" (id,email,"passwordHash","ageConfirmedAt","emailVerifiedAt","updatedAt",role) VALUES ($1,$2,'x',now(),now(),now(),$3::"Role")`, [id, `${id}@example.com`, role]);
  await pg.query(`INSERT INTO "Subscription"(id,"userId","planId","endsAt") VALUES($1,$2,'trading-test-plan',(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')+interval '33 days')`, [crypto.randomUUID(), id]);
  return id;
};
const fund = async (uid = member, cents = 2000000) => {
  const op = crypto.randomUUID();
  await pg.query(`INSERT INTO "WalletJournal" (id,"operationKey","userId",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents") VALUES ($1,$1,$2,'OPENING','Test funding',$3::integer,-$3::integer,0)`, [op, uid, cents]);
};
const request = (cents = 50000, aid = allocation, uid = member, key = requestKey, coin = "USDT", chain = "ERC20", destination = address) => scalar(`SELECT trading_request($1,$2,$3,$4,$5,$6,$7,'manual-v1-2026-10-22') AS result`, [uid, aid, key, cents, coin, chain, destination]);
const review = (approve = true, aid = allocation, actor = admin, note = "Verified member, terms and payout destination") => scalar(`SELECT trading_review($1,$2,$3,$4) AS result`, [aid, actor, approve, note]);
const result = (profit = 2500, aid = allocation, actor = admin, note = "Verified actual result from trading records") => scalar(`SELECT trading_record_result($1,$2,$3,$4) AS result`, [aid, actor, profit, note]);
const payout = (tx = hash(), amount = 52500, aid = allocation, actor = admin) => scalar(`SELECT trading_record_payout($1,$2,$3,$4,'Verified completed external transfer') AS result`, [aid, actor, amount, tx]);
const balance = () => scalar(`SELECT "balanceCents" AS result FROM "User" WHERE id=$1`, [member]);
const locked = () => scalar(`SELECT COALESCE(sum("lockedDeltaCents"),0)::int AS result FROM "WalletJournal" WHERE "userId"=$1`, [member]);
// Historical fixture simulates an already-approved allocation. Production never has a time override.
const mature = async (principal = 50000, aid = allocation) => {
  await pg.query(`INSERT INTO "TradingAllocation" (id,"userId","requestKey","principalCents",currency,network,"payoutAddress","termsVersion","termsSnapshot",status,"approvedAt","approvedById","unlocksAt","reviewedAt","reviewedById","reviewNote")
    VALUES ($1,$2,$1,$3,'USDT','ERC20',$4,'draft-v1','{}','ACTIVE',(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')-interval '34 days',$5,(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')-interval '1 day',(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')-interval '34 days',$5,'Historical test approval')`, [aid, member, principal, address, admin]);
  await pg.query(`INSERT INTO "WalletJournal" (id,"operationKey","userId","allocationId",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents","lockedDeltaCents") VALUES ($1,$1,$2,$3,'TRADING_LOCK','Historical simulated lock',-$4::integer,0,0,$4::integer)`, [`fixture:${aid}`, member, aid, principal]);
};

beforeAll(async () => {
  pg = new PGlite();
  for (const dir of fs.readdirSync("prisma/migrations").filter(n => /^\d/.test(n)).sort()) await pg.exec(fs.readFileSync(`prisma/migrations/${dir}/migration.sql`, "utf8"));
  await pg.exec(`INSERT INTO "Plan"(id,slug,name,tagline,"priceCents",tier,features) VALUES('trading-test-plan','form','Form Room','Test membership',2900,1,'{}')`);
}, 30000);
afterAll(async () => { await pg?.close(); });
beforeEach(async () => {
  member = await user(); admin = await user("SUPER_ADMIN"); allocation = crypto.randomUUID(); requestKey = crypto.randomUUID();
  await fund();
  await pg.exec(`UPDATE "TradingProgram" SET "enrollmentEnabled"=true WHERE id='harry'`);
});

describe("allocation approval, lock and accounting", () => {
  it("requires current paid membership when requesting and again when approving", async () => {
    await pg.query(`UPDATE "Subscription" SET status='CANCELLED' WHERE "userId"=$1`, [member]);
    expect(await request()).toBe("membership_required");
    await pg.query(`UPDATE "Subscription" SET status='ACTIVE' WHERE "userId"=$1`, [member]);
    expect(await request()).toBe("requested");
    await pg.query(`UPDATE "Subscription" SET "endsAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')-interval '1 second' WHERE "userId"=$1`, [member]);
    expect(await review()).toBe("membership_required"); expect(await locked()).toBe(0);
    expect(await review(false)).toBe("rejected");
  });
  it("saves the new membership and non-contractual target terms", async () => {
    await request();
    const a=(await pg.query<{termsVersion:string;termsSnapshot:Record<string,unknown>}>(`SELECT "termsVersion","termsSnapshot" FROM "TradingAllocation" WHERE id=$1`,[allocation])).rows[0];
    expect(a.termsVersion).toBe("manual-v1-2026-10-22");
    expect(a.termsSnapshot).toMatchObject({membershipSlug:"form",targetsNonContractual:true,guaranteed:false,lockDays:33});
    expect(a.termsSnapshot).not.toHaveProperty("targetDailyMinPercent");
  });
  it("rejects stale draft terms and requires fresh acceptance for legacy pending requests", async () => {
    expect(await scalar(`SELECT trading_request($1,$2,$3,50000,'USDT','ERC20',$4,'draft-v1') AS result`,[member,allocation,requestKey,address])).toBe("invalid");
    await pg.query(`INSERT INTO "TradingAllocation"(id,"userId","requestKey","principalCents",currency,network,"payoutAddress","termsVersion","termsSnapshot") VALUES($1,$2,$1,50000,'USDT','ERC20',$3,'draft-v1','{}')`,[allocation,member,address]);
    expect(await review()).toBe("terms_changed"); expect(await locked()).toBe(0);
    expect(await review(false)).toBe("rejected");
  });
  it("opens or pauses enrollment only for the owner and records changes without moving funds", async () => {
    const observer=await user("ADMIN");
    const set=(actor:string,enabled:boolean)=>scalar(`SELECT trading_set_enrollment($1,$2,'Owner requested program state',$3) AS result`,[actor,enabled,crypto.randomUUID()]);
    expect(await set(observer,false)).toBe("forbidden");
    expect(await set(member,false)).toBe("forbidden");
    expect(await set(admin,false)).toBe("saved"); expect(await request()).toBe("closed");
    expect(await set(admin,false)).toBe("unchanged");
    expect(await set(admin,true)).toBe("saved"); expect(await request()).toBe("requested");
    expect(await scalar(`SELECT count(*)::int AS result FROM "AuditLog" WHERE action='trading.enrollment_changed' AND "actorId"=$1`,[admin])).toBe(2);
    expect(await locked()).toBe(0);
  });
  it("links a manual deposit to approved credit and then a separately approved 33-day allocation", async () => {
    const uid=await user(), pid=crypto.randomUUID(), tx=hash(), aid=crypto.randomUUID(), observer=await user("ADMIN");
    expect(await scalar(`SELECT wallet_create_manual_deposit($1,$2,50000,'USDT','ERC20','0x1111111111111111111111111111111111111111') AS result`,[uid,pid])).toBe("created");
    expect(await scalar(`SELECT wallet_report_manual_deposit($1,$2,$3) AS result`,[pid,uid,tx])).toBe("submitted");
    expect(await request(50000,aid,uid,crypto.randomUUID())).toBe("insufficient");
    expect(await scalar(`SELECT wallet_review_manual_deposit($1,$2,true,$3,'Verified exact incoming transfer') AS result`,[pid,observer,tx])).toBe("forbidden");
    expect(await scalar(`SELECT wallet_review_manual_deposit($1,$2,true,$3,'Verified exact incoming transfer') AS result`,[pid,admin,tx])).toBe("approved");
    const key=crypto.randomUUID(); expect(await request(50000,aid,uid,key)).toBe("requested");
    expect(await request(50000,aid,uid,key)).toBe("duplicate");
    expect(await review(true,aid,observer)).toBe("forbidden"); expect(await review(true,aid)).toBe("approved");
    expect(await scalar(`SELECT "balanceCents" AS result FROM "User" WHERE id=$1`,[uid])).toBe(0);
    expect(await scalar(`SELECT sum("lockedDeltaCents")::int AS result FROM "WalletJournal" WHERE "userId"=$1`,[uid])).toBe(50000);
    expect(await scalar(`SELECT count(*)::int AS result FROM "WalletJournal" WHERE "userId"=$1 AND "userDeltaCents"+"clearingDeltaCents"+"revenueDeltaCents"+"lockedDeltaCents"+"tradingResultDeltaCents"<>0`,[uid])).toBe(0);
  });
  it("closes enrollment at the database boundary and rechecks it on approval", async () => {
    await pg.exec(`UPDATE "TradingProgram" SET "enrollmentEnabled"=false`);
    expect(await request()).toBe("closed");
    await pg.exec(`UPDATE "TradingProgram" SET "enrollmentEnabled"=true`); await request();
    await pg.exec(`UPDATE "TradingProgram" SET "enrollmentEnabled"=false`);
    expect(await review()).toBe("closed"); expect(await locked()).toBe(0);
  });
  it.each([49999, 1000001, -50000, 0])("rejects out-of-range principal %s", async cents => {
    expect(await request(cents)).toBe("invalid"); expect(await locked()).toBe(0);
  });
  it.each([50000, 1000000])("accepts boundary principal %s", async cents => { expect(await request(cents)).toBe("requested"); });
  it("saves immutable terms/destination and leaves money available pending approval", async () => {
    expect(await request()).toBe("requested"); expect(await balance()).toBe(2000000); expect(await locked()).toBe(0);
    expect(await request()).toBe("duplicate");
    expect(await scalar(`SELECT ("termsSnapshot"->>'targetIsProvisional')::boolean AS result FROM "TradingAllocation" WHERE id=$1`, [allocation])).toBe(true);
    await expect(pg.query(`UPDATE "TradingAllocation" SET "payoutAddress"='0x1111111111111111111111111111111111111111' WHERE id=$1`, [allocation])).rejects.toThrow("immutable");
    await expect(pg.query(`DELETE FROM "TradingAllocation" WHERE id=$1`, [allocation])).rejects.toThrow("append-only");
  });
  it("detects replay conflicts and prevents another pending request", async () => {
    await request(); expect(await request(60000)).toBe("request_conflict");
    expect(await request(50000, crypto.randomUUID(), member, crypto.randomUUID())).toBe("pending_exists");
    expect(await request(50000, crypto.randomUUID(), admin)).toBe("request_conflict");
  });
  it("checks verified, active and unfrozen accounts and valid networks", async () => {
    expect(await request(50000, allocation, member, requestKey, "USDC", "TRC20", tron)).toBe("invalid_address");
    expect(await request(50000, allocation, member, requestKey, "USDT", "ERC20", "bad")).toBe("invalid_address");
    await pg.query(`UPDATE "User" SET "walletFrozen"=true WHERE id=$1`, [member]); expect(await request()).toBe("frozen");
    await pg.query(`UPDATE "User" SET "walletFrozen"=false,"emailVerifiedAt"=NULL WHERE id=$1`, [member]); expect(await request()).toBe("unverified");
  });
  it("moves available money into a balanced separate lock exactly once", async () => {
    await request(); expect(await review()).toBe("approved");
    expect(await balance()).toBe(1950000); expect(await locked()).toBe(50000);
    expect(await review()).toBe("not_pending"); expect(await balance()).toBe(1950000);
    expect(await scalar(`SELECT EXTRACT(EPOCH FROM ("unlocksAt"-"approvedAt"))::int AS result FROM "TradingAllocation" WHERE id=$1`, [allocation])).toBe(33 * 86400);
    await expect(pg.query(`UPDATE "TradingAllocation" SET "approvedAt"="approvedAt"-interval '1 day',"unlocksAt"="unlocksAt"-interval '1 day' WHERE id=$1`, [allocation])).rejects.toThrow("immutable");
  });
  it("rechecks funds at approval and cannot approve a frozen account", async () => {
    await request(1000000); const op = crypto.randomUUID();
    await pg.query(`INSERT INTO "WalletJournal" (id,"operationKey","userId",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents") VALUES ($1,$1,$2,'PURCHASE','Other spending',-1500000,0,1500000)`, [op, member]);
    expect(await review()).toBe("insufficient"); expect(await locked()).toBe(0);
    await fund(member, 1000000); await pg.query(`UPDATE "User" SET "walletFrozen"=true WHERE id=$1`, [member]);
    expect(await review()).toBe("unavailable");
  });
  it("caps total outstanding principal, including matured unpaid allocations", async () => {
    await mature(1000000); expect(await request(50000, crypto.randomUUID(), member, crypto.randomUUID())).toBe("limit");
  });
  it("does not let members or demoted/suspended admins approve", async () => {
    await request(); expect(await review(true, allocation, member)).toBe("forbidden");
    const observer = await user("ADMIN");
    expect(await review(true, allocation, observer)).toBe("forbidden");
    expect(await review(false, allocation, observer)).toBe("forbidden");
    await pg.query(`UPDATE "User" SET status='SUSPENDED' WHERE id=$1`, [observer]); expect(await review(true, allocation, observer)).toBe("forbidden");
  });
  it("requires review notes and lets members cancel only their own pending requests", async () => {
    await request(); expect(await review(true, allocation, admin, "x")).toBe("invalid_note");
    expect(await scalar(`SELECT trading_cancel($1,$2) AS result`, [allocation, admin])).toBe("not_pending");
    expect(await scalar(`SELECT trading_cancel($1,$2) AS result`, [allocation, member])).toBe("cancelled");
    expect(await review()).toBe("not_pending"); expect(await locked()).toBe(0);
  });
  it("declines without touching money and blocks account closure with open obligations", async () => {
    await request(); expect(await scalar(`SELECT wallet_close_account($1) AS result`, [member])).toBe("wallet_unresolved");
    expect(await review(false)).toBe("rejected"); expect(await locked()).toBe(0); expect(await balance()).toBe(2000000);
  });
  it("blocks member and admin closure even when all available credit is locked", async () => {
    const uid = await user(); await fund(uid, 50000);
    await request(50000, allocation, uid, requestKey); await review();
    expect(await scalar(`SELECT "balanceCents" AS result FROM "User" WHERE id=$1`, [uid])).toBe(0);
    expect(await scalar(`SELECT wallet_close_account($1) AS result`, [uid])).toBe("wallet_unresolved");
    await expect(pg.query(`UPDATE "User" SET status='CLOSED' WHERE id=$1`, [uid])).rejects.toThrow("Resolve trading obligations");
    const plan = crypto.randomUUID();
    await pg.query(`INSERT INTO "Plan" (id,slug,name,tagline,"priceCents",tier,features) VALUES ($1,$1,'Test plan','Test',1000,1,'{}')`, [plan]);
    expect(await scalar(`SELECT wallet_buy_plan($1,$2,1000,$3) AS result`, [uid, plan, crypto.randomUUID()])).toBe("insufficient");
  });
  it("rolls back approval if the journal or audit cannot be written", async () => {
    await request();
    await pg.exec(`CREATE FUNCTION fail_trading_posting() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='TRADING_LOCK' THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_trading_posting BEFORE INSERT ON "WalletJournal" FOR EACH ROW EXECUTE FUNCTION fail_trading_posting();`);
    try { await expect(review()).rejects.toThrow("injected failure"); } finally { await pg.exec(`DROP TRIGGER fail_trading_posting ON "WalletJournal"; DROP FUNCTION fail_trading_posting();`); }
    expect(await balance()).toBe(2000000); expect(await locked()).toBe(0);
    expect(await scalar(`SELECT status AS result FROM "TradingAllocation" WHERE id=$1`, [allocation])).toBe("PENDING");
  });
});

describe("actual result and manual external payout", () => {
  it("denies read-only Admin result and payout writes without changing the ledger", async () => {
    await mature(); const observer = await user("ADMIN");
    expect(await result(2500, allocation, observer)).toBe("forbidden");
    expect(await result()).toBe("recorded");
    expect(await payout(hash(), 52500, allocation, observer)).toBe("forbidden");
    expect(await locked()).toBe(50000);
    expect(await scalar(`SELECT status AS result FROM "TradingAllocation" WHERE id=$1`, [allocation])).toBe("PAYOUT_READY");
  });
  it("rejects early result and payout, without auto-accruing target returns", async () => {
    await request(); await review(); expect(await result()).toBe("locked"); expect(await payout()).toBe("not_ready");
    expect(await scalar(`SELECT "profitCents" AS result FROM "TradingAllocation" WHERE id=$1`, [allocation])).toBeNull();
  });
  it("records a real result only after maturity, without increasing available credit", async () => {
    await mature(); expect(await result()).toBe("recorded"); expect(await balance()).toBe(1950000); expect(await locked()).toBe(50000);
    expect(await scalar(`SELECT "payoutCents" AS result FROM "TradingAllocation" WHERE id=$1`, [allocation])).toBe(52500);
    expect(await result()).toBe("not_active");
    await expect(pg.query(`UPDATE "TradingAllocation" SET "profitCents"=3000,"payoutCents"=53000 WHERE id=$1`, [allocation])).rejects.toThrow("immutable");
  });
  it("records an external payout once with five balanced legs and no membership revenue", async () => {
    await mature(); await result(); const tx = hash();
    expect(await payout(tx)).toBe("paid"); expect(await payout(tx)).toBe("already_paid");
    expect(await locked()).toBe(0); expect(await balance()).toBe(1950000);
    const journal = (await pg.query(`SELECT "userDeltaCents","lockedDeltaCents","clearingDeltaCents","tradingResultDeltaCents","revenueDeltaCents" FROM "WalletJournal" WHERE "allocationId"=$1 AND kind='TRADING_PAYOUT'`, [allocation])).rows[0];
    expect(journal).toEqual({ userDeltaCents: 0, lockedDeltaCents: -50000, clearingDeltaCents: 52500, tradingResultDeltaCents: -2500, revenueDeltaCents: 0 });
    expect(await scalar(`SELECT count(*)::int AS result FROM "TradingEvent" WHERE "allocationId"=$1 AND action='paid'`, [allocation])).toBe(1);
  });
  it.each([-2500, -50000, 0])("handles actual loss/zero result %s", async profit => {
    await mature(); expect(await result(profit)).toBe("recorded"); const amount = 50000 + profit;
    expect(await payout(amount === 0 ? "" : hash(), amount)).toBe("paid"); expect(await locked()).toBe(0);
    expect(await scalar(`SELECT sum("userDeltaCents"::bigint+"lockedDeltaCents"::bigint+"clearingDeltaCents"::bigint+"revenueDeltaCents"::bigint+"tradingResultDeltaCents"::bigint)::int AS result FROM "WalletJournal" WHERE "allocationId"=$1`, [allocation])).toBe(0);
  });
  it("rejects results beyond the principal loss and wrong amounts or transaction hashes", async () => {
    await mature(); expect(await result(-50001)).toBe("invalid_result"); await result();
    expect(await payout("bad")).toBe("invalid_hash"); expect(await payout(hash(), 50000)).toBe("invalid_payout");
    expect(await locked()).toBe(50000);
  });
  it("rechecks current admin permissions and wallet freezes for results and payouts", async () => {
    await mature(); expect(await result(2500, allocation, member)).toBe("forbidden");
    await pg.query(`UPDATE "User" SET "walletFrozen"=true WHERE id=$1`, [member]); expect(await result()).toBe("frozen");
    await pg.query(`UPDATE "User" SET "walletFrozen"=false WHERE id=$1`, [member]); await result();
    expect(await payout(hash(), 52500, allocation, member)).toBe("forbidden");
    await pg.query(`UPDATE "User" SET "walletFrozen"=true WHERE id=$1`, [member]); expect(await payout()).toBe("frozen");
  });
  it("cannot reuse an incoming deposit transaction for a payout", async () => {
    await mature(); await result(); const pid = crypto.randomUUID(), tx = hash();
    await scalar(`SELECT wallet_create_manual_deposit($1,$2,2000,'USDT','ERC20',$3) AS result`, [member, pid, address]);
    await scalar(`SELECT wallet_report_manual_deposit($1,$2,$3) AS result`, [pid, member, tx]);
    await scalar(`SELECT wallet_review_manual_deposit($1,$2,true,$3,'Verified receipt') AS result`, [pid, admin, tx]);
    await expect(payout(tx)).rejects.toThrow("receipt_already_used"); expect(await locked()).toBe(50000);
    expect(await scalar(`SELECT status AS result FROM "TradingAllocation" WHERE id=$1`, [allocation])).toBe("PAYOUT_READY");
  });
  it("cannot reuse a payout transaction for a deposit or a second allocation", async () => {
    await mature(); await result(); const tx = hash(); await payout(tx);
    const pid = crypto.randomUUID();
    await scalar(`SELECT wallet_create_manual_deposit($1,$2,2000,'USDT','ERC20',$3) AS result`, [member, pid, address]);
    await scalar(`SELECT wallet_report_manual_deposit($1,$2,$3) AS result`, [pid, member, tx]);
    await expect(scalar(`SELECT wallet_review_manual_deposit($1,$2,true,$3,'Verified receipt') AS result`, [pid, admin, tx])).rejects.toThrow("receipt_already_used");
    const second = crypto.randomUUID(); await mature(50000, second); await result(2500, second);
    await expect(payout(tx, 52500, second)).rejects.toThrow("receipt_already_used");
  });
  it("preserves immutable payout references and events", async () => {
    await mature(); await result(); await payout();
    await expect(pg.query(`UPDATE "TradingPayoutClaim" SET "txHash"='changed' WHERE "allocationId"=$1`, [allocation])).rejects.toThrow("append-only");
    await expect(pg.query(`DELETE FROM "TradingEvent" WHERE "allocationId"=$1`, [allocation])).rejects.toThrow("append-only");
    await expect(pg.query(`UPDATE "TradingAllocation" SET "payoutNote"='changed' WHERE id=$1`, [allocation])).rejects.toThrow("immutable");
  });
});

describe("payout address and member display", () => {
  it("checks Ethereum EIP-55 and Tron Base58Check, rejecting typos and zero address", () => {
    expect(normalizePayoutAddress("ERC20", address)).toBe(address);
    expect(normalizePayoutAddress("ERC20", address.toLowerCase())).toBe(address);
    expect(normalizePayoutAddress("ERC20", address.replace("7d0b", "7D0b"))).toBeNull();
    expect(normalizePayoutAddress("ERC20", "0x" + "0".repeat(40))).toBeNull();
    expect(normalizePayoutAddress("TRC20", tron)).toBe(tron);
    expect(normalizePayoutAddress("TRC20", tron.slice(0, -1) + "g")).toBeNull();
    expect(normalizePayoutAddress("TRC20", address)).toBeNull();
  });
  it("distinguishes maturity, pending payout and completion without promising earnings", () => {
    const now = new Date("2026-10-21T00:00:00Z");
    expect(lockRemaining(new Date(now.getTime() + 33 * 86400000), now)).toBe("33 days 0 hours remaining");
    expect(tradingStatus({ status: "ACTIVE", unlocksAt: now }, now)).toContain("result review due");
    expect(lockRemaining(null, now)).toContain("admin approval");
    expect(tradingStatus({ status: "PAID", unlocksAt: now, payoutCents: 0 }, now)).toContain("total loss");
  });
});
