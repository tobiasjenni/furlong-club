import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaNeonHTTP } from '@prisma/adapter-neon';

const value = process.env.EMAIL_VERIFICATION_REQUIRED;
if (!['true', 'false'].includes(value)) throw new Error('Choose an explicit member email verification policy');
const required = value === 'true';
const db = new PrismaClient({ adapter: new PrismaNeonHTTP(process.env.DATABASE_URL, {}) });
try {
  // One statement updates eligibility and records the policy change together.
  const rows = await db.$queryRaw`WITH changed AS (
    UPDATE "AuthPolicy" SET "emailVerificationRequired"=${required},"updatedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
    WHERE id='members' AND "emailVerificationRequired" IS DISTINCT FROM ${required} RETURNING id
  ), recorded AS (
    INSERT INTO "AuditLog" (id,action,target,meta)
    SELECT ${crypto.randomUUID()},'deployment.member_email_policy','members',
      jsonb_build_object('emailVerificationRequired',${required},'source','owner-requested deployment configuration') FROM changed RETURNING id
  ) SELECT "emailVerificationRequired" AS required FROM "AuthPolicy" WHERE id='members'`;
  // A data-modifying CTE's final SELECT reads the statement's initial snapshot.
  // Verify the committed value with a fresh read before publishing the Worker.
  if (!rows.length) throw new Error('Member email policy is missing');
  const saved = await db.$queryRaw`SELECT "emailVerificationRequired" AS required FROM "AuthPolicy" WHERE id='members'`;
  if (saved[0]?.required !== required) throw new Error('Member email policy was not saved');
  console.log('Member email verification: ' + (required ? 'required' : 'temporarily paused') + '. Admin ownership checks remain required.');
} catch { throw new Error('Member email policy configuration failed; publishing is stopped'); }
finally { await db.$disconnect(); }
