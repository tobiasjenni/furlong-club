import 'server-only';
import { cache } from 'react';
import { db } from './db';
import type { CycleSummary, DailyResultPoint } from './daily-results';

export type ClubResults = { asOf: string; points: DailyResultPoint[]; cycle: CycleSummary | null };
export const clubResults = cache(async (): Promise<ClubResults> => {
  const rows = await db.$queryRaw<{ data: ClubResults }[]>`SELECT jsonb_build_object(
    'asOf',to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'cycle',(SELECT jsonb_build_object('endDay',to_char("endDay",'YYYY-MM-DD'),'profitBps',"profitBps",'lockDays',"lockDays",'updatedAt',to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) FROM "ClubCycleSummary" WHERE id='harry' AND published),
    'points',COALESCE((SELECT jsonb_agg(jsonb_build_object('day',to_char(day,'YYYY-MM-DD'),'returnBps',"returnBps") ORDER BY day)
      FROM "ClubDailyResult" WHERE published AND day>=(date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'UTC')-interval '12 months')::date
      AND day<=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date),'[]'::jsonb)) AS data`;
  return rows[0].data;
});
