import fs from 'node:fs';
import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { adminUsersQuery, memberFundingQuery, type AdminUserPage, type MemberFunding } from '../src/lib/admin-query';
import { portalActivityQuery, type PortalActivityPage } from '../src/lib/portal-activity';
import { portalSnapshotQuery } from '../src/lib/portal-query';

let pg: PGlite, owner: string, member: string, op: string, stamp: string;
const uuid = () => crypto.randomUUID();
const rows = async <T>(sql: string, args: unknown[] = []) => (await pg.query<T>(sql,args)).rows;
const value = async (sql: string,args: unknown[] = []) => (await rows<{value: unknown}>(sql,args))[0]?.value;
async function person(role='USER') {const id=uuid();await pg.query(`INSERT INTO "User"(id,email,name,role,"passwordHash","ageConfirmedAt","updatedAt") VALUES($1,$2,$1,$3::"Role",'test-hash',now(),now())`,[id,id+'@example.com',role]);return id;}
const updated = async () => String(await value(`SELECT to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS') AS value FROM "User" WHERE id=$1`,[member]));
const balance = () => value('SELECT "balanceCents" AS value FROM "User" WHERE id=$1',[member]);
const adjust = async (delta=50000, options: {actor?:string;uid?:string;reason?:string;expected?:string;balance?:number;op?:string;receipt?:string;hash?:string}={}) => value('SELECT wallet_admin_adjust_credit($1,$2,$3,$4,$5::timestamp,$6,$7,$8,$9) AS value',[options.actor??owner,options.uid??member,delta,options.reason??'Owner verified an additional deposit receipt',options.expected??stamp,options.balance??await balance(),options.op??op,options.receipt??'',options.hash??'test-hash']);
const funding = async () => {const q=memberFundingQuery(member);return (await rows<{data:MemberFunding}>(q.text,q.values))[0].data;};
const crm = async(filter='all') => {const q=adminUsersQuery(member,filter,1);return (await rows<{data:AdminUserPage}>(q.text,q.values))[0].data;};
beforeAll(async()=>{pg=new PGlite();for(const dir of fs.readdirSync('prisma/migrations').filter(n=>/^\d/.test(n)).sort())await pg.exec(fs.readFileSync(`prisma/migrations/${dir}/migration.sql`,'utf8'));},30000);
afterAll(async()=>{await pg?.close();});
beforeEach(async()=>{owner=await person('SUPER_ADMIN');member=await person();op=uuid();stamp=await updated();});

