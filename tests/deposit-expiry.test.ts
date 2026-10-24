import fs from 'node:fs';
import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { portalSnapshotQuery } from '../src/lib/portal-query';

let pg:PGlite,member:string,owner:string;
const id=()=>crypto.randomUUID(),hash=()=> '0x'+crypto.randomBytes(32).toString('hex');
async function scalar(sql:string,args:unknown[]=[]){return (await pg.query<{v:unknown}>(sql,args)).rows[0]?.v;}
async function create(){const pid=id();expect(await scalar(`SELECT wallet_create_manual_deposit($1,$2,1000000,'USDC','ERC20','0x1111111111111111111111111111111111111111') AS v`,[member,pid])).toBe('created');return pid;}
async function age(pid:string,minutes:number){await pg.query(`UPDATE "Payment" SET "createdAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')-$2::integer*interval '1 minute',"expiresAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')+(60-$2::integer)*interval '1 minute' WHERE id=$1`,[pid,minutes]);}
async function expire(uid:string|null=member){return scalar('SELECT wallet_expire_manual_deposits($1) AS v',[uid]);}
async function status(pid:string){return scalar('SELECT status::text AS v FROM "Payment" WHERE id=$1',[pid]);}
beforeAll(async()=>{pg=new PGlite();for(const dir of fs.readdirSync('prisma/migrations').filter(n=>/^\d/.test(n)).sort())await pg.exec(fs.readFileSync(`prisma/migrations/${dir}/migration.sql`,'utf8'));},30000);
afterAll(async()=>{await pg?.close();});
beforeEach(async()=>{member=id();owner=id();for(const [uid,role] of [[member,'USER'],[owner,'SUPER_ADMIN']])await pg.query(`INSERT INTO "User"(id,email,"passwordHash",role,"ageConfirmedAt","emailVerifiedAt","updatedAt") VALUES($1,$2,'test',$3::"Role",now(),now(),now())`,[uid,uid+'@example.com',role]);});

it('sets a 60-minute deadline and expires only when due, retaining one immutable audit event without money movement',async()=>{
 const pid=await create();expect(await scalar(`SELECT extract(epoch FROM ("expiresAt"-"createdAt"))::int AS v FROM "Payment" WHERE id=$1`,[pid])).toBe(3600);
 await age(pid,59);expect(await expire()).toBe(0);expect(await status(pid)).toBe('PENDING');
 await age(pid,60);expect(await expire()).toBe(1);expect(await status(pid)).toBe('EXPIRED');expect(await expire()).toBe(0);
 expect(await scalar(`SELECT count(*)::int AS v FROM "PaymentEvent" WHERE "paymentId"=$1 AND "eventKey"='auto-expired'`,[pid])).toBe(1);
 expect(await scalar(`SELECT count(*)::int AS v FROM "AuditLog" WHERE target=$1 AND action='manual_deposit.auto_expired'`,[pid])).toBe(1);
 expect(await scalar('SELECT "balanceCents" AS v FROM "User" WHERE id=$1',[member])).toBe(0);
 expect(await scalar('SELECT count(*)::int AS v FROM "WalletJournal" WHERE "paymentId"=$1',[pid])).toBe(0);
});
it('never expires reported or confirmed funds and keeps an old reported transfer visible in the member summary',async()=>{
 const pid=await create(),tx=hash();await age(pid,120);await pg.query('SELECT wallet_report_manual_deposit($1,$2,$3)',[pid,member,tx]);
 expect(await expire()).toBe(0);expect(await status(pid)).toBe('CONFIRMING');
 const q=portalSnapshotQuery(member,false);expect((await pg.query<{snapshot:{pendingDepositCount:number;pendingDepositCents:number}}>(q.text,q.values)).rows[0].snapshot).toMatchObject({pendingDepositCount:1,pendingDepositCents:1000000});
 await pg.query(`SELECT wallet_review_manual_deposit($1,$2,true,$3,'SIMULATED verified received funds')`,[pid,owner,tx]);expect(await expire()).toBe(0);expect(await status(pid)).toBe('CONFIRMED');
 expect(await scalar('SELECT "balanceCents" AS v FROM "User" WHERE id=$1',[member])).toBe(1000000);
});
it('allows a late report on an expired record and only credits after owner review, once',async()=>{
 const pid=await create(),tx=hash();await age(pid,61);await expire();
 expect(await scalar('SELECT wallet_report_manual_deposit($1,$2,$3) AS v',[pid,owner,tx])).toBe('missing');
 expect(await scalar('SELECT wallet_report_manual_deposit($1,$2,$3) AS v',[pid,member,tx])).toBe('submitted');
 expect(await expire()).toBe(0);expect(await status(pid)).toBe('CONFIRMING');
 for(let i=0;i<2;i++)await pg.query(`SELECT wallet_review_manual_deposit($1,$2,true,$3,'SIMULATED late transfer receipt')`,[pid,owner,tx]);
 expect(await scalar('SELECT count(*)::int AS v FROM "WalletJournal" WHERE "paymentId"=$1',[pid])).toBe(1);
});
it('clears stale requests before the three-open-request limit without affecting another member',async()=>{
 const stale=[];for(let i=0;i<3;i++){const pid=await create();stale.push(pid);}
 const other=id();await pg.query(`INSERT INTO "User"(id,email,"passwordHash","ageConfirmedAt","emailVerifiedAt","updatedAt") VALUES($1,$2,'test',now(),now(),now())`,[other,other+'@example.com']);
 const otherRequest=id();await pg.query(`SELECT wallet_create_manual_deposit($1,$2,50000,'USDC','ERC20','0x1111111111111111111111111111111111111111')`,[other,otherRequest]);await age(otherRequest,61);
 for(const pid of stale)await age(pid,61);await create();for(const pid of stale)expect(await status(pid)).toBe('EXPIRED');expect(await status(otherRequest)).toBe('PENDING');
 expect(await expire(null)).toBe(1);expect(await status(otherRequest)).toBe('EXPIRED');
});
