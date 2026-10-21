import { Prisma } from "@prisma/client";

export const adminCountsQuery = () => Prisma.sql`SELECT
  (SELECT count(*)::int FROM "Payment" WHERE provider='manual' AND status='CONFIRMING') AS deposits,
  (SELECT count(*)::int FROM "TradingAllocation" WHERE status='PENDING') AS pending,
  (SELECT count(*)::int FROM "TradingAllocation" WHERE (status='ACTIVE' AND "unlocksAt"<=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')) OR status='PAYOUT_READY') AS due`;

export const adminOverviewQuery = () => Prisma.sql`SELECT
  (SELECT count(*)::int FROM "User") AS users,
  (SELECT count(*)::int FROM "User" WHERE "createdAt">=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')-interval '30 days') AS "newUsers",
  (SELECT count(*)::int FROM "Subscription" WHERE status='ACTIVE' AND "endsAt">(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')) AS "activeSubs",
  (SELECT COALESCE(sum("revenueDeltaCents"),0)::float8 FROM "WalletJournal" WHERE "createdAt">=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')-interval '30 days') AS revenue,
  (SELECT count(*)::int FROM "Payment" WHERE status IN ('PENDING','CONFIRMING','PARTIAL')) AS payments`;
