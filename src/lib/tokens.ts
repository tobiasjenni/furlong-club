import crypto from "node:crypto";
import type { TokenType } from "@prisma/client";
import { db } from "./db";

const lifetimes: Record<TokenType, number> = {
  VERIFY_EMAIL: 24 * 60 * 60 * 1000,
  RESET_PASSWORD: 60 * 60 * 1000,
};

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

// Only the hash is stored, so a database leak doesn't expose usable links.
export async function issueToken(userId: string, type: TokenType, ttlMs = lifetimes[type]) {
  const token = crypto.randomBytes(32).toString("base64url");
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ttlMs);
  await db.$executeRaw`WITH removed AS (
    DELETE FROM "AuthToken" WHERE "userId"=${userId} AND type=${type}::"TokenType" AND "usedAt" IS NULL
  ) INSERT INTO "AuthToken" (id,"userId",type,"tokenHash","expiresAt")
    VALUES (${id},${userId},${type}::"TokenType",${hash(token)},${expiresAt})`;
  return token;
}

// Single use: returns the userId and marks the token used, or null if it is unknown, used or expired.
export async function consumeToken(token: string, type: TokenType) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const claimed = await db.$queryRaw<{ userId: string }[]>`UPDATE "AuthToken"
    SET "usedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
    WHERE "tokenHash"=${hash(token)} AND type=${type}::"TokenType" AND "usedAt" IS NULL
      AND "expiresAt">(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') RETURNING "userId"`;
  return claimed[0]?.userId ?? null;
}
