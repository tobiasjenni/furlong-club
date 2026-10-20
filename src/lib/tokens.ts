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
  await db.authToken.deleteMany({ where: { userId, type, usedAt: null } });
  const token = crypto.randomBytes(32).toString("base64url");
  await db.authToken.create({ data: { userId, type, tokenHash: hash(token), expiresAt: new Date(Date.now() + ttlMs) } });
  return token;
}

// Single use: returns the userId and marks the token used, or null if it is unknown, used or expired.
export async function consumeToken(token: string, type: TokenType) {
  const record = await db.authToken.findUnique({ where: { tokenHash: hash(token) } });
  if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) return null;
  const claimed = await db.authToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
  return claimed.count === 1 ? record.userId : null;
}