describe('audited Super Admin credit corrections',()=>{
 it('atomically adds balanced credit, private reason, author and before/after amounts',async()=>{
  expect(await adjust()).toBe('saved');expect(await balance()).toBe(50000);
  const journal=(await rows<{userDeltaCents:number;clearingDeltaCents:number;lockedDeltaCents:number;description:string}>('SELECT * FROM "WalletJournal" WHERE "operationKey"=$1',['adjustment:'+op]))[0];
  expect(journal.userDeltaCents+journal.clearingDeltaCents).toBe(0);expect(journal.lockedDeltaCents).toBe(0);expect(journal.description).not.toContain('Owner verified');
  const log=(await rows<{actorId:string;meta:Record<string,unknown>}>('SELECT * FROM "AuditLog" WHERE id=$1',['adjustment:'+op]))[0];expect(log.actorId).toBe(owner);expect(log.meta).toMatchObject({beforeCents:0,afterCents:50000,deltaCents:50000,reason:'Owner verified an additional deposit receipt'});
  expect(await value('SELECT count(*)::int AS value FROM "CrmNote" WHERE id=$1 AND "authorId"=$2 AND "subjectId"=$3 AND body LIKE $4',['adjustment:'+op,owner,member,'%0.00 → 500.00%'])).toBe(1);
  expect((await funding())).toMatchObject({availableCents:50000,depositedCents:0,adjustmentCents:50000,committedCents:0});
 });
 it('deduplicates retries and rejects reuse with changed details or another member',async()=>{
  expect(await Promise.all([adjust(),adjust()])).toEqual(['saved','already_saved']);expect(await balance()).toBe(50000);
  expect(await adjust(60000)).toBe('conflict');expect(await adjust(50000,{reason:'Different reason for the same operation'})).toBe('conflict');
  const other=await person();expect(await adjust(50000,{uid:other})).toBe('conflict');
  expect(await value('SELECT count(*)::int AS value FROM "CrmNote" WHERE id=$1',['adjustment:'+op])).toBe(1);
 });
 it('rejects member, observer, suspended owner, changed owner password and protected accounts',async()=>{
  expect(await adjust(50000,{actor:member})).toBe('forbidden');expect(await adjust(50000,{actor:await person('ADMIN')})).toBe('forbidden');
  expect(await adjust(50000,{hash:'stale-hash'})).toBe('forbidden');expect(await adjust(50000,{uid:owner})).toBe('forbidden');
  // Owner protection prevents suspension: exercise a separate active staff account demoted after form render.
  const staff=await person('ADMIN');await pg.query('UPDATE "User" SET status=\'SUSPENDED\' WHERE id=$1',[staff]);expect(await adjust(50000,{actor:staff})).toBe('forbidden');
  expect(await balance()).toBe(0);
 });
 it('rejects stale forms even when an unrelated profile change leaves the balance unchanged',async()=>{
  await pg.query(`UPDATE "User" SET "updatedAt"="updatedAt"+interval '1 second',name='Changed profile' WHERE id=$1`,[member]);
  expect(await adjust()).toBe('stale');expect(await balance()).toBe(0);
 });
 it('blocks frozen or closed accounts, invalid amounts, reasons and references',async()=>{
  for(const delta of [0,1000001,-1000001])expect(await adjust(delta)).toBe('invalid');
  expect(await adjust(50000,{reason:'short'})).toBe('invalid');expect(await adjust(50000,{op:'-'.repeat(36)})).toBe('invalid');expect(await adjust(50000,{receipt:uuid()})).toBe('invalid_receipt');
  await pg.query('UPDATE "User" SET "walletFrozen"=true WHERE id=$1',[member]);expect(await adjust()).toBe('unavailable');
  await pg.query('UPDATE "User" SET "walletFrozen"=false,status=\'CLOSED\' WHERE id=$1',[member]);expect(await adjust()).toBe('unavailable');
  expect(await balance()).toBe(0);
 });
 it('deducts only spendable credit and cannot take locked principal',async()=>{
  expect(await adjust()).toBe('saved');
  const aid=uuid();await pg.query(`INSERT INTO "TradingAllocation"(id,"userId","requestKey","principalCents",currency,network,"payoutAddress","termsVersion","termsSnapshot",status,"approvedAt","approvedById","unlocksAt") VALUES($1,$2,$1,50000,'USDT','ERC20','0x1111111111111111111111111111111111111111','test','{}','ACTIVE',now(),$3,now()+interval '33 days')`,[aid,member,owner]);
  await pg.query(`INSERT INTO "WalletJournal"(id,"operationKey","userId","allocationId",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents","lockedDeltaCents") VALUES($1,$1,$2,$3,'TRADING_LOCK','Test lock',-50000,0,0,50000)`,[uuid(),member,aid]);
  stamp=await updated();expect(await adjust(-1,{op:uuid()})).toBe('insufficient');expect((await funding()).committedCents).toBe(50000);
  expect(await adjust(50000,{op:uuid()})).toBe('saved');stamp=await updated();expect(await adjust(-25000,{op:uuid()})).toBe('saved');expect(await balance()).toBe(25000);expect((await funding()).committedCents).toBe(50000);
 });
 it('links the missing $500 to a confirmed $500 receipt without rewriting it or treating it as profit',async()=>{
  const pid=uuid(),hash='0x'+'a'.repeat(64);await pg.query(`SELECT wallet_create_manual_deposit($1,$2,50000,'USDT','ERC20','0x1111111111111111111111111111111111111111')`,[member,pid]);
  // Email verification policy remains enforced by the deposit flow.
  await pg.query('UPDATE "User" SET "emailVerifiedAt"=now() WHERE id=$1',[member]);
  await pg.query(`SELECT wallet_create_manual_deposit($1,$2,50000,'USDT','ERC20','0x1111111111111111111111111111111111111111')`,[member,pid]);
  await pg.query('SELECT wallet_report_manual_deposit($1,$2,$3)',[pid,member,hash]);await pg.query(`SELECT wallet_review_manual_deposit($1,$2,true,$3,'Verified receipt fixture')`,[pid,owner,hash]);
  stamp=await updated();expect(await adjust(50000,{receipt:pid})).toBe('saved');expect(await balance()).toBe(100000);
  expect(await value('SELECT "amountCents" AS value FROM "Payment" WHERE id=$1',[pid])).toBe(50000);
  const q=portalActivityQuery(member,'adjustment','',1);const activity=(await rows<{activity:PortalActivityPage}>(q.text,q.values))[0].activity;expect(activity.total).toBe(1);expect(activity.rows[0]).toMatchObject({kind:'ADMIN_ADJUSTMENT',paymentId:pid,creditDeltaCents:50000});
  const f=await funding();expect(f.depositedCents).toBe(50000);expect(f.adjustmentCents).toBe(50000);
  const s=portalSnapshotQuery(member);expect((await rows<{snapshot:{valueCents:number;recordedProfitCents:number}}>(s.text,s.values))[0].snapshot).toMatchObject({valueCents:100000,recordedProfitCents:0});
  expect((await crm('paid')).total).toBe(1);expect((await crm('available')).total).toBe(1);expect((await crm('committed')).total).toBe(0);
 });
 it('rolls the entire posting back if its audit insert fails',async()=>{
  await pg.query(`INSERT INTO "AuditLog"(id,action) VALUES($1,'test collision')`,['adjustment:'+op]);
  await expect(adjust()).rejects.toThrow();expect(await balance()).toBe(0);
  expect(await value('SELECT count(*)::int AS value FROM "WalletJournal" WHERE "operationKey"=$1',['adjustment:'+op])).toBe(0);
  expect(await value('SELECT count(*)::int AS value FROM "CrmNote" WHERE id=$1',['adjustment:'+op])).toBe(0);
 });
 it('reports pending deposits and trading separately, without multiplying amounts across records',async()=>{
  await pg.query('UPDATE "User" SET "emailVerifiedAt"=now() WHERE id=$1',[member]);
  for(const cents of [50000,100000]){const p=uuid();await pg.query(`SELECT wallet_create_manual_deposit($1,$2,$3,'USDT','ERC20','0x1111111111111111111111111111111111111111')`,[member,p,cents]);await pg.query('SELECT wallet_report_manual_deposit($1,$2,$3)',[p,member,'0x'+crypto.randomBytes(32).toString('hex')]);}
  const aid=uuid();await pg.query(`INSERT INTO "TradingAllocation"(id,"userId","requestKey","principalCents",currency,network,"payoutAddress","termsVersion","termsSnapshot") VALUES($1,$2,$1,50000,'USDT','ERC20','0x1111111111111111111111111111111111111111','test','{}')`,[aid,member]);
  expect((await funding())).toMatchObject({reportedCents:150000,pendingTradeCents:50000,availableCents:0,committedCents:0});
  expect((await crm('deposit-review')).total).toBe(1);expect((await crm('trading-review')).total).toBe(1);expect((await crm('paid')).total).toBe(0);
 });
});
