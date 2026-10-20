import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaNeonHTTP } from '@prisma/adapter-neon';
import assert from 'node:assert/strict';

// Manual staging check: invoke with WALLET_TEST_DATABASE_URL only, never the production database.
const url = process.env.WALLET_TEST_DATABASE_URL;
if (!url) throw new Error('A dedicated WALLET_TEST_DATABASE_URL is required');
const clients = Array.from({ length: 3 }, () => new PrismaClient({ adapter: new PrismaNeonHTTP(url, {}) }));
const [db, second, third] = clients;
const planId = crypto.randomUUID();
try {
  const uid = crypto.randomUUID(), pid = crypto.randomUUID();
  await db.user.create({ data: { id: uid, email: `concurrency.${uid}@example.com`, name: 'Staging concurrency probe', passwordHash: 'unusable-test-hash', ageConfirmedAt: new Date(), emailVerifiedAt: new Date() } });
  await db.plan.create({ data: { id: planId, slug: `probe-${planId}`, name: 'Concurrency probe', tagline: 'Staging check', priceCents: 2900, tier: 1, features: [], active: false } });
  // Temporarily purchasable only for this brief automated race check.
  await db.plan.update({ where: { id: planId }, data: { active: true } });
  await db.payment.create({ data: { id: pid, userId: uid, amountCents: 5000, currency: 'USDC', network: 'POLYGON', provider: 'mock', purpose: 'WALLET_TOPUP', settlementStatus: 'PENDING' } });
  const event = JSON.stringify({ status: 'CONFIRMED', providerStatus: 'finished', receivedAmount: '50', outcomeAmount: '50', outcomeCurrency: 'usdcmatic', payoutHash: 'simulation', validationError: null });
  await Promise.all(Array.from({ length: 10 }, (_, i) => clients[i % 3].$queryRaw`SELECT wallet_apply_payment(${pid}, 'same-event', 'staging-concurrency', ${event}::jsonb)`));
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: uid } })).balanceCents, 5000);
  assert.equal(await db.walletJournal.count({ where: { paymentId: pid } }), 1);
  const results = await Promise.all([second, third].map(client => client.$queryRaw`SELECT wallet_buy_plan(${uid}, ${planId}, 2900::integer, ${crypto.randomUUID()}) AS result`));
  assert.deepEqual(results.map(r => r[0].result).sort(), ['insufficient', 'purchased']);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: uid } })).balanceCents, 2100);
  assert.equal(await db.subscription.count({ where: { userId: uid } }), 1);
  const drift = await db.$queryRaw`SELECT u.id FROM "User" u LEFT JOIN "WalletJournal" j ON j."userId"=u.id GROUP BY u.id HAVING u."balanceCents"<>COALESCE(SUM(j."userDeltaCents"),0)`;
  assert.equal(drift.length, 0);
  await db.plan.update({ where: { id: planId }, data: { active: false } });
  console.log('Real Neon HTTP concurrency check passed: one credit, one purchase, $21 remaining, zero reconciliation drift.');
} finally {
  await db.$executeRaw`UPDATE "Plan" SET active=false WHERE id=${planId}`;
  await Promise.all(clients.map(client => client.$disconnect()));
}
