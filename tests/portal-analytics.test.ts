import fs from "node:fs";
import crypto from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { portalSnapshotQuery } from "../src/lib/portal-query";
import { safeSnapshot, snapshotIsReconciled, type PortalSnapshot } from "../src/lib/portal-metrics";
import { portalActivityQuery, type PortalActivityPage } from "../src/lib/portal-activity";
import { adminCountsQuery, adminOverviewQuery, adminUsersQuery, type AdminUserPage } from "../src/lib/admin-query";

let pg: PGlite, member: string, admin: string;
const uuid = () => crypto.randomUUID();
const person = async (role = "USER") => { const id = uuid(); await pg.query(`INSERT INTO "User" (id,email,"passwordHash","ageConfirmedAt","emailVerifiedAt","updatedAt",role) VALUES ($1,$2,'test',now(),now(),now(),$3::"Role")`, [id, id + "@example.com", role]); return id; };
const fund = async (id = member, days = 50) => { const key = uuid(); await pg.query(`INSERT INTO "WalletJournal" (id,"operationKey","userId",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents","createdAt") VALUES ($1,$1,$2,'OPENING','Opening test credit',1000000,-1000000,0,(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')-($3::int * interval '1 day'))`, [key, id, days]); };
async function snapshot(id = member) { const q = portalSnapshotQuery(id); return (await pg.query<{ snapshot: PortalSnapshot }>(q.text, q.values)).rows[0].snapshot; }
async function mature(ageDays = 40) {
  const id = uuid();
  await pg.query(`INSERT INTO "TradingAllocation" (id,"userId","requestKey","principalCents",currency,network,"payoutAddress","termsVersion","termsSnapshot",status,"approvedAt","approvedById","unlocksAt") VALUES ($1,$2,$1,50000,'USDT','ERC20','0x1111111111111111111111111111111111111111','draft-v1','{}','ACTIVE',(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')-($4::int * interval '1 day'),$3,(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')+((33-$4::int) * interval '1 day'))`, [id, member, admin, ageDays]);
  await pg.query(`INSERT INTO "WalletJournal" (id,"operationKey","userId","allocationId",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents","lockedDeltaCents","createdAt") VALUES ($1,$1,$2,$3,'TRADING_LOCK','Test allocation lock',-50000,0,0,50000,(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')-interval '40 days')`, [uuid(), member, id]);
  return id;
}
const result = async (id: string, profit: number) => (await pg.query<{ result: string }>(`SELECT trading_record_result($1,$2,$3,'Verified actual historical result') AS result`, [id, admin, profit])).rows[0].result;
const pay = async (id: string, amount: number) => (await pg.query<{ result: string }>(`SELECT trading_record_payout($1,$2,$3,$4,'Verified external payout or total loss') AS result`, [id, admin, amount, amount ? "0x" + crypto.randomBytes(32).toString("hex") : ""])).rows[0].result;

beforeAll(async () => { pg = new PGlite(); for (const dir of fs.readdirSync("prisma/migrations").filter(n => /^\d/.test(n)).sort()) await pg.exec(fs.readFileSync(`prisma/migrations/${dir}/migration.sql`, "utf8")); }, 30000);
afterAll(async () => { await pg?.close(); });
beforeEach(async () => { member = await person(); admin = await person("ADMIN"); });

