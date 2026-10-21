import fs from "node:fs";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

let pg: PGlite;
let current: Record<string, unknown>;
let sessionVersion: number | undefined;
let messages: {to:string;token?:string}[];
let beforeSignIn: (() => Promise<void>) | undefined;
const sql=(parts: TemplateStringsArray)=>parts.reduce((s,p,i)=>s+(i?`$${i}`:"")+p,"");
vi.mock("@/lib/db",()=>({db:{
  $queryRaw:async(parts:TemplateStringsArray,...args:unknown[])=>{
    const statement=sql(parts);
    if(statement.startsWith('UPDATE "User" SET "lastLoginAt"') && beforeSignIn) await beforeSignIn();
    return (await pg.query(statement,args)).rows;
  },
  user:{findUnique:async({where}:{where:{id?:string;email?:string}})=>(await pg.query(`SELECT * FROM "User" WHERE ${where.id?'id':'email'}=$1`,[where.id??where.email])).rows[0],
    findUniqueOrThrow:async({where}:{where:{id:string}})=>(await pg.query(`SELECT * FROM "User" WHERE id=$1`,[where.id])).rows[0],
    create:async({data}:{data:Record<string,unknown>})=>{
      try { return (await pg.query(`INSERT INTO "User"(id,email,name,country,"passwordHash","marketingOptIn","ageConfirmedAt","lastLoginAt","updatedAt",role)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,now(),$9::"Role") RETURNING *`,[crypto.randomUUID(),data.email,data.name,data.country,data.passwordHash,data.marketingOptIn,data.ageConfirmedAt,data.lastLoginAt,data.role??'USER'])).rows[0]; }
      catch(error){if(error && typeof error==='object' && 'code' in error && error.code==='23505')throw {code:'P2002'};throw error;}
    }},
  auditLog:{create:async({data}:{data:{actorId:string;action:string;target:string}})=>pg.query(`INSERT INTO "AuditLog"(id,"actorId",action,target) VALUES($1,$2,$3,$4)`,[crypto.randomUUID(),data.actorId,data.action,data.target])},
}}));
vi.mock("@/lib/auth",()=>({requireUser:async()=>current,startSession:async(u:{sessionVersion:number})=>{sessionVersion=u.sessionVersion;},endSession:async()=>{},revokeSessions:async()=>{throw new Error('Unexpected second session revocation');}}));
vi.mock("@/lib/email",()=>({emailDelivers:()=>true,sendEmail:async(m:{to:string;token?:string})=>{messages.push(m);},verifyEmailMessage:(to:string,token:string)=>({to,token}),passwordChangedMessage:(to:string)=>({to}),resetPasswordMessage:(to:string,token:string)=>({to,token})}));
vi.mock("next/headers",()=>({headers:async()=>new Headers()}));
vi.mock("next/navigation",()=>({redirect:(path:string)=>{throw new Error(`REDIRECT:${path}`);}}));
import { changeEmail, changePassword, resetPassword, signup, login } from "@/app/actions/auth";
import { consumeToken, issueToken, validPasswordReset } from "@/lib/tokens";

const form=(values:Record<string,string>)=>{const f=new FormData();for(const [k,v]of Object.entries(values))f.set(k,v);return f;};
beforeAll(async()=>{
  pg=new PGlite();for(const dir of fs.readdirSync('prisma/migrations').filter(n=>/^\d/.test(n)).sort())await pg.exec(fs.readFileSync(`prisma/migrations/${dir}/migration.sql`,'utf8'));
},30000);
afterAll(async()=>{await pg?.close();});
beforeEach(async()=>{
  await pg.exec('DELETE FROM "RateLimit"');beforeSignIn=undefined;
  const id=crypto.randomUUID();await pg.query(`INSERT INTO "User"(id,email,"passwordHash","ageConfirmedAt","updatedAt") VALUES($1,$2,$3,now(),now())`,[id,`${id}@example.com`,await bcrypt.hash('existing-password',4)]);
  current=(await pg.query<Record<string,unknown>>(`SELECT * FROM "User" WHERE id=$1`,[id])).rows[0];messages=[];sessionVersion=undefined;
});

