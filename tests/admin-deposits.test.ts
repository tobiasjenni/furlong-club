import fs from 'node:fs';
import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { adminDepositsQuery, adminDepositStatus, type AdminDepositPage, type DepositHistoryStatus } from '../src/lib/admin-deposits';

let pg: PGlite, member: string, owner: string;
const uuid=()=>crypto.randomUUID();
async function person(role='USER'){const id=uuid();await pg.query(`INSERT INTO "User"(id,email,name,"passwordHash",role,"ageConfirmedAt","emailVerifiedAt","updatedAt") VALUES($1,$2,$1,'test',$3::"Role",now(),now(),now())`,[id,id+'@example.com',role]);return id;}
async function deposit(status='PENDING',provider='manual',stamp='2026-10-24T00:00:00Z') {const id=uuid();await pg.query(`INSERT INTO "Payment"(id,"userId",purpose,"amountCents",currency,network,provider,status,"createdAt","updatedAt","submittedAt") VALUES($1,$2,'WALLET_TOPUP',50000,'USDT','ERC20',$3,$4::"PaymentStatus",$5::timestamp,now(),CASE WHEN $4='CONFIRMING' THEN $5::timestamp END)`,[id,member,provider,status,stamp]);return id;}
async function query(view:'review'|'history'='history',q=member,status:DepositHistoryStatus='all',page=1){const sql=adminDepositsQuery(view,q,status,page);return (await pg.query<{data:AdminDepositPage}>(sql.text,sql.values)).rows[0].data;}
beforeAll(async()=>{pg=new PGlite();for(const dir of fs.readdirSync('prisma/migrations').filter(n=>/^\d/.test(n)).sort())await pg.exec(fs.readFileSync(`prisma/migrations/${dir}/migration.sql`,'utf8'));},30000);
afterAll(async()=>{await pg?.close();});
beforeEach(async()=>{member=await person();owner=await person('SUPER_ADMIN');});

it('keeps the oldest manual review queue separate from complete multi-provider history',async()=>{
 const old=await deposit('CONFIRMING','manual','2026-10-22T00:00:00Z'),fresh=await deposit('CONFIRMING','manual','2026-10-23T00:00:00Z');
 const pending=await deposit(),failed=await deposit('FAILED'),expired=await deposit('EXPIRED'),provider=await deposit('CONFIRMING','nowpayments');
 const all=await query();expect(new Set(all.rows.map(p=>p.id))).toEqual(new Set([old,fresh,pending,failed,expired,provider]));expect(all.total).toBe(6);expect(all.rows.every(p=>p.userId===member&&p.email.endsWith('@example.com'))).toBe(true);
 const review=await query('review','ignored in review');expect(review.rows.filter(p=>p.userId===member).map(p=>p.id)).toEqual([old,fresh]);expect(review.reviewCount).toBeGreaterThanOrEqual(2);
 expect((await query('history',member,'FAILED')).rows.map(p=>p.id)).toEqual([failed]);expect((await query('history',member,'CONFIRMED')).total).toBe(0);
});
it('searches member identity, deposit references and hashes literally without exposing credentials or private notes',async()=>{
 const label=uuid()+'%_',pid=await deposit('CONFIRMING'),hash='0x'+crypto.randomBytes(32).toString('hex');await pg.query('UPDATE "User" SET name=$2 WHERE id=$1',[member,label]);await pg.query('UPDATE "Payment" SET "submittedTxHash"=$2,"manualReviewNote"=\'PRIVATE REVIEW NOTE\' WHERE id=$1',[pid,hash]);
 for(const search of [label,pid,hash.toUpperCase(),member+'@example.com']){const data=await query('history',search);expect(data.total).toBe(1);expect(data.rows[0].id).toBe(pid);expect(data.rows[0]).not.toHaveProperty('passwordHash');expect(JSON.stringify(data)).not.toContain('PRIVATE REVIEW NOTE');}
 expect((await query('history',"%' OR 1=1--")).total).toBe(0);expect((await query('history',uuid())).rows).toEqual([]);
});
it('paginates newest first with stable IDs for equal dates and keeps complete matching counts',async()=>{
 const ids=[];for(let i=0;i<27;i++)ids.push(await deposit());
 const expected=ids.sort().reverse(),first=await query(),second=await query('history',member,'all',2),third=await query('history',member,'all',3);
 expect(first.total).toBe(27);expect(first.rows.map(p=>p.id)).toEqual(expected.slice(0,25));expect(second.rows.map(p=>p.id)).toEqual(expected.slice(25));expect(second.total).toBe(27);expect(third.rows).toEqual([]);
});
it('shows posted credit plus linked corrections without rewriting requests or treating unreported transfers as money',async()=>{
 const pid=uuid(),hash='0x'+crypto.randomBytes(32).toString('hex');await pg.query(`SELECT wallet_create_manual_deposit($1,$2,50000,'USDT','ERC20','0x1111111111111111111111111111111111111111')`,[member,pid]);await pg.query('SELECT wallet_report_manual_deposit($1,$2,$3)',[pid,member,hash]);await pg.query(`SELECT wallet_review_manual_deposit($1,$2,true,$3,'SIMULATED verified receipt')`,[pid,owner,hash]);
 const stamp=(await pg.query<{at:string}>(`SELECT to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS') AS at FROM "User" WHERE id=$1`,[member])).rows[0].at;
 await pg.query(`SELECT wallet_admin_adjust_credit($1,$2,50000,'SIMULATED additional verified receipt credit',$3::timestamp,50000,$4,$5,'test')`,[owner,member,stamp,uuid(),pid]);
 const pending=await deposit();const data=await query();expect(data.rows.find(p=>p.id===pid)).toMatchObject({amountCents:50000,creditCents:100000,correctionCents:50000,status:'CONFIRMED',transactionHash:hash});expect(data.rows.find(p=>p.id===pending)).toMatchObject({creditCents:null,correctionCents:0,status:'PENDING'});
 expect(adminDepositStatus({status:'FAILED',providerStatus:'cancelled'})).toBe('Cancelled');expect(adminDepositStatus({status:'FAILED',providerStatus:'admin_rejected'})).toBe('Rejected');
 expect((await pg.query<{c:number}>('SELECT "balanceCents" AS c FROM "User" WHERE id=$1',[member])).rows[0].c).toBe(100000);
});
