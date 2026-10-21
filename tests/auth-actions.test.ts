import fs from "node:fs";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

let pg: PGlite;
let current: Record<string, unknown>;
let sessionVersion: number | undefined;
let messages: {to:string;token?:string}[];
const sql=(parts: TemplateStringsArray)=>parts.reduce((s,p,i)=>s+(i?`$${i}`:"")+p,"");
vi.mock("@/lib/db",()=>({db:{
  $queryRaw:async(parts:TemplateStringsArray,...args:unknown[])=>(await pg.query(sql(parts),args)).rows,
  user:{findUnique:async({where}:{where:{id?:string;email?:string}})=>(await pg.query(`SELECT * FROM "User" WHERE ${where.id?'id':'email'}=$1`,[where.id??where.email])).rows[0],
    findUniqueOrThrow:async({where}:{where:{id:string}})=>(await pg.query(`SELECT * FROM "User" WHERE id=$1`,[where.id])).rows[0]},
  auditLog:{create:async({data}:{data:{actorId:string;action:string;target:string}})=>pg.query(`INSERT INTO "AuditLog"(id,"actorId",action,target) VALUES($1,$2,$3,$4)`,[crypto.randomUUID(),data.actorId,data.action,data.target])},
}}));
vi.mock("@/lib/auth",()=>({requireUser:async()=>current,startSession:async(u:{sessionVersion:number})=>{sessionVersion=u.sessionVersion;},endSession:async()=>{},revokeSessions:async()=>{throw new Error('Unexpected second session revocation');}}));
vi.mock("@/lib/email",()=>({emailDelivers:()=>true,sendEmail:async(m:{to:string;token?:string})=>{messages.push(m);},verifyEmailMessage:(to:string,token:string)=>({to,token}),passwordChangedMessage:(to:string)=>({to}),resetPasswordMessage:(to:string,token:string)=>({to,token})}));
vi.mock("next/headers",()=>({headers:async()=>new Headers()}));
vi.mock("next/navigation",()=>({redirect:(path:string)=>{throw new Error(`REDIRECT:${path}`);}}));
import { changeEmail, changePassword, resetPassword } from "@/app/actions/auth";
import { consumeToken, issueToken } from "@/lib/tokens";

const form=(values:Record<string,string>)=>{const f=new FormData();for(const [k,v]of Object.entries(values))f.set(k,v);return f;};
beforeAll(async()=>{
  pg=new PGlite();for(const dir of fs.readdirSync('prisma/migrations').filter(n=>/^\d/.test(n)).sort())await pg.exec(fs.readFileSync(`prisma/migrations/${dir}/migration.sql`,'utf8'));
},30000);
afterAll(async()=>{await pg?.close();});
beforeEach(async()=>{
  const id=crypto.randomUUID();await pg.query(`INSERT INTO "User"(id,email,"passwordHash","ageConfirmedAt","updatedAt") VALUES($1,$2,$3,now(),now())`,[id,`${id}@example.com`,await bcrypt.hash('existing-password',4)]);
  current=(await pg.query<Record<string,unknown>>(`SELECT * FROM "User" WHERE id=$1`,[id])).rows[0];messages=[];sessionVersion=undefined;
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
  expect((await changePassword(null,form({current:'existing-password',next:'replacement-password'})))?.ok).toContain('Password updated');
  expect(sessionVersion).toBe(1);expect(await consumeToken(oldLink,'RESET_PASSWORD','bad-hash')).toBeNull();
  const user=(await pg.query<{passwordHash:string}>(`SELECT "passwordHash" FROM "User" WHERE id=$1`,[current.id])).rows[0];expect(await bcrypt.compare('replacement-password',user.passwordHash)).toBe(true);
});
it("resets through the real action atomically and rejects reuse",async()=>{
  const token=await issueToken(String(current.id),'RESET_PASSWORD');
  await expect(resetPassword(null,form({token,password:'replacement-password'}))).rejects.toThrow('REDIRECT:/login?reset=1');
  expect((await resetPassword(null,form({token,password:'second-password'})))?.error).toContain('invalid or has expired');
  const user=(await pg.query<{passwordHash:string;sessionVersion:number}>(`SELECT "passwordHash","sessionVersion" FROM "User" WHERE id=$1`,[current.id])).rows[0];
  expect(await bcrypt.compare('replacement-password',user.passwordHash)).toBe(true);expect(user.sessionVersion).toBe(1);
});
