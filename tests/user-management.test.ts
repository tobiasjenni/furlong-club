import fs from "node:fs";
import crypto from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let pg: PGlite;
let owner: string, admin: string, member: string;
const scalar = async (sql: string, args: unknown[] = []) => (await pg.query<{ result: unknown }>(sql,args)).rows[0]?.result;
async function create(role: string) {
  const id = crypto.randomUUID();
  await pg.query(`INSERT INTO "User" (id,email,"passwordHash",role,"ageConfirmedAt","emailVerifiedAt","lastLoginAt","updatedAt") VALUES ($1,$2,'test-hash',$3::"Role",now(),now(),now(),now())`,[id,`${id}@example.com`,role]);
  return id;
}
const manage = (actor: string, uid: string, op: string, data: object = {}) => scalar(`SELECT admin_manage_user($1,$2,$3,$4::jsonb,$5) AS result`,[actor,uid,op,JSON.stringify(data),crypto.randomUUID()]);
const roleData = (role = "ADMIN") => ({role,reason:"Verified staff appointment",passwordHash:"test-hash"});
const deleteData = (uid: string) => ({confirmation:`${uid}@example.com`,reason:'Remove disposable test account',passwordHash:'test-hash'});
const profileData = async (uid: string, fields: object = {}) => ({ name:'Updated member',country:'Switzerland',tags:['reviewed'],status:'ACTIVE',reason:'Corrected member profile details',expectedUpdatedAt:await scalar(`SELECT to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS result FROM "User" WHERE id=$1`,[uid]),...fields });
const token = async (uid: string, digest: string, version = 0) => scalar(`SELECT auth_issue_token($1,'RESET_PASSWORD',$2,$3,3600000,$4) AS result`,[uid,crypto.randomUUID(),digest,version]);

beforeAll(async () => {
  pg = new PGlite();
  for (const dir of fs.readdirSync("prisma/migrations").filter(n=>/^\d/.test(n)).sort()) await pg.exec(fs.readFileSync(`prisma/migrations/${dir}/migration.sql`,"utf8"));
},30000);
afterAll(async()=>{await pg?.close();});
beforeEach(async()=>{ owner=await create("SUPER_ADMIN"); admin=await create("ADMIN"); member=await create("USER"); });

