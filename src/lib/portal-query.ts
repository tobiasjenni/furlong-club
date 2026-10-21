import { Prisma } from "@prisma/client";

// One database snapshot. The only parameter is the authenticated member's ID.
// Membership spending and external payouts change value; they are never counted as profit.
export function portalSnapshotQuery(userId: string) {
  return Prisma.sql`
    WITH me AS (SELECT id,"balanceCents" FROM "User" WHERE id=${userId}),
    a AS (SELECT t.* FROM "TradingAllocation" t JOIN me ON me.id=t."userId"),
    totals AS (SELECT
      COALESCE(sum("principalCents") FILTER (WHERE status='ACTIVE'),0) AS active,
      COALESCE(sum("principalCents") FILTER (WHERE status IN ('ACTIVE','PAYOUT_READY')),0) AS committed,
      COALESCE(sum("payoutCents") FILTER (WHERE status='PAYOUT_READY'),0) AS due,
      COALESCE(sum("profitCents") FILTER (WHERE status IN ('PAYOUT_READY','PAID') AND "resultAt" IS NOT NULL),0) AS profit,
      COALESCE(sum("principalCents") FILTER (WHERE status IN ('PAYOUT_READY','PAID') AND "resultAt" IS NOT NULL),0) AS result_principal,
      COALESCE(sum("payoutCents") FILTER (WHERE status='PAID'),0) AS paid,
      count(*) FILTER (WHERE status IN ('PAYOUT_READY','PAID') AND "resultAt" IS NOT NULL) AS results,
      count(*) FILTER (WHERE status IN ('ACTIVE','PAYOUT_READY')) AS active_count,
      count(*) FILTER (WHERE status='PENDING') AS pending_count FROM a),
    pending AS (SELECT count(*) AS count,COALESCE(sum(p."amountCents"),0) AS cents
      FROM "Payment" p JOIN me ON p."userId"=me.id
      WHERE p.purpose='WALLET_TOPUP' AND p.status IN ('PENDING','CONFIRMING','PARTIAL')
      AND (p."expiresAt" IS NULL OR p."expiresAt">(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))),
    events AS (
      SELECT j."createdAt" AS at,j."userDeltaCents"::bigint+j."lockedDeltaCents"::bigint AS value_delta,0::bigint AS profit_delta,0 AS result_count
      FROM "WalletJournal" j JOIN me ON j."userId"=me.id
      UNION ALL SELECT "resultAt","profitCents"::bigint,"profitCents"::bigint,1 FROM a
        WHERE "resultAt" IS NOT NULL AND "profitCents" IS NOT NULL AND status IN ('PAYOUT_READY','PAID')
      UNION ALL SELECT "paidAt",-"profitCents"::bigint,0::bigint,0 FROM a
        WHERE "paidAt" IS NOT NULL AND "profitCents" IS NOT NULL AND status='PAID'
    ),
    daily AS (SELECT at::date AS day,sum(value_delta) AS value_delta,sum(profit_delta) AS profit_delta,sum(result_count) AS result_count
      FROM events WHERE at<=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') GROUP BY at::date),
    bounds AS (SELECT CASE WHEN min(day) IS NULL THEN NULL ELSE GREATEST(min(day),((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date-365)) END AS start FROM daily),
    days AS (SELECT generate_series(bounds.start,(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date,interval '1 day')::date AS day FROM bounds WHERE bounds.start IS NOT NULL),
    opening AS (SELECT COALESCE(sum(value_delta),0) AS value,COALESCE(sum(profit_delta),0) AS profit FROM daily,bounds WHERE daily.day<bounds.start),
    curve AS (SELECT days.day,
      opening.value+sum(COALESCE(daily.value_delta,0)) OVER (ORDER BY days.day) AS value,
      opening.profit+sum(COALESCE(daily.profit_delta,0)) OVER (ORDER BY days.day) AS profit,
      COALESCE(daily.profit_delta,0) AS daily_profit,COALESCE(daily.result_count,0) AS result_count
      FROM days CROSS JOIN opening LEFT JOIN daily ON daily.day=days.day)
    SELECT jsonb_build_object(
      'availableCents',me."balanceCents",'activePrincipalCents',totals.active,'committedCents',totals.committed,
      'payoutDueCents',totals.due,'valueCents',me."balanceCents"::bigint+totals.active+totals.due,
      'recordedProfitCents',totals.profit,'resultPrincipalCents',totals.result_principal,'paidOutCents',totals.paid,
      'resultCount',totals.results,'activeCount',totals.active_count,'pendingCount',totals.pending_count,
      'pendingDepositCount',pending.count,'pendingDepositCents',pending.cents,
      'asOf',to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'series',COALESCE((SELECT jsonb_agg(jsonb_build_object('day',to_char(day,'YYYY-MM-DD'),'valueCents',value,'profitCents',profit,'dailyProfitCents',daily_profit,'resultCount',result_count) ORDER BY day) FROM curve),'[]'::jsonb)
    ) AS snapshot FROM me CROSS JOIN totals CROSS JOIN pending`;
}

