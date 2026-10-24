import { Prisma } from "@prisma/client";

export const activityTypes = ["all", "deposit", "allocation", "result", "payout", "membership", "adjustment"] as const;
export type ActivityType = typeof activityTypes[number];
export type PortalActivity = { id: string; at: string; kind: string; description: string; amountCents: number; creditDeltaCents: number; reference: string; paymentId: string | null; allocationId: string | null; bucket: ActivityType };
export type PortalActivityPage = { total: number; rows: PortalActivity[] };

export function portalActivityQuery(userId: string, type: ActivityType, search: string, page: number, size = 20) {
  const pattern = `%${search.replace(/[\\%_]/g, value => "\\" + value)}%`;
  return Prisma.sql`WITH entries AS (
    SELECT j.id,j."createdAt" AS at,j.kind,j.description,
      CASE WHEN j.kind='TRADING_PAYOUT' THEN COALESCE(a."payoutCents",0) ELSE GREATEST(abs(j."userDeltaCents"::bigint),abs(j."lockedDeltaCents"::bigint)) END AS amount,
      j."userDeltaCents" AS credit,COALESCE(j."paymentId",j."allocationId",j.id) AS reference,j."paymentId",j."allocationId",
      CASE WHEN j.kind='ADMIN_ADJUSTMENT' THEN 'adjustment' WHEN j.kind='TRADING_LOCK' THEN 'allocation' WHEN j.kind='TRADING_PAYOUT' THEN 'payout'
      WHEN j."paymentId" IS NOT NULL AND j."userDeltaCents">0 THEN 'deposit'
      WHEN j."planId" IS NOT NULL AND j."userDeltaCents"<0 THEN 'membership' ELSE 'adjustment' END AS bucket
    FROM "WalletJournal" j LEFT JOIN "TradingAllocation" a ON a.id=j."allocationId" AND a."userId"=j."userId" WHERE j."userId"=${userId}
    UNION ALL SELECT 'result:'||a.id,a."resultAt",'RESULT_RECORDED','Actual allocation result recorded',a."profitCents",0,a.id,NULL,a.id,'result'
    FROM "TradingAllocation" a WHERE a."userId"=${userId} AND a."resultAt" IS NOT NULL AND a.status IN ('PAID','PAYOUT_READY')
  ), filtered AS (SELECT * FROM entries WHERE (${type}='all' OR bucket=${type}) AND (description ILIKE ${pattern} OR reference ILIKE ${pattern})),
  selected AS (SELECT * FROM filtered ORDER BY at DESC,id DESC LIMIT ${size} OFFSET ${(page - 1) * size})
  SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'rows',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'at',to_char(at,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'kind',kind,'description',description,'amountCents',amount,'creditDeltaCents',credit,'reference',reference,'paymentId',"paymentId",'allocationId',"allocationId",'bucket',bucket) ORDER BY at DESC,id DESC) FROM selected),'[]'::jsonb)) AS activity`;
}