const registration=(extra:Record<string,string>={})=>form({name:'Test Member',email:`signup-${crypto.randomUUID()}@example.com`,password:'registration-password',passwordConfirm:'registration-password',age:'on',terms:'on',...extra});
it.each([undefined,'different-password'])("rejects missing or mismatched signup confirmation before creating an account: %s",async confirmation=>{
  const data=registration();if(confirmation===undefined)data.delete('passwordConfirm');else data.set('passwordConfirm',confirmation);
  const email=String(data.get('email'));const result=await signup(null,data);
  expect(result?.error).toMatch(/confirm|do not match/);
  expect((await pg.query(`SELECT id FROM "User" WHERE email=$1`,[email])).rows).toHaveLength(0);
});
it("creates a member with a hashed password and resumes the chosen plan",async()=>{
  const data=registration({next:'/checkout/form',role:'SUPER_ADMIN'});const email=String(data.get('email'));
  await expect(signup(null,data)).rejects.toThrow('REDIRECT:/checkout/form');
  const user=(await pg.query<{passwordHash:string;role:string;emailVerifiedAt:Date|null}>(`SELECT "passwordHash",role,"emailVerifiedAt" FROM "User" WHERE email=$1`,[email])).rows[0];
  expect(user.role).toBe('USER');expect(user.emailVerifiedAt).toBeNull();expect(user.passwordHash).not.toBe('registration-password');expect(await bcrypt.compare('registration-password',user.passwordHash)).toBe(true);expect(sessionVersion).toBe(0);
});
it("handles simultaneous duplicate signups without creating two accounts or exposing a server error",async()=>{
  const email=`duplicate-${crypto.randomUUID()}@example.com`;
  const results=await Promise.allSettled([signup(null,registration({email})),signup(null,registration({email}))]);
  expect(results.filter(r=>r.status==='rejected' && String(r.reason).includes('REDIRECT:'))).toHaveLength(1);
  expect(results.filter(r=>r.status==='fulfilled' && r.value?.error?.includes('already exists'))).toHaveLength(1);
  expect((await pg.query(`SELECT id FROM "User" WHERE email=$1`,[email])).rows).toHaveLength(1);
});
it.each(['age','terms'])("requires the member's own %s confirmation",async field=>{
  const data=registration();data.delete(field);expect((await signup(null,data))?.error).toBeTruthy();
});
it("rejects mismatched reset passwords without consuming the recovery link",async()=>{
  const token=await issueToken(String(current.id),'RESET_PASSWORD');expect(await validPasswordReset(token)).toBe(true);
  expect((await resetPassword(null,form({token,password:'replacement-password',passwordConfirm:'different-password'})))?.error).toContain('do not match');
  expect(await validPasswordReset(token)).toBe(true);
});
it("rejects malformed or already-used reset links before rendering a reset form",async()=>{
  expect(await validPasswordReset('invalid')).toBe(false);const token=await issueToken(String(current.id),'RESET_PASSWORD');
  await consumeToken(token,'RESET_PASSWORD',await bcrypt.hash('new-password',4));expect(await validPasswordReset(token)).toBe(false);
});
it("signs in with a normalized email and resumes a safe internal page",async()=>{
  await expect(login(null,form({email:' '+String(current.email).toUpperCase()+' ',password:'existing-password',next:'/checkout/form?from=plans'}))).rejects.toThrow('REDIRECT:/checkout/form?from=plans');
  expect(sessionVersion).toBe(0);
});
it("uses the same failure message for an unknown account and an incorrect password",async()=>{
  const unknown=await login(null,form({email:'unknown@example.com',password:'wrong-password'}));
  const wrong=await login(null,form({email:String(current.email),password:'wrong-password'}));expect(unknown).toEqual(wrong);expect(sessionVersion).toBeUndefined();
});
it("blocks oversized passwords instead of accepting a bcrypt-truncated suffix",async()=>{
  await pg.query(`UPDATE "User" SET "passwordHash"=$1 WHERE id=$2`,[await bcrypt.hash('x'.repeat(72),4),current.id]);
  expect((await login(null,form({email:String(current.email),password:'x'.repeat(72)+'extra'})))?.error).toContain('incorrect');expect(sessionVersion).toBeUndefined();
});
it("does not issue a session when access changes during password verification",async()=>{
  beforeSignIn=async()=>{await pg.query(`UPDATE "User" SET "sessionVersion"="sessionVersion"+1 WHERE id=$1`,[current.id]);};
  expect((await login(null,form({email:String(current.email),password:'existing-password'})))?.error).toContain('account changed');expect(sessionVersion).toBeUndefined();
});
it("rate limits repeated sign-in attempts",async()=>{
  for(let i=0;i<8;i++)expect((await login(null,form({email:String(current.email),password:'wrong-password'})))?.error).toContain('incorrect');
  expect((await login(null,form({email:String(current.email),password:'existing-password'})))?.error).toContain('Too many attempts');expect(sessionVersion).toBeUndefined();
});

it("keeps the verification link valid after a successful email change",async()=>{
  const result=await changeEmail(null,form({email:'changed-'+crypto.randomUUID()+'@example.com',password:'existing-password'}));
  expect(result?.ok).toContain('Email changed');expect(sessionVersion).toBe(1);
  expect(messages).toHaveLength(1);expect(await consumeToken(messages[0].token!,"VERIFY_EMAIL")).toBe(current.id);
  const user=(await pg.query<{emailVerifiedAt:Date;sessionVersion:number}>(`SELECT "emailVerifiedAt","sessionVersion" FROM "User" WHERE id=$1`,[current.id])).rows[0];
  expect(user.emailVerifiedAt).not.toBeNull();expect(user.sessionVersion).toBe(sessionVersion);
});
it("changes a password once and keeps only the newly issued session valid",async()=>{
  const oldLink=await issueToken(String(current.id),'RESET_PASSWORD');
  expect((await changePassword(null,form({current:'existing-password',next:'replacement-password',nextConfirm:'replacement-password'})))?.ok).toContain('Password updated');
  expect(sessionVersion).toBe(1);expect(await consumeToken(oldLink,'RESET_PASSWORD','bad-hash')).toBeNull();
  const user=(await pg.query<{passwordHash:string}>(`SELECT "passwordHash" FROM "User" WHERE id=$1`,[current.id])).rows[0];expect(await bcrypt.compare('replacement-password',user.passwordHash)).toBe(true);
});
it("resets through the real action atomically and rejects reuse",async()=>{
  const token=await issueToken(String(current.id),'RESET_PASSWORD');
  await expect(resetPassword(null,form({token,password:'replacement-password',passwordConfirm:'replacement-password'}))).rejects.toThrow('REDIRECT:/login?reset=1');
  expect((await resetPassword(null,form({token,password:'second-password',passwordConfirm:'second-password'})))?.error).toContain('invalid or has expired');
  const user=(await pg.query<{passwordHash:string;sessionVersion:number}>(`SELECT "passwordHash","sessionVersion" FROM "User" WHERE id=$1`,[current.id])).rows[0];
  expect(await bcrypt.compare('replacement-password',user.passwordHash)).toBe(true);expect(user.sessionVersion).toBe(1);
});
