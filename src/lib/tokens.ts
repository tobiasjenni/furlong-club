import crypto from 'node:crypto';
import type { TokenType } from '@prisma/client';
import { db } from './db';
const lifetimes: Record<TokenType, number> = { VERIFY_EMAIL: 86400000, RESET_PASSWORD: 3600000 };
const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
export async function issueToken(userId: string, type: TokenType, ttlMs = lifetimes[type], expectedEmail?: string) {
  const users = await db.$queryRaw<{sessionVersion:number; email:string}[]>`SELECT "sessionVersion",email FROM "User" WHERE id=${userId}`;
  const token = crypto.randomBytes(32).toString('base64url');
  const issued = await db.$queryRaw<{issued:boolean}[]>`SELECT auth_issue_token(${userId},${type}::"TokenType",${crypto.randomUUID()},${hash(token)},${ttlMs}::bigint,${users[0]?.sessionVersion ?? -1}::integer,${expectedEmail ?? users[0]?.email ?? ""}) AS issued`;
  if (!issued[0]?.issued) throw new Error('Account changed while issuing recovery link');
  return token;
}
export async function consumeToken(token: string, type: TokenType, passwordHash: string | null = null) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const rows = await db.$queryRaw<{userId:string|null}[]>`SELECT auth_consume_token(${hash(token)},${type}::"TokenType",${passwordHash}) AS "userId"`;
  return rows[0]?.userId ?? null;
}

export async function validPasswordReset(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const rows = await db.$queryRaw<{ valid: boolean }[]>`SELECT EXISTS (
    SELECT 1 FROM "AuthToken" t JOIN "User" u ON u.id=t."userId"
    WHERE t."tokenHash"=${hash(token)} AND t.type='RESET_PASSWORD' AND t."usedAt" IS NULL
      AND t."expiresAt">(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AND u.status='ACTIVE'
      AND t."sessionVersion"=u."sessionVersion"
  ) AS valid`;
  return Boolean(rows[0]?.valid);
}