describe("V2 financial overview from the existing records", () => {
  it("joins the highest active membership, keeps filters and bounds CRM pagination without returning password hashes", async () => {
    const label = uuid() + "%_", planId = uuid();
    await pg.query('UPDATE "User" SET name=$2,tags=ARRAY[$2] WHERE id=$1', [member, label]);
    await pg.query(`INSERT INTO "Plan"(id,slug,name,tagline,"priceCents",tier,features) VALUES($1,$1,'Form Room','Test plan',2900,1,'{}')`, [planId]);
    await pg.query(`INSERT INTO "Subscription"(id,"userId","planId","endsAt") VALUES($1,$2,$3,(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')+interval '33 days')`, [uuid(), member, planId]);
    const higher = uuid(), expired = uuid();
    await pg.query(`INSERT INTO "Plan"(id,slug,name,tagline,"priceCents",tier,features) VALUES($1,$1,'Inner Circle','Test plan',7900,2,'{}'),($2,$2,'Expired plan','Test plan',9900,9,'{}')`, [higher, expired]);
    await pg.query(`INSERT INTO "Subscription"(id,"userId","planId","endsAt") VALUES($1,$3,$4,(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')+interval '33 days'),($2,$3,$5,(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')-interval '1 day')`, [uuid(), uuid(), member, higher, expired]);
    const query = async (search: string, filter: string, page = 1) => { const q = adminUsersQuery(search, filter, page); return (await pg.query<{ data: AdminUserPage }>(q.text, q.values)).rows[0].data; };
    const data = await query(label, 'subscribers');
    expect(data.total).toBe(1); expect(data.users[0].id).toBe(member); expect(data.users[0].planName).toBe('Inner Circle');
    expect(data.users[0]).not.toHaveProperty('passwordHash');
    expect((await query(label, 'free')).total).toBe(0);
    expect((await query(label, 'admins')).total).toBe(0);
    expect((await query(label, 'subscribers', 2)).users).toEqual([]);
    expect((await query("' OR 1=1--", 'all')).total).toBe(0);
  });
  it("returns identical financial totals without generating chart history for summary pages", async () => {
    await fund(member, 400); const id = await mature(); await result(id, -2500);
    const full = await snapshot();
    const query = portalSnapshotQuery(member, false);
    const summary = safeSnapshot((await pg.query<{ snapshot: PortalSnapshot }>(query.text, query.values)).rows[0].snapshot);
    expect(full.series).toHaveLength(366); expect(summary.series).toEqual([]);
    const { series: _series, asOf: _time, ...expected } = full;
    const { series: _empty, asOf: _now, ...actual } = summary;
    expect(actual).toEqual(expected);
  });
  it("batches admin counts and excludes future lock maturities", async () => {
    const counts = async () => { const q = adminCountsQuery(); return (await pg.query<{ deposits: number; pending: number; due: number }>(q.text, q.values)).rows[0]; };
    const before = await counts(); await fund(); await mature();
    expect((await counts()).due).toBe(before.due + 1);
    await mature(1);
    expect((await counts()).due).toBe(before.due + 1);
    const q = adminOverviewQuery(); const overview = (await pg.query<{ users: number; revenue: number }>(q.text, q.values)).rows[0];
    expect(overview.users).toBeGreaterThanOrEqual(2); expect(overview.revenue).toBe(0);
  });
  it("has an honest empty state without inventing value or yield", async () => {
    const s = await snapshot(); expect(s.series).toEqual([]); expect(s.valueCents).toBe(0); expect(s.recordedProfitCents).toBe(0); expect(s.resultCount).toBe(0); expect(snapshotIsReconciled(s)).toBe(true);
  });
  it("does not treat deposits or a lock as earnings", async () => {
    await fund(); await mature(); const s = await snapshot();
    expect(s.availableCents).toBe(950000); expect(s.valueCents).toBe(1000000); expect(s.committedCents).toBe(50000); expect(s.recordedProfitCents).toBe(0); expect(s.resultCount).toBe(0); expect(snapshotIsReconciled(s)).toBe(true);
  });
  it("does not subtract a pending request from available funds", async () => {
    await fund(); const id = uuid(); await pg.query(`INSERT INTO "TradingAllocation" (id,"userId","requestKey","principalCents",currency,network,"payoutAddress","termsVersion","termsSnapshot") VALUES ($1,$2,$1,50000,'USDT','ERC20','0x1111111111111111111111111111111111111111','draft-v1','{}')`, [id, member]);
    const s = await snapshot(); expect(s.pendingCount).toBe(1); expect(s.valueCents).toBe(1000000); expect(s.committedCents).toBe(0);
  });
  it("includes an unpaid recorded result once, without double-counting principal", async () => {
    await fund(); const id = await mature(); expect(await result(id, 2500)).toBe("recorded"); const s = await snapshot();
    expect(s.activePrincipalCents).toBe(0); expect(s.payoutDueCents).toBe(52500); expect(s.valueCents).toBe(1002500); expect(s.recordedProfitCents).toBe(2500); expect(s.resultPrincipalCents).toBe(50000); expect(snapshotIsReconciled(s)).toBe(true);
  });
  it("removes an external payout from current value but preserves historical profit", async () => {
    await fund(); const id = await mature(); await result(id, 2500); expect(await pay(id, 52500)).toBe("paid"); const s = await snapshot();
    expect(s.valueCents).toBe(950000); expect(s.paidOutCents).toBe(52500); expect(s.payoutDueCents).toBe(0); expect(s.recordedProfitCents).toBe(2500); expect(snapshotIsReconciled(s)).toBe(true);
  });
  it("reports a total loss correctly before and after zero-payout closure", async () => {
    await fund(); const id = await mature(); await result(id, -50000); let s = await snapshot();
    expect(s.valueCents).toBe(950000); expect(s.recordedProfitCents).toBe(-50000); expect(s.payoutDueCents).toBe(0); expect(snapshotIsReconciled(s)).toBe(true);
    await pay(id, 0); s = await snapshot(); expect(s.valueCents).toBe(950000); expect(s.paidOutCents).toBe(0); expect(snapshotIsReconciled(s)).toBe(true);
  });
  it("carries the opening balance into the bounded year chart", async () => {
    await fund(member, 400); const s = await snapshot(); expect(s.series).toHaveLength(366); expect(s.series[0].valueCents).toBe(1000000); expect(s.series.at(-1)?.valueCents).toBe(1000000);
  });
  it("scopes both metrics and searchable activity to the signed-in member", async () => {
    const other = await person(); await fund(other); expect((await snapshot()).valueCents).toBe(0);
    const q = portalActivityQuery(member, "all", "", 1); const data = (await pg.query<{ activity: PortalActivityPage }>(q.text, q.values)).rows[0].activity; expect(data.rows).toEqual([]); expect(data.total).toBe(0);
  });
  it("includes results before payout and offers stable pagination", async () => {
    await fund(); const id = await mature(); await result(id, 2500);
    const q = portalActivityQuery(member, "result", "", 1); const data = (await pg.query<{ activity: PortalActivityPage }>(q.text, q.values)).rows[0].activity;
    expect(data.total).toBe(1); expect(data.rows[0].amountCents).toBe(2500); expect(data.rows[0].creditDeltaCents).toBe(0);
    const q2 = portalActivityQuery(member, "all", "", 2, 1); const page = (await pg.query<{ activity: PortalActivityPage }>(q2.text, q2.values)).rows[0].activity; expect(page.total).toBe(3); expect(page.rows).toHaveLength(1);
  });
  it("treats search input as a literal parameter, not SQL or a wildcard", async () => {
    await fund(); const q = portalActivityQuery(member, "all", "%_' OR 1=1--", 1); const data = (await pg.query<{ activity: PortalActivityPage }>(q.text, q.values)).rows[0].activity; expect(data.total).toBe(0);
  });
  it("rejects values that cannot be displayed exactly as integer cents", async () => {
    const s = await snapshot(); expect(() => safeSnapshot({ ...s, valueCents: Number.MAX_SAFE_INTEGER + 1 })).toThrow("supported range");
  });
});
