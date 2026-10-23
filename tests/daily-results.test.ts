import fs from 'node:fs';
import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { compoundedPercent, cycleWindow, parseReturnBps, signedPercent } from '../src/lib/daily-results';

describe('daily percentage calculations',()=>{
  it.each([['2.50',250],['-1.25',-125],['+3',300],['0',0],['-100',-10000],['1000',100000],[' 1.02 ',102]])('parses %s into basis points', (text,bps)=>expect(parseReturnBps(text)).toBe(bps));
  it.each(['1.234','NaN','Infinity','1e2','-100.01','1000.01','','2%','1,25','--1'])('rejects invalid input %s',text=>expect(parseReturnBps(text)).toBeNull());
  it('compounds gains and losses, including a mathematical 148% fixture',()=>{
    expect(compoundedPercent([{day:'2020-01-01',returnBps:1000},{day:'2020-01-02',returnBps:-1000}])).toBeCloseTo(-1,10);
    expect(compoundedPercent([{day:'2020-01-01',returnBps:10000},{day:'2020-01-02',returnBps:-2000},{day:'2020-01-03',returnBps:5500}])).toBeCloseTo(148,10);
  });
  it('keeps missing history distinct from a real zero return and handles total loss',()=>{
    expect(compoundedPercent([])).toBeNull();
    expect(compoundedPercent([{day:'2020-01-01',returnBps:0}])).toBe(0);
    expect(compoundedPercent([{day:'2020-01-01',returnBps:-10000},{day:'2020-01-02',returnBps:1000}])).toBe(-100);
    expect(()=>compoundedPercent([{day:'2020-01-01',returnBps:-10001}])).toThrow();
    expect(signedPercent(-0.0001)).toBe('0.00%');
    expect(signedPercent(148)).toBe('+148.00%');
  });
  it('counts a 33-day calendar window across month boundaries',()=>expect(cycleWindow('2026-10-25',33)).toEqual({start:'2026-09-23',end:'2026-10-25'}));
});

let pg:PGlite,owner:string,admin:string,member:string;
const scalar=async(sql:string,args:unknown[]=[]) => (await pg.query<{result:unknown}>(sql,args)).rows[0]?.result;
async function user(role:string){const id=crypto.randomUUID();await pg.query(`INSERT INTO "User"(id,email,role,"passwordHash","ageConfirmedAt","updatedAt") VALUES($1,$2,$3::"Role",'fixture',now(),now())`,[id,`${id}@example.com`,role]);return id;}
const save=(actor:string,day='2020-02-29',bps=250,revision=0,publish=true,note='Supporting statement reference for this daily result',event=crypto.randomUUID())=>scalar(`SELECT club_save_daily_result($1,$2,$3,$4,$5,$6,$7) AS result`,[actor,day,bps,note,revision,publish,event]);
beforeAll(async()=>{pg=new PGlite();for(const dir of fs.readdirSync('prisma/migrations').filter(n=>/^\d/.test(n)).sort())await pg.exec(fs.readFileSync(`prisma/migrations/${dir}/migration.sql`,'utf8'));},30000);
afterAll(async()=>{await pg?.close();});
beforeEach(async()=>{await pg.exec('TRUNCATE "ClubDailyResult", "ClubCycleSummary"');owner=await user('SUPER_ADMIN');admin=await user('ADMIN');member=await user('USER');});

describe('owner-managed shared performance records',()=>{
  it('publishes, corrects and retracts a day with immutable before/after audit records',async()=>{
    expect(await save(owner)).toBe('saved');
    expect(await save(owner,'2020-02-29',-125,1)).toBe('saved');
    expect(await save(owner,'2020-02-29',999,2,false,'Correction: retract the disputed statement figure')).toBe('saved');
    expect((await pg.query(`SELECT "returnBps",published,revision FROM "ClubDailyResult"`)).rows[0]).toEqual({returnBps:-125,published:false,revision:3});
    expect(await save(owner,'2020-02-29',150,3)).toBe('saved');
    const events=(await pg.query<{action:string;meta:object}>(`SELECT action,meta FROM "AuditLog" WHERE "actorId"=$1 ORDER BY "createdAt",id`,[owner])).rows;
    expect(events).toHaveLength(4);
    expect(events.some(e=>e.action==='club.daily_result_retracted')).toBe(true);
    expect(events.some(e=>JSON.stringify(e.meta).includes('"returnBps":-125'))).toBe(true);
    await expect(pg.query(`DELETE FROM "ClubDailyResult"`)).rejects.toThrow('append-only');
  });
  it('rejects stale edits and stale first writes without overwriting a newer value',async()=>{
    expect(await save(owner)).toBe('saved');
    expect(await save(owner,'2020-02-29',500,0)).toBe('stale');
    expect(await save(owner,'2020-02-29',-200,1)).toBe('saved');
    expect(await save(owner,'2020-02-29',900,1)).toBe('stale');
    expect(await scalar(`SELECT "returnBps" AS result FROM "ClubDailyResult"`)).toBe(-200);
    expect(await save(owner,'2020-03-01',200,5)).toBe('stale');
  });
  it('keeps members and read-only Admins from writing and rechecks current active authority',async()=>{
    expect(await save(member)).toBe('forbidden');expect(await save(admin)).toBe('forbidden');
    expect(await save('missing')).toBe('forbidden');
    await pg.query(`UPDATE "User" SET status='SUSPENDED' WHERE id=$1`,[admin]);
    expect(await save(admin)).toBe('forbidden');
    expect(await scalar(`SELECT count(*)::int AS result FROM "ClubDailyResult"`)).toBe(0);
  });
  it.each(['2020-02-30','2020-2-29','not-a-day','1999-12-31'])('rejects invalid day %s',async day=>expect(await save(owner,day)).toBe('invalid_day'));
  it('refuses future dates and unsupported percentages, notes or revisions',async()=>{
    const tomorrow=String(await scalar(`SELECT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')+interval '1 day','YYYY-MM-DD') AS result`));
    expect(await save(owner,tomorrow)).toBe('invalid_day');
    expect(await save(owner,'2020-02-29',-10001)).toBe('invalid');
    expect(await save(owner,'2020-02-29',100001)).toBe('invalid');
    expect(await save(owner,'2020-02-29',250,-1)).toBe('invalid');
    expect(await save(owner,'2020-02-29',250,0,true,'short')).toBe('invalid');
    expect(await save(owner,'2020-02-29',250,0,false)).toBe('missing');
  });
  it('rolls back a new publication when its audit event cannot be appended',async()=>{
    const event=crypto.randomUUID();await pg.query(`INSERT INTO "AuditLog"(id,action) VALUES($1,'fixture')`,['daily-result:'+event]);
    await expect(save(owner,'2020-02-29',250,0,true,'Statement check complete',event)).rejects.toThrow();
    expect(await scalar(`SELECT count(*)::int AS result FROM "ClubDailyResult"`)).toBe(0);
  });
  it('never creates wallet credits, allocation results or payout records',async()=>{
    const journal=crypto.randomUUID();await pg.query(`INSERT INTO "WalletJournal"(id,"operationKey","userId",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents") VALUES($1,$1,$2,'OPENING','Fixture funding',50000,-50000,0)`,[journal,member]);
    expect(await save(owner)).toBe('saved');
    expect(await scalar(`SELECT "balanceCents" AS result FROM "User" WHERE id=$1`,[member])).toBe(50000);
    expect(await scalar(`SELECT count(*)::int AS result FROM "WalletJournal" WHERE "userId"=$1`,[member])).toBe(1);
    expect(await scalar(`SELECT count(*)::int AS result FROM "TradingAllocation" WHERE "userId"=$1`,[member])).toBe(0);
  });
});

