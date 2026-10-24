import { Prisma } from "@prisma/client";
import type { Role } from "@prisma/client";

export type MemberFunding = { availableCents: number; depositedCents: number; adjustmentCents: number; reportedCents: number; committedCents: number; scheduledCents: number; pendingTradeCents: number; payoutCents: number; walletFrozen: boolean };
export type AdminUserPage = { total: number; users: ({ id: string; email: string; name: string | null; role: Role; status: string; tags: string[]; createdAt: string; lastLoginAt: string | null; planName: string | null } & MemberFunding)[] };

// Each aggregate reads one member's indexed history, preventing payment/allocation join multiplication.
const fundingColumns = Prisma.sql`u."balanceCents" AS "availableCents", u."walletFrozen",
  (SELECT COALESCE(sum(j."userDeltaCents"),0) FROM "WalletJournal" j WHERE j."userId"=u.id AND j.kind IN ('TOPUP','MANUAL_TOPUP')) AS "depositedCents",
  (SELECT COALESCE(sum(j."userDeltaCents"),0) FROM "WalletJournal" j WHERE j."userId"=u.id AND j.kind='ADMIN_ADJUSTMENT') AS "adjustmentCents",
  (SELECT COALESCE(sum(p."amountCents"),0) FROM "Payment" p WHERE p."userId"=u.id AND p.purpose='WALLET_TOPUP' AND p.status='CONFIRMING') AS "reportedCents",
  (SELECT COALESCE(sum(a."principalCents"),0) FROM "TradingAllocation" a WHERE a."userId"=u.id AND a.status IN ('ACTIVE','PAYOUT_READY')) AS "committedCents",
  (SELECT COALESCE(sum(a."principalCents"),0) FROM "TradingAllocation" a WHERE a."userId"=u.id AND a.status='ACTIVE' AND a."startsAt">(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')) AS "scheduledCents",
  (SELECT COALESCE(sum(a."principalCents"),0) FROM "TradingAllocation" a WHERE a."userId"=u.id AND a.status='PENDING') AS "pendingTradeCents",
  (SELECT COALESCE(sum(a."payoutCents"),0) FROM "TradingAllocation" a WHERE a."userId"=u.id AND a.status='PAYOUT_READY') AS "payoutCents"`;

export const memberFundingQuery = (uid: string) => Prisma.sql`SELECT to_jsonb(f) AS data FROM (SELECT ${fundingColumns} FROM "User" u WHERE u.id=${uid}) f`;

export function adminUsersQuery(search: string, filter: string, page: number) {
  const pattern = `%${search.replace(/[\\%_]/g, value => "\\" + value)}%`;
  const subscribed = Prisma.sql`EXISTS(SELECT 1 FROM "Subscription" s WHERE s."userId"=u.id AND s.status='ACTIVE' AND s."endsAt">(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))`;
  const condition = filter === "admins" ? Prisma.sql`u.role IN ('ADMIN','SUPER_ADMIN')`
    : filter === "subscribers" ? subscribed : filter === "free" ? Prisma.sql`NOT ${subscribed}`
    : filter === "suspended" ? Prisma.sql`u.status='SUSPENDED'` : filter === "closed" ? Prisma.sql`u.status='CLOSED'`
    : filter === "unverified" ? Prisma.sql`u."emailVerifiedAt" IS NULL` : filter === "marketing" ? Prisma.sql`u."marketingOptIn"=true` : Prisma.sql`true`;
  const fundingFilter = filter === 'paid' ? Prisma.sql`("depositedCents">0 OR "adjustmentCents">0)`
    : filter === 'deposit-review' ? Prisma.sql`"reportedCents">0`
    : filter === 'available' ? Prisma.sql`"availableCents">0`
    : filter === 'trading-review' ? Prisma.sql`"pendingTradeCents">0`
    : filter === 'committed' ? Prisma.sql`"committedCents">0`
    : filter === 'payout-due' ? Prisma.sql`"payoutCents">0` : Prisma.sql`true`;
  return Prisma.sql`WITH candidates AS (
    SELECT u.id,u.email,u.name,u.role,u.status,u.tags,u."createdAt",u."lastLoginAt",${fundingColumns} FROM "User" u
    WHERE (${search}='' OR u.email ILIKE ${pattern} OR u.name ILIKE ${pattern} OR ${search}=ANY(u.tags)) AND ${condition}
  ), matches AS (SELECT * FROM candidates WHERE ${fundingFilter}), selected AS (SELECT * FROM matches ORDER BY "createdAt" DESC,id DESC LIMIT 25 OFFSET ${(page - 1) * 25})
  SELECT jsonb_build_object('total',(SELECT count(*) FROM matches),'users',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id',m.id,'email',m.email,'name',m.name,'role',m.role,'status',m.status,'tags',m.tags,
    'availableCents',m."availableCents",'depositedCents',m."depositedCents",'adjustmentCents',m."adjustmentCents",'reportedCents',m."reportedCents",
    'committedCents',m."committedCents",'scheduledCents',m."scheduledCents",'pendingTradeCents',m."pendingTradeCents",'payoutCents',m."payoutCents",'walletFrozen',m."walletFrozen",
    'createdAt',to_char(m."createdAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'lastLoginAt',to_char(m."lastLoginAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'planName',(SELECT p.name FROM "Subscription" s JOIN "Plan" p ON p.id=s."planId" WHERE s."userId"=m.id AND s.status='ACTIVE' AND s."endsAt">(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') ORDER BY p.tier DESC,s."endsAt" DESC LIMIT 1)
  ) ORDER BY m."createdAt" DESC,m.id DESC) FROM selected m),'[]'::jsonb)) AS data`;
}

export const adminCountsQuery = () => Prisma.sql`SELECT
  (SELECT count(*)::int FROM "Payment" WHERE provider='manual' AND status='CONFIRMING') AS deposits,
  (SELECT count(*)::int FROM "TradingAllocation" WHERE status='PENDING') AS pending,
  (SELECT count(*)::int FROM "TradingAllocation" WHERE (status='ACTIVE' AND "unlocksAt"<=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')) OR status='PAYOUT_READY') AS due`;

export const adminOverviewQuery = () => Prisma.sql`SELECT
  (SELECT count(*)::int FROM "User") AS users,
  (SELECT count(*)::int FROM "User" WHERE "createdAt">=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')-interval '30 days') AS "newUsers",
  (SELECT count(*)::int FROM "Subscription" WHERE status='ACTIVE' AND "endsAt">(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')) AS "activeSubs",
  (SELECT COALESCE(sum("revenueDeltaCents"),0)::float8 FROM "WalletJournal" WHERE "createdAt">=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')-interval '30 days') AS revenue,
  (SELECT count(*)::int FROM "Payment" WHERE status IN ('PENDING','CONFIRMING','PARTIAL')) AS payments,
  (SELECT count(*)::int FROM "TradingAllocation" WHERE status IN ('ACTIVE','PAYOUT_READY')) AS "activeAllocations",
  (SELECT COALESCE(sum("principalCents"),0)::float8 FROM "TradingAllocation" WHERE status IN ('ACTIVE','PAYOUT_READY')) AS "committedCents",
  (SELECT COALESCE(sum("payoutCents"),0)::float8 FROM "TradingAllocation" WHERE status='PAYOUT_READY') AS "payoutDueCents"`;
