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
  const flags = Object.fromEntries(bindings.filter(b => b.type === 'plain_text' && ['APP_ENV','PAYMENT_PROVIDER','WALLET_ENABLED','DATABASE_DRIVER','DEPOSIT_MODE','TRADING_REQUESTS_ENABLED','CLUB_GATE_ENABLED','EMAIL_VERIFICATION_REQUIRED','EMAIL_PROVIDER'].includes(b.name)).map(b => [b.name,b.text]));
  const emailPolicy = await db.$queryRaw`SELECT "emailVerificationRequired" AS required FROM "AuthPolicy" WHERE id='members'`;
  if (emailPolicy[0]?.required !== (flags.EMAIL_VERIFICATION_REQUIRED !== 'false')) throw new Error('Member email policy configuration mismatch');
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
    to_regclass('public."TradingAllocation"') IS NOT NULL AS "tradingMigrationApplied",
    to_regclass('public."ClubAdmission"') IS NOT NULL AS "networkAdmissionApplied"`;
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
  // Check original credits separately from legitimate owner-recorded corrections.
  const deposits = await db.$queryRaw`WITH receipts AS (
    SELECT p.id,p.status,p."amountCents",p.network,p."payinHash",
      count(j.id) FILTER (WHERE j.kind IN ('TOPUP','MANUAL_TOPUP')) AS credits,
      COALESCE(sum(j."userDeltaCents") FILTER (WHERE j.kind IN ('TOPUP','MANUAL_TOPUP')),0) AS cents
    FROM "Payment" p LEFT JOIN "WalletJournal" j ON j."paymentId"=p.id
    WHERE p.purpose='WALLET_TOPUP' GROUP BY p.id
  ) SELECT
    (SELECT count(*)::int FROM receipts WHERE credits>1) AS "duplicateOriginalCredits",
    (SELECT count(*)::int FROM receipts WHERE status='CONFIRMED' AND (credits<>1 OR cents<>"amountCents")) AS "confirmedCreditMismatches",
    (SELECT count(*)::int FROM receipts WHERE status<>'CONFIRMED' AND credits<>0) AS "unconfirmedWithCredit",
    (SELECT count(*)::int FROM (SELECT network,lower(regexp_replace("payinHash",'^0x','','i')) FROM receipts
      WHERE credits>0 AND "payinHash" IS NOT NULL GROUP BY network,lower(regexp_replace("payinHash",'^0x','','i')) HAVING count(*)>1) d) AS "reusedCreditedTransactions"`;
  const reference = process.env.AUDIT_DEPOSIT_REFERENCE?.trim();
  let depositLookup;
  if (reference) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference)) throw new Error('Invalid audit reference');
    // Only the selected receipt and same-member/same-amount requests; no identity, wallet or hash.
    depositLookup = await db.$queryRaw`SELECT p.id,p.status::text,p."amountCents",
      (SELECT count(*)::int FROM "WalletJournal" j WHERE j."paymentId"=p.id AND j.kind IN ('TOPUP','MANUAL_TOPUP')) AS "originalCreditCount",
      (SELECT COALESCE(sum(j."userDeltaCents"),0)::float8 FROM "WalletJournal" j WHERE j."paymentId"=p.id) AS "postedCreditCents",
      (SELECT COALESCE(sum(j."userDeltaCents"),0)::float8 FROM "WalletJournal" j WHERE j."paymentId"=p.id AND j.kind='ADMIN_ADJUSTMENT') AS "linkedCorrectionCents"
      FROM "Payment" p JOIN "Payment" selected ON selected.id=${reference}
      WHERE selected.purpose='WALLET_TOPUP' AND p.purpose='WALLET_TOPUP'
        AND p."userId"=selected."userId" AND p."amountCents"=selected."amountCents"
      ORDER BY p."createdAt" DESC,p.id DESC LIMIT 25`;
  }
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
    const locked = flags.CLUB_GATE_ENABLED === 'true';
    const expected = locked && !['/login','/icon.svg','/robots.txt'].includes(path) ? 307 : 200;
    // Public icons can be served directly by Cloudflare's static asset cache.
    const gateHeaders = !locked || path === '/icon.svg' || (/no-store/.test(result.headers.get('cache-control') || '') && /noindex/.test(result.headers.get('x-robots-tag') || ''));
    const correctEntrance = expected !== 307 || new URL(result.headers.get('location'), 'https://furlong.club').pathname === '/entrance';
    routes.push({path,status:result.status,expected,gateHeaders,correctEntrance});
  }
  console.log('RELEASE_AUDIT ' + JSON.stringify({flags,secretNames,database:counts[0],migrations:tables[0],ledger:ledger?.[0],deposits:deposits[0],depositLookup,security:security[0],trading,routes}));
  if (Object.values(deposits[0]).some(value => value !== 0)) process.exitCode=1;
  if (counts[0].superAdmins!==1 || counts[0].outdatedPaidPlans || !counts[0].admins || counts[0].negativeBalances || ledger?.[0].balanceMismatches || ledger?.[0].unbalancedPostings || ledger?.[0].lockedPrincipalMismatches || trading?.enrollmentEnabled !== (flags.TRADING_REQUESTS_ENABLED==='true') || routes.some(r=>r.status!==r.expected || !r.gateHeaders || !r.correctEntrance) || (flags.CLUB_GATE_ENABLED==='true' && (!secretNames.includes('CLUB_PASSWORD_HASH') || !security[0].readOnlyAdminApplied || !tables[0].networkAdmissionApplied))) process.exitCode=1;
} catch (error) {
  // Database/driver error objects may embed a connection string. Keep logs redacted.
  console.error('Production audit failed. Inspect database connectivity and Worker access securely.');
  process.exitCode=1;
} finally { await db.$disconnect(); }
