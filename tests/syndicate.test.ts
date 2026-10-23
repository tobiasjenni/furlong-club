import fs from "node:fs";
import crypto from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { allocationLockDays, lockRemaining, tradingStatus } from "../src/lib/trading";
import { countdownParts, nextSyndicateEntry, type SyndicateEntry } from "../src/lib/syndicate";
import { cycleWindow } from "../src/lib/daily-results";

let pg: PGlite, owner: string, member: string, allocation: string, key: string;
const future = "future-syndicate-fixture", past = "past-syndicate-fixture";
const address = "0x1111111111111111111111111111111111111111";
const scalar = async (sql: string, args: unknown[] = []) => (await pg.query<{result: unknown}>(sql,args)).rows[0]?.result;
const request = (entry = future, terms = "lunar-v1-2026-10-23") => scalar(`SELECT trading_request($1,$2,$3,50000,'USDT','ERC20',$4,$5,$6) AS result`,[member,allocation,key,address,terms,entry]);
const review = () => scalar(`SELECT trading_review($1,$2,true,'Verified selected entry, funds and receiving wallet') AS result`,[allocation,owner]);
const change = (enabled: boolean, actor = owner, revision = 1, event = crypto.randomUUID()) => scalar(`SELECT syndicate_set_entry($1,$2,$3,$4,'Reviewed syndicate availability',$5) AS result`,[actor,future,enabled,revision,event]);
beforeAll(async()=>{
  pg=new PGlite();
  for(const d of fs.readdirSync("prisma/migrations").filter(d=>/^\d/.test(d)).sort()) await pg.exec(fs.readFileSync(`prisma/migrations/${d}/migration.sql`,"utf8"));
  await pg.exec(`INSERT INTO "SyndicateEntry"(id,phase,"startsAt") VALUES('${future}','FULL',date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'UTC')+interval '10 years 6 days'),('${past}','FULL','2000-01-01');`);
},30000);
afterAll(async()=>{await pg?.close();});
beforeEach(async()=>{
  owner=crypto.randomUUID();member=crypto.randomUUID();allocation=crypto.randomUUID();key=crypto.randomUUID();
  for(const [id,role]of [[owner,'SUPER_ADMIN'],[member,'USER']]) await pg.query(`INSERT INTO "User"(id,email,role,"passwordHash","ageConfirmedAt","emailVerifiedAt","updatedAt") VALUES($1,$2,$3::"Role",'fixture',now(),now(),now())`,[id,id+'@example.com',role]);
  await pg.query(`INSERT INTO "WalletJournal"(id,"operationKey","userId",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents") VALUES($1,$1,$2,'OPENING','Simulated funding',100000,-100000,0)`,[crypto.randomUUID(),member]);
  await pg.exec(`UPDATE "TradingProgram" SET "enrollmentEnabled"=true; UPDATE "SyndicateEntry" SET accepting=true,revision=1 WHERE id='${future}';`);
});

