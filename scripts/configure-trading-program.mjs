import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaNeonHTTP } from '@prisma/adapter-neon';

if (!['true','false'].includes(process.env.TRADING_REQUESTS_ENABLED)) throw new Error('Choose an explicit trading enrollment state');
const db = new PrismaClient({ adapter: new PrismaNeonHTTP(process.env.DATABASE_URL, {}) });
try {
  const owners = await db.user.findMany({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' }, select: { id: true } });
  if (owners.length !== 1) throw new Error('Exactly one active owner is required');
  const enabled = process.env.TRADING_REQUESTS_ENABLED === 'true';
  const result = await db.$queryRaw`SELECT trading_set_enrollment(${owners[0].id},${enabled},${'Owner-requested manual allocation enrollment; deployment configuration'},${crypto.randomUUID()}) AS result`;
  if (!['saved','unchanged'].includes(result[0]?.result)) throw new Error('Could not configure enrollment');
  console.log('Manual trading enrollment: ' + (enabled ? 'open' : 'paused') + '; owner-only approvals remain required.');
} catch { throw new Error('Trading enrollment configuration failed; review the deployment and database state'); }
finally { await db.$disconnect(); }