describe("owner authority and audit integrity",()=>{
  it("confirms current admin credentials atomically and rejects revoked or stale confirmations", async () => {
    const confirm = (uid: string, hash = "test-hash", version = 0) => scalar(`SELECT auth_confirm_admin($1,$2,$3,$4) AS result`, [uid, hash, version, crypto.randomUUID()]);
    expect(await confirm(member)).toBe(false);
    expect(await confirm(admin, "wrong")).toBe(false);
    expect(await confirm(admin, "test-hash", 1)).toBe(false);
    expect(await confirm(admin)).toBe(true);
    expect(await confirm(owner)).toBe(true);
    await manage(owner, admin, "role", roleData("USER"));
    expect(await confirm(admin)).toBe(false);
    expect(await scalar(`SELECT count(*)::int AS result FROM "AuditLog" WHERE action='admin.access_confirmed' AND "actorId" IN ($1,$2)`, [admin, owner])).toBe(2);
  });
  it("lets only the owner promote and demote signed-in, verified members",async()=>{
    expect(await manage(member,member,"role",roleData())).toBe("forbidden");
    expect(await manage(admin,member,"role",roleData())).toBe("forbidden");
    expect(await manage(owner,member,"role",roleData())).toBe("saved");
    expect(await scalar(`SELECT role AS result FROM "User" WHERE id=$1`,[member])).toBe("ADMIN");
    expect(await manage(owner,member,"role",roleData("USER"))).toBe("saved");
    expect(await scalar(`SELECT "sessionVersion" AS result FROM "User" WHERE id=$1`,[member])).toBe(2);
  });
  it.each(["emailVerifiedAt","lastLoginAt"])("rejects promotion without %s",async field=>{
    await pg.query(`UPDATE "User" SET "${field}"=NULL WHERE id=$1`,[member]);
    expect(await manage(owner,member,"role",roleData())).toBe("not_ready");
  });
  it("rejects inactive targets, stale password confirmations and invented roles",async()=>{
    expect(await manage(owner,member,"role",{...roleData(),passwordHash:"wrong"})).toBe("forbidden");
    expect(await manage(owner,member,"role",roleData("SUPER_ADMIN"))).toBe("invalid");
    await manage(owner,member,"account",{status:"SUSPENDED",tags:[]});
    expect(await manage(owner,member,"role",roleData())).toBe("not_ready");
  });
  it("does not allow ordinary admins to modify admins, the owner or themselves",async()=>{
    for(const uid of [member,admin,owner,await create("ADMIN")]) for(const op of ["account","signout","email","reset","grant","cancel","note"]) expect(await manage(admin,uid,op,{status:"SUSPENDED",tags:[]})).toBe("forbidden");
    expect(await manage(owner,owner,"role",roleData("USER"))).toBe("forbidden");
  });
  it("ignores forged role fields in account updates and rechecks revoked authority",async()=>{
    expect(await manage(owner,member,"account",{status:"ACTIVE",tags:["reviewed"],role:"SUPER_ADMIN"})).toBe("saved");
    expect(await scalar(`SELECT role AS result FROM "User" WHERE id=$1`,[member])).toBe("USER");
    await manage(owner,admin,"role",roleData("USER"));
    expect(await manage(admin,member,"signout")).toBe("forbidden");
  });
  it("protects owner status, role and deletion even outside the management action",async()=>{
    await expect(pg.query(`UPDATE "User" SET role='USER' WHERE id=$1`,[owner])).rejects.toThrow("protected");
    await expect(pg.query(`UPDATE "User" SET status='SUSPENDED' WHERE id=$1`,[owner])).rejects.toThrow("protected");
    await expect(pg.query(`DELETE FROM "User" WHERE id=$1`,[owner])).rejects.toThrow("protected");
    expect(await scalar(`SELECT wallet_close_account($1) AS result`,[owner])).toBe("protected_role");
  });
  it("retains a before/after audit trail without passwords or usable recovery tokens",async()=>{
    await manage(owner,member,"role",roleData());
    const audit=(await pg.query<{id:string;meta:object}>(`SELECT id,meta FROM "AuditLog" WHERE target=$1`,[member])).rows[0];
    expect(JSON.stringify(audit.meta)).toContain('"sessionVersion":1');
    expect(JSON.stringify(audit.meta)).not.toContain("test-hash");
    await expect(pg.query(`UPDATE "AuditLog" SET action='hidden' WHERE id=$1`,[audit.id])).rejects.toThrow("append-only");
    await expect(pg.query(`DELETE FROM "AuditLog" WHERE id=$1`,[audit.id])).rejects.toThrow("append-only");
  });
});