it("seeds the requested first two moon dates, with midnight UTC starts and exact 28-day maturities",async()=>{
  const entries=(await pg.query(`SELECT phase,to_char("startsAt",'YYYY-MM-DD HH24:MI') AS start,to_char("startsAt"+interval '28 days','YYYY-MM-DD HH24:MI') AS maturity FROM "SyndicateEntry" WHERE id LIKE 'moon-%' ORDER BY "startsAt" LIMIT 2`)).rows;
  expect(entries).toEqual([{phase:'FULL',start:'2026-10-26 00:00',maturity:'2026-11-23 00:00'},{phase:'NEW',start:'2026-11-09 00:00',maturity:'2026-12-07 00:00'}]);
  expect(await scalar(`SELECT count(*)::int AS result FROM (SELECT date_trunc('month',"startsAt"),count(*) FROM "SyndicateEntry" WHERE id LIKE 'moon-%' AND "startsAt">='2026-11-01' GROUP BY 1 HAVING count(*)<>2) x`)).toBe(0);
});
it("reserves capital at approval but measures the period from the selected start",async()=>{
  expect(await request()).toBe('requested');
  expect(await scalar(`SELECT "balanceCents" AS result FROM "User" WHERE id=$1`,[member])).toBe(100000);
  expect(await review()).toBe('approved');
  expect(await scalar(`SELECT "balanceCents" AS result FROM "User" WHERE id=$1`,[member])).toBe(50000);
  const row=(await pg.query<{startsAt:Date;approvedAt:Date;unlocksAt:Date;termsSnapshot:Record<string,unknown>}>(`SELECT "startsAt","approvedAt","unlocksAt","termsSnapshot" FROM "TradingAllocation" WHERE id=$1`,[allocation])).rows[0];
  expect(row.startsAt.getTime()).toBeGreaterThan(row.approvedAt.getTime());expect(row.unlocksAt.getTime()-row.startsAt.getTime()).toBe(28*86400000);
  expect(row.termsSnapshot).toMatchObject({trader:'Rob',lockDays:28,lockBegins:'scheduled syndicate start',syndicateEntryId:future,membershipRequired:false});
  expect(await scalar(`SELECT trading_record_result($1,$2,1000,'Actual result cannot be entered early') AS result`,[allocation,owner])).toBe('locked');
  expect(await scalar(`SELECT sum("userDeltaCents"+"clearingDeltaCents"+"revenueDeltaCents"+"lockedDeltaCents"+"tradingResultDeltaCents")::int AS result FROM "WalletJournal" WHERE "userId"=$1`,[member])).toBe(0);
  expect(await review()).toBe('not_pending');
});
it("binds replay protection and immutable consent to the selected entry",async()=>{
  expect(await request()).toBe('requested');expect(await request()).toBe('duplicate');expect(await request(past)).toBe('request_conflict');
  await expect(pg.query(`UPDATE "TradingAllocation" SET "syndicateEntryId"=NULL,"startsAt"=NULL WHERE id=$1`,[allocation])).rejects.toThrow('immutable');
  await expect(pg.query(`UPDATE "SyndicateEntry" SET "startsAt"="startsAt"+interval '1 day' WHERE id=$1`,[future])).rejects.toThrow('immutable');
  await expect(pg.query(`DELETE FROM "SyndicateEntry" WHERE id=$1`,[future])).rejects.toThrow('append-only');
});
it("rejects stale forms, missing entries, passed dates and forged old terms without reserving funds",async()=>{
  expect(await scalar(`SELECT trading_request($1,$2,$3,50000,'USDT','ERC20',$4,'manual-v2-2026-10-23') AS result`,[member,allocation,key,address])).toBe('terms_changed');
  expect(await request(future,'manual-v2-2026-10-23')).toBe('invalid');expect(await request('missing-entry')).toBe('entry_closed');expect(await request(past)).toBe('entry_closed');
  expect(await scalar(`SELECT count(*)::int AS result FROM "TradingAllocation" WHERE "userId"=$1`,[member])).toBe(0);
  expect(await scalar(`SELECT "balanceCents" AS result FROM "User" WHERE id=$1`,[member])).toBe(100000);
});
it("checks entry availability again at approval without moving or rolling funds",async()=>{
  expect(await request()).toBe('requested');expect(await change(false)).toBe('saved');expect(await review()).toBe('entry_closed');
  expect(await scalar(`SELECT "balanceCents" AS result FROM "User" WHERE id=$1`,[member])).toBe(100000);
  expect(await scalar(`SELECT "syndicateEntryId" AS result FROM "TradingAllocation" WHERE id=$1`,[allocation])).toBe(future);
  expect(await change(true,owner,2)).toBe('saved');expect(await review()).toBe('approved');
});
it("restricts schedule controls to the current owner and rejects stale revisions",async()=>{
  expect(await change(false,member)).toBe('forbidden');
  const observer=crypto.randomUUID();await pg.query(`INSERT INTO "User"(id,email,role,"passwordHash","ageConfirmedAt","updatedAt") VALUES($1,$2,'ADMIN','x',now(),now())`,[observer,observer+'@example.com']);
  expect(await change(false,observer)).toBe('forbidden');expect(await change(false)).toBe('saved');expect(await change(true)).toBe('stale');
  expect(await scalar(`SELECT count(*)::int AS result FROM "AuditLog" WHERE action='syndicate.entry_updated' AND "actorId"=$1`,[owner])).toBe(1);
  await pg.query(`UPDATE "User" SET status='SUSPENDED' WHERE id=$1`,[observer]);expect(await change(true,observer,2)).toBe('forbidden');
});
it("rolls back a schedule change when its audit cannot be appended",async()=>{
  const event=crypto.randomUUID();await pg.query(`INSERT INTO "AuditLog"(id,action) VALUES($1,'fixture')`,[event]);
  await expect(change(false,owner,1,event)).rejects.toThrow();
  expect(await scalar(`SELECT accepting AS result FROM "SyndicateEntry" WHERE id=$1`,[future])).toBe(true);
});
it("shows scheduled capital separately from an in-progress period and retains legacy durations",()=>{
  const now=new Date('2026-10-23T00:00:00Z'),start=new Date('2026-10-26T00:00:00Z'),end=new Date('2026-11-23T00:00:00Z');
  expect(tradingStatus({status:'ACTIVE',startsAt:start,unlocksAt:end},now)).toContain('awaiting syndicate start');
  expect(lockRemaining(end,now,start)).toBe('Entry in 3 days 0 hours');
  expect(allocationLockDays({startsAt:start,approvedAt:now,unlocksAt:end})).toBe(28);
  expect(allocationLockDays({approvedAt:now,unlocksAt:new Date(now.getTime()+33*86400000)})).toBe(33);
  expect(cycleWindow('2026-11-23')).toEqual({start:'2026-10-27',end:'2026-11-23'});
});
it("rolls the countdown to the following entry exactly at the UTC start",()=>{
  const entries:SyndicateEntry[]=[{id:'a',phase:'FULL',startsAt:'2026-10-26T00:00:00Z',endsAt:'2026-11-23T00:00:00Z'},{id:'b',phase:'NEW',startsAt:'2026-11-09T00:00:00Z',endsAt:'2026-12-07T00:00:00Z'}];
  expect(countdownParts(entries[0].startsAt,Date.parse('2026-10-25T23:59:59Z'))).toEqual({days:0,hours:0,minutes:0,seconds:1});
  expect(nextSyndicateEntry(entries,Date.parse(entries[0].startsAt))?.id).toBe('b');
  expect(countdownParts(entries[0].startsAt,Date.parse(entries[1].startsAt))).toEqual({days:0,hours:0,minutes:0,seconds:0});
  expect(nextSyndicateEntry(entries,Date.parse(entries[1].startsAt))).toBeNull();
});