describe('explicit owner-reported cycle summaries',()=>{
  const summary=(actor:string,revision=0,published=true,bps=14800,event=crypto.randomUUID())=>scalar(`SELECT club_save_cycle_summary($1,'2026-10-25',$2,'Owner supplied cycle figure; daily evidence pending',$3,$4,$5) AS result`,[actor,bps,revision,published,event]);
  it('keeps a supplied cycle figure separate from any daily history or wallet postings',async()=>{
    expect(await summary(owner)).toBe('saved');
    expect(await scalar(`SELECT "profitBps" AS result FROM "ClubCycleSummary"`)).toBe(14800);
    expect(await scalar(`SELECT count(*)::int AS result FROM "ClubDailyResult"`)).toBe(0);
    expect(await scalar(`SELECT count(*)::int AS result FROM "WalletJournal" WHERE "userId"=$1`,[member])).toBe(0);
    expect(await summary(owner,1,false)).toBe('saved');
    expect(await scalar(`SELECT count(*)::int AS result FROM "ClubCycleSummary" WHERE published`)).toBe(0);
    expect(await summary(owner,1)).toBe('stale');
    expect(await summary(owner,2,true,14700)).toBe('saved');
    expect(await scalar(`SELECT count(*)::int AS result FROM "AuditLog" WHERE "actorId"=$1 AND action='club.cycle_summary_updated'`,[owner])).toBe(3);
  });
  it('retains the current owner check and rolls back cycle edits on audit failure',async()=>{
    expect(await summary(admin)).toBe('forbidden');expect(await summary(member)).toBe('forbidden');
    expect(await summary(owner)).toBe('saved');
    const event=crypto.randomUUID();await pg.query(`INSERT INTO "AuditLog"(id,action) VALUES($1,'fixture')`,['cycle-summary:'+event]);
    await expect(summary(owner,1,true,-500,event)).rejects.toThrow();
    expect(await scalar(`SELECT "profitBps" AS result FROM "ClubCycleSummary"`)).toBe(14800);
    await expect(pg.query(`DELETE FROM "ClubCycleSummary"`)).rejects.toThrow('append-only');
  });
});

it('upgrades existing owners with only the supplied aggregate claim, without fabricating daily data',async()=>{
  const upgrade=new PGlite();
  try{
    const migrations=fs.readdirSync('prisma/migrations').filter(n=>/^\d/.test(n)).sort();
    for(const dir of migrations.filter(n=>n<'20261023040000_club_daily_results'))await upgrade.exec(fs.readFileSync(`prisma/migrations/${dir}/migration.sql`,'utf8'));
    const id=crypto.randomUUID();await upgrade.query(`INSERT INTO "User"(id,email,role,"passwordHash","ageConfirmedAt","updatedAt") VALUES($1,'upgrade-owner@example.com','SUPER_ADMIN','fixture',now(),now())`,[id]);
    for(const dir of migrations.filter(n=>n>='20261023040000_club_daily_results')) await upgrade.exec(fs.readFileSync(`prisma/migrations/${dir}/migration.sql`,'utf8'));
    expect((await upgrade.query(`SELECT to_char("endDay",'YYYY-MM-DD') AS day,"profitBps" FROM "ClubCycleSummary"`)).rows[0]).toEqual({day:'2026-10-25',profitBps:14800});
    expect((await upgrade.query(`SELECT count(*)::int AS n FROM "ClubDailyResult"`)).rows[0]).toEqual({n:0});
    expect((await upgrade.query(`SELECT action FROM "AuditLog" WHERE target='harry'`)).rows[0]).toEqual({action:'club.cycle_summary_owner_reported'});
  }finally{await upgrade.close();}
},30000);