describe("recovery, suspension and stored obligations",()=>{
  it("revokes outstanding tokens on promotion, status changes and forced signout",async()=>{
    for(const operation of ["role","account","signout"]){
      const uid=await create("USER");await token(uid,uid);
      expect(await manage(owner,uid,operation,operation==="role"?roleData():{status:"SUSPENDED",tags:[]})).toBe("saved");
      expect(await scalar(`SELECT auth_consume_token($1,'RESET_PASSWORD','new-hash') AS result`,[uid])).toBeNull();
    }
  });
  it("blocks stale token issuance after a simultaneous promotion",async()=>{
    await manage(owner,member,"role",roleData());
    expect(await token(member,"stale",0)).toBe(false);
    expect(await token(member,"fresh",1)).toBe(true);
  });
  it("uses reset links once, changes password and signs out atomically",async()=>{
    await token(member,"single-use");
    expect(await scalar(`SELECT auth_consume_token('single-use','RESET_PASSWORD','new-hash') AS result`)).toBe(member);
    expect(await scalar(`SELECT auth_consume_token('single-use','RESET_PASSWORD','other-hash') AS result`)).toBeNull();
    expect(await scalar(`SELECT "sessionVersion" AS result FROM "User" WHERE id=$1`,[member])).toBe(1);
  });
  it("restricts recovery and manual verification to the owner",async()=>{
    expect(await manage(admin,member,"reset",{tokenHash:"x"})).toBe("forbidden");
    expect(await manage(admin,member,"email",{reason:"Verified ownership"})).toBe("forbidden");
    expect(await manage(owner,member,"reset",{tokenHash:"x",passwordHash:"test-hash"})).toBe("saved");
    expect(await manage(owner,owner,"reset",{tokenHash:"y",passwordHash:"test-hash"})).toBe("forbidden");
  });
  it("binds recovery issuance to the requested email and revokes links on email change",async()=>{
    const before=(await pg.query<{email:string}>(`SELECT email FROM "User" WHERE id=$1`,[member])).rows[0].email;
    await token(member,'before-email-change');
    expect(await scalar(`SELECT auth_change_email($1,'test-hash',0,'changed@example.com',$2) AS result`,[member,crypto.randomUUID()])).toBe(true);
    expect(await scalar(`SELECT auth_consume_token('before-email-change','RESET_PASSWORD','bad') AS result`)).toBeNull();
    expect(await scalar(`SELECT auth_issue_token($1,'RESET_PASSWORD',$2,'old-address',3600000,1,$3) AS result`,[member,crypto.randomUUID(),before])).toBe(false);
    expect(await scalar(`SELECT auth_issue_token($1,'RESET_PASSWORD',$2,'new-address',3600000,1,'changed@example.com') AS result`,[member,crypto.randomUUID()])).toBe(true);
    expect(await scalar(`SELECT auth_change_email($1,'test-hash',0,'takeover@example.com',$2) AS result`,[member,crypto.randomUUID()])).toBe(false);
    expect(await scalar(`SELECT auth_change_email($1,'test-hash',0,'owner-change@example.com',$2) AS result`,[owner,crypto.randomUUID()])).toBe(false);
  });
  it("invalidates recovery links when the password changes",async()=>{
    await token(member,"obsolete");
    expect(await scalar(`SELECT auth_change_password($1,'wrong','new') AS result`,[member])).toBe(false);
    expect(await scalar(`SELECT auth_change_password($1,'test-hash','new') AS result`,[member])).toBe(true);
    expect(await scalar(`SELECT auth_consume_token('obsolete','RESET_PASSWORD','stolen') AS result`)).toBeNull();
  });
  it("preserves balances and financial records when closure is requested",async()=>{
    const id=crypto.randomUUID();
    await pg.query(`INSERT INTO "WalletJournal" (id,"operationKey","userId",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents") VALUES($1,$1,$2,'OPENING','Test funding',50000,-50000,0)`,[id,member]);
    expect(await manage(owner,member,"delete",deleteData(member))).toBe("wallet_unresolved");
    expect(await scalar(`SELECT "balanceCents" AS result FROM "User" WHERE id=$1`,[member])).toBe(50000);
    expect(await manage(owner,member,"account",{status:"SUSPENDED",tags:[]})).toBe("saved");
    expect(await scalar(`SELECT "balanceCents" AS result FROM "User" WHERE id=$1`,[member])).toBe(50000);
  });
  it("keeps Super Admin deposit and trading review permissions",async()=>{
    expect(await scalar(`SELECT wallet_review_manual_deposit('missing',$1,true,'x','Verified receipt') AS result`,[owner])).not.toBe("forbidden");
    expect(await scalar(`SELECT trading_review('missing',$1,true,'Verified request') AS result`,[owner])).not.toBe("forbidden");
  });
});