it("upgrades an already-approved allocation without changing its dates, terms or ledger",async()=>{
  const upgrade=new PGlite();
  try {
    const migrations=fs.readdirSync('prisma/migrations').filter(d=>/^\d/.test(d)).sort();
    for(const d of migrations.filter(d=>d<'20261023080000_lunar_syndicates')) await upgrade.exec(fs.readFileSync(`prisma/migrations/${d}/migration.sql`,'utf8'));
    await upgrade.exec(`INSERT INTO "User"(id,email,"passwordHash","ageConfirmedAt","emailVerifiedAt","updatedAt") VALUES('legacy-member','legacy-member@example.com','x',now(),now(),now());
      INSERT INTO "TradingAllocation"(id,"userId","requestKey","principalCents",currency,network,"payoutAddress","termsVersion","termsSnapshot",status,"approvedAt","approvedById","unlocksAt","reviewedAt","reviewedById","reviewNote")
      VALUES('legacy-active','legacy-member','legacy-key',50000,'USDT','ERC20','${address}','manual-v2-2026-10-23','{"lockDays":33}','ACTIVE','2026-10-20','historical-owner','2026-11-22','2026-10-20','historical-owner','Historical approval');
      INSERT INTO "WalletJournal"(id,"operationKey","userId",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents") VALUES('legacy-opening','legacy-opening','legacy-member','OPENING','Historical credit',100000,-100000,0);
      INSERT INTO "WalletJournal"(id,"operationKey","userId","allocationId",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents","lockedDeltaCents") VALUES('legacy-lock','legacy-lock','legacy-member','legacy-active','TRADING_LOCK','Historical lock',-50000,0,0,50000);`);
    const before=(await upgrade.query(`SELECT "approvedAt","unlocksAt","termsVersion","termsSnapshot" FROM "TradingAllocation" WHERE id='legacy-active'`)).rows[0];
    await upgrade.exec(fs.readFileSync('prisma/migrations/20261023080000_lunar_syndicates/migration.sql','utf8'));
    expect((await upgrade.query(`SELECT "approvedAt","unlocksAt","termsVersion","termsSnapshot" FROM "TradingAllocation" WHERE id='legacy-active'`)).rows[0]).toEqual(before);
    expect((await upgrade.query(`SELECT "startsAt","syndicateEntryId" FROM "TradingAllocation" WHERE id='legacy-active'`)).rows[0]).toEqual({startsAt:null,syndicateEntryId:null});
    expect((await upgrade.query(`SELECT count(*)::int AS n FROM "WalletJournal" WHERE "allocationId"='legacy-active'`)).rows[0]).toEqual({n:1});
    expect((await upgrade.query(`SELECT "balanceCents" FROM "User" WHERE id='legacy-member'`)).rows[0]).toEqual({balanceCents:50000});
  } finally {await upgrade.close();}
},30000);
