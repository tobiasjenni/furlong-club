import { Prisma } from "@prisma/client";
import type { Role } from "@prisma/client";

export type AdminUserPage = { total: number; users: { id: string; email: string; name: string | null; role: Role; status: string; tags: string[]; createdAt: string; lastLoginAt: string | null; planName: string | null }[] };

export function adminUsersQuery(search: string, filter: string, page: number) {
  const pattern = `%${search.replace(/[\\%_]/g, value => "\\" + value)}%`;
  const subscribed = Prisma.sql`EXISTS(SELECT 1 FROM "Subscription" s WHERE s."userId"=u.id AND s.status='ACTIVE' AND s."endsAt">(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))`;
  const condition = filter === "admins" ? Prisma.sql`u.role IN ('ADMIN','SUPER_ADMIN')`
    : filter === "subscribers" ? subscribed : filter === "free" ? Prisma.sql`NOT ${subscribed}`
    : filter === "suspended" ? Prisma.sql`u.status='SUSPENDED'` : filter === "closed" ? Prisma.sql`u.status='CLOSED'`
    : filter === "unverified" ? Prisma.sql`u."emailVerifiedAt" IS NULL` : filter === "marketing" ? Prisma.sql`u."marketingOptIn"=true` : Prisma.sql`true`;
  return Prisma.sql`WITH matches AS (
    SELECT u.id,u.email,u.name,u.role,u.status,u.tags,u."createdAt",u."lastLoginAt" FROM "User" u
    WHERE (${search}='' OR u.email ILIKE ${pattern} OR u.name ILIKE ${pattern} OR ${search}=ANY(u.tags)) AND ${condition}
  ), selected AS (SELECT * FROM matches ORDER BY "createdAt" DESC,id DESC LIMIT 25 OFFSET ${(page - 1) * 25})
  SELECT jsonb_build_object('total',(SELECT count(*) FROM matches),'users',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id',m.id,'email',m.email,'name',m.name,'role',m.role,'status',m.status,'tags',m.tags,
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