describe('CRM profile edits and account deletion',()=>{
  it('edits profile fields with a complete before/after audit and ignores forged protected fields',async()=>{
    expect(await manage(owner,member,'profile',await profileData(member,{role:'SUPER_ADMIN',balanceCents:99999,email:'forged@example.com',marketingOptIn:true}))).toBe('saved');
    const row=(await pg.query<{name:string;country:string;tags:string[];role:string;balanceCents:number;email:string;marketingOptIn:boolean}>(`SELECT name,country,tags,role,"balanceCents",email,"marketingOptIn" FROM "User" WHERE id=$1`,[member])).rows[0];
    expect(row).toEqual({name:'Updated member',country:'Switzerland',tags:['reviewed'],role:'USER',balanceCents:0,email:`${member}@example.com`,marketingOptIn:false});
    const meta=await scalar(`SELECT meta AS result FROM "AuditLog" WHERE target=$1 AND action='admin.user_profile'`,[member]);
    expect(meta).toMatchObject({before:{name:null,tags:[]},after:{name:'Updated member',country:'Switzerland',tags:['reviewed']},details:{reason:'Corrected member profile details'}});
  });
  it('rejects stale edits without changing records',async()=>{
    const data=await profileData(member);
    await pg.query(`UPDATE "User" SET "updatedAt"="updatedAt"+interval '1 second' WHERE id=$1`,[member]);
    expect(await manage(owner,member,'profile',data)).toBe('stale');
    expect(await scalar('SELECT name AS result FROM "User" WHERE id=$1',[member])).toBeNull();
  });
  it.each([{name:'x'.repeat(121)},{country:'x'.repeat(81)},{tags:['x'.repeat(61)]},{tags:Array(21).fill('tag')},{tags:[1]},{tags:{}},{reason:'short'},{status:'CLOSED'}])('rejects malformed or closing profile edits: %j',async fields=>{
    expect(await manage(owner,member,'profile',await profileData(member,fields))).toBe('invalid');
  });
  it('keeps both new operations owner-only and protects the owner and self',async()=>{
    for(const actor of [admin,member]) for(const op of ['profile','delete']) expect(await manage(actor,member,op,op==='profile'?await profileData(member):deleteData(member))).toBe('forbidden');
    for(const op of ['profile','delete']) expect(await manage(owner,owner,op,op==='profile'?await profileData(owner):deleteData(owner))).toBe('forbidden');
    await pg.query(`UPDATE "User" SET status='SUSPENDED' WHERE id=$1`,[member]);
    expect(await manage(member,admin,'delete',deleteData(admin))).toBe('forbidden');
  });
  it('requires fresh owner credentials, matching email and a reason; blocks the old closure path',async()=>{
    expect(await manage(owner,member,'delete',{...deleteData(member),passwordHash:'old-hash'})).toBe('forbidden');
    expect(await manage(owner,member,'delete',{...deleteData(member),confirmation:'wrong@example.com'})).toBe('invalid');
    expect(await manage(owner,member,'delete',{...deleteData(member),reason:'short'})).toBe('invalid');
    expect(await manage(owner,member,'account',{status:'CLOSED',tags:[]})).toBe('invalid');
  });
  it('suspends, deletes and restores with session/token revocation, retained history and no renewed consent',async()=>{
    await token(member,'before-suspension');
    expect(await manage(owner,member,'profile',await profileData(member,{status:'SUSPENDED'}))).toBe('saved');
    expect(await scalar(`SELECT "sessionVersion" AS result FROM "User" WHERE id=$1`,[member])).toBe(1);
    expect(await scalar(`SELECT count(*)::int AS result FROM "AuthToken" WHERE "userId"=$1`,[member])).toBe(0);
    expect(await manage(owner,member,'delete',deleteData(member))).toBe('saved');
    expect(await manage(owner,member,'delete',deleteData(member))).toBe('already_closed');
    const closed=(await pg.query<{status:string;closedAt:Date;sessionVersion:number}>(`SELECT status,"closedAt","sessionVersion" FROM "User" WHERE id=$1`,[member])).rows[0];
    expect(closed.status).toBe('CLOSED'); expect(closed.closedAt).not.toBeNull(); expect(closed.sessionVersion).toBe(2);
    expect(await token(member,'after-deletion',2)).toBe(false);
    expect(await manage(owner,member,'profile',await profileData(member,{status:'ACTIVE'}))).toBe('saved');
    expect((await pg.query(`SELECT status,"closedAt","marketingOptIn","sessionVersion" FROM "User" WHERE id=$1`,[member])).rows[0]).toEqual({status:'ACTIVE',closedAt:null,marketingOptIn:false,sessionVersion:3});
    const history=(await pg.query<{meta:object}>(`SELECT meta FROM "AuditLog" WHERE target=$1`,[member])).rows;
    expect(history).toHaveLength(3); expect(JSON.stringify(history)).not.toContain('test-hash');
  });
  it.each(['PENDING','CONFIRMING','PARTIAL'])('blocks deletion for a %s payment',async status=>{
    await pg.query(`INSERT INTO "Payment"(id,"userId",purpose,"amountCents",currency,network,provider,status,"updatedAt") VALUES($1,$2,'WALLET_TOPUP',1000,'USDT','ERC20','manual',$3::"PaymentStatus",now())`,[crypto.randomUUID(),member,status]);
    expect(await manage(owner,member,'delete',deleteData(member))).toBe('wallet_unresolved');
  });
  it.each(['PENDING','ACTIVE','PAYOUT_READY'])('blocks deletion for a %s trading allocation',async status=>{
    await pg.query(`INSERT INTO "TradingAllocation"(id,"userId","requestKey","principalCents",currency,network,"payoutAddress","termsVersion","termsSnapshot",status,"approvedAt","approvedById","unlocksAt","profitCents","payoutCents","resultAt","resultById","resultNote") VALUES($1,$2,$1,50000,'USDT','ERC20','0x1111111111111111111111111111111111111111','test','{}',$3,
      CASE WHEN $3<>'PENDING' THEN now()-interval '34 days' END,CASE WHEN $3<>'PENDING' THEN $4 END,CASE WHEN $3<>'PENDING' THEN now()-interval '1 day' END,
      CASE WHEN $3='PAYOUT_READY' THEN 0 END,CASE WHEN $3='PAYOUT_READY' THEN 50000 END,CASE WHEN $3='PAYOUT_READY' THEN now() END,CASE WHEN $3='PAYOUT_READY' THEN $4 END,CASE WHEN $3='PAYOUT_READY' THEN 'Fixture result' END)`,[crypto.randomUUID(),member,status,owner]);
    expect(await manage(owner,member,'delete',deleteData(member))).toBe('wallet_unresolved');
  });
  it('blocks frozen wallets and active paid memberships until resolved',async()=>{
    await pg.query(`UPDATE "User" SET "walletFrozen"=true WHERE id=$1`,[member]);
    expect(await manage(owner,member,'delete',deleteData(member))).toBe('wallet_unresolved');
    await pg.query(`UPDATE "User" SET "walletFrozen"=false WHERE id=$1`,[member]);
    const plan=crypto.randomUUID(),sub=crypto.randomUUID();
    await pg.query(`INSERT INTO "Plan"(id,slug,name,tagline,"priceCents",tier,features) VALUES($1,$1,'QA','QA',2900,1,'{}')`,[plan]);
    await pg.query(`INSERT INTO "Subscription"(id,"userId","planId","endsAt") VALUES($1,$2,$3,now()+interval '33 days')`,[sub,member,plan]);
    expect(await manage(owner,member,'delete',deleteData(member))).toBe('membership_active');
    await manage(owner,member,'cancel',{subscriptionId:sub});
    expect(await manage(owner,member,'delete',deleteData(member))).toBe('saved');
    expect(await scalar(`SELECT count(*)::int AS result FROM "Subscription" WHERE id=$1`,[sub])).toBe(1);
  });
  it('blocks a pending legacy withdrawal and retains settled financial postings',async()=>{
    const legacy=crypto.randomUUID();
    await pg.query(`INSERT INTO "LedgerEntry"(id,"userId",type,"amountCents",currency) VALUES($1,$2,'WITHDRAWAL',100,'USD')`,[legacy,member]);
    expect(await manage(owner,member,'delete',deleteData(member))).toBe('wallet_unresolved');
    await pg.query(`UPDATE "LedgerEntry" SET status='COMPLETED' WHERE id=$1`,[legacy]);
    const journal=crypto.randomUUID();
    await pg.query(`INSERT INTO "WalletJournal"(id,"operationKey","userId",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents") VALUES($1,$1,$2,'OPENING','Settled fixture',0,-100,100)`,[journal,member]);
    expect(await manage(owner,member,'delete',deleteData(member))).toBe('saved');
    expect(await scalar(`SELECT count(*)::int AS result FROM "WalletJournal" WHERE id=$1`,[journal])).toBe(1);
    expect(await scalar(`SELECT count(*)::int AS result FROM "LedgerEntry" WHERE id=$1`,[legacy])).toBe(1);
  });
  it('rolls back deletion if its audit entry cannot be recorded',async()=>{
    const event=crypto.randomUUID();
    await pg.query(`INSERT INTO "AuditLog"(id,action,target) VALUES($1,'fixture',$2)`,['manage:'+event,member]);
    await expect(pg.query(`SELECT admin_manage_user($1,$2,'delete',$3::jsonb,$4)`,[owner,member,JSON.stringify(deleteData(member)),event])).rejects.toThrow();
    expect(await scalar(`SELECT status AS result FROM "User" WHERE id=$1`,[member])).toBe('ACTIVE');
  });
});
