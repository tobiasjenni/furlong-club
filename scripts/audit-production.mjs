// Read-only deployment inventory. Never prints credentials, addresses or customer records.
import { PrismaClient } from '@prisma/client';
import { PrismaNeonHTTP } from '@prisma/adapter-neon';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Production database credential is missing');
const db = new PrismaClient({ adapter: new PrismaNeonHTTP(databaseUrl, {}) });
try {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/furlong-club/settings`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Worker configuration inventory failed (${response.status})`);
  const settings = await response.json();
  if (!settings.success) throw new Error('Worker configuration inventory was unsuccessful');
  const bindings = settings.result.bindings ?? [];
  const secretNames = bindings.filter(b => b.type === 'secret_text').map(b => b.name).sort();
  const flags = Object.fromEntries(bindings.filter(b => b.type === 'plain_text' && ['APP_ENV','PAYMENT_PROVIDER','WALLET_ENABLED','DATABASE_DRIVER','DEPOSIT_MODE','TRADING_REQUESTS_ENABLED','CLUB_GATE_ENABLED'].includes(b.name)).map(b => [b.name,b.text]));
  const counts = await db.$queryRaw`SELECT
    (SELECT count(*)::int FROM "User") AS users,
    (SELECT count(*)::int FROM "User" WHERE role IN ('ADMIN','SUPER_ADMIN') AND status='ACTIVE') AS admins,
    (SELECT count(*)::int FROM "User" WHERE role='SUPER_ADMIN' AND status='ACTIVE') AS "superAdmins",
    (SELECT count(*)::int FROM "User" WHERE "balanceCents"<0) AS "negativeBalances",
    (SELECT count(*)::int FROM "User" WHERE "balanceCents"<>0) AS "nonzeroBalances",
    (SELECT count(*)::int FROM "Plan" WHERE active) AS "activePlans",
    (SELECT count(*)::int FROM "Plan" WHERE active AND "priceCents">0 AND "intervalDays"=30) AS "outdatedPaidPlans",
    (SELECT count(*)::int FROM "Video" WHERE published) AS "publishedVideos",
    (SELECT count(*)::int FROM "Video" WHERE published AND ("bunnyVideoId" IS NOT NULL OR "embedUrl" IS NOT NULL)) AS "videosWithSources",
    (SELECT count(*)::int FROM "Payment") AS payments,
    (SELECT count(*)::int FROM "Payment" WHERE provider='mock') AS "mockPayments"`;
  const tables = await db.$queryRaw`SELECT to_regclass('public."WalletJournal"') IS NOT NULL AS "walletMigrationApplied",
    to_regclass('public."RateLimit"') IS NOT NULL AS "hardeningMigrationApplied",
    to_regclass('public."TradingAllocation"') IS NOT NULL AS "tradingMigrationApplied"`;
  let ledger;
  if (tables[0].walletMigrationApplied) {
    ledger = await db.$queryRaw`SELECT
      (SELECT count(*)::int FROM "User" u WHERE u."balanceCents"<>(SELECT COALESCE(sum(j."userDeltaCents"),0) FROM "WalletJournal" j WHERE j."userId"=u.id)) AS "balanceMismatches",
      (SELECT count(*)::int FROM "WalletJournal" WHERE "userDeltaCents"::bigint+"clearingDeltaCents"::bigint+"revenueDeltaCents"::bigint+"lockedDeltaCents"::bigint+"tradingResultDeltaCents"::bigint<>0) AS "unbalancedPostings",
      (SELECT count(*)::int FROM "User" u WHERE
        (SELECT COALESCE(sum("lockedDeltaCents"),0) FROM "WalletJournal" WHERE "userId"=u.id)<>
        (SELECT COALESCE(sum("principalCents"),0) FROM "TradingAllocation" WHERE "userId"=u.id AND status IN ('ACTIVE','PAYOUT_READY'))) AS "lockedPrincipalMismatches"`;
  }
  const trading = await db.tradingProgram.findUnique({ where: { id: 'harry' }, select: { enrollmentEnabled: true } });
  const security = await db.$queryRaw`SELECT
    (SELECT count(*)::int FROM "User" WHERE "passwordHash" !~ '^\\$2[aby]\\$12\\$') AS "passwordHashesOutsideCost12",
    (SELECT count(*)::int FROM "AuthToken" WHERE "tokenHash" !~ '^[0-9a-f]{64}$') AS "malformedTokenHashes",
    (SELECT count(*)::int FROM "User" u WHERE u.role IN ('ADMIN','SUPER_ADMIN') AND u.status='ACTIVE' AND EXISTS(SELECT 1 FROM "AdminPasskey" k WHERE k."userId"=u.id AND k."verifiedAt" IS NOT NULL)) AS "adminsWithVerifiedPasskeys",
    (SELECT count(*)::int FROM pg_tables WHERE schemaname='public' AND tableowner=current_user) AS "tablesOwnedByRuntimeRole",
    (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS "databaseSuperuser",
    has_schema_privilege(current_user,'public','CREATE') AS "canCreateInPublicSchema",
    to_regprocedure('public.auth_confirm_admin(text,text,integer,text)') IS NOT NULL AS "adminConfirmationApplied",
    EXISTS(SELECT 1 FROM "_prisma_migrations" WHERE migration_name='20261022090000_read_only_admin' AND finished_at IS NOT NULL AND rolled_back_at IS NULL) AS "readOnlyAdminApplied"`;
  const routes = [];
  for (const path of ['/','/trading','/plans','/login','/signup','/legal/terms','/icon.svg','/robots.txt']) {
    const result = await fetch(`https://furlong.club${path}`, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
    const expected = flags.CLUB_GATE_ENABLED === 'true' && !['/icon.svg','/robots.txt'].includes(path) ? 307 : 200;
    routes.push({path,status:result.status,expected});
  }
  console.log('RELEASE_AUDIT ' + JSON.stringify({flags,secretNames,database:counts[0],migrations:tables[0],ledger:ledger?.[0],security:security[0],trading,routes}));
  if (counts[0].superAdmins!==1 || counts[0].outdatedPaidPlans || !counts[0].admins || counts[0].negativeBalances || ledger?.[0].balanceMismatches || ledger?.[0].unbalancedPostings || ledger?.[0].lockedPrincipalMismatches || trading?.enrollmentEnabled || flags.TRADING_REQUESTS_ENABLED!=='false' || routes.some(r=>r.status!==r.expected) || (flags.CLUB_GATE_ENABLED==='true' && (!secretNames.includes('CLUB_PASSWORD_HASH') || !security[0].readOnlyAdminApplied))) process.exitCode=1;
} catch (error) {
  // Database/driver error objects may embed a connection string. Keep logs redacted.
  console.error('Production audit failed. Inspect database connectivity and Worker access securely.');
  process.exitCode=1;
} finally { await db.$disconnect(); }
