import "server-only";
import { cache } from "react";
import { db } from "./db";
import type { SyndicateEntry } from "./syndicate";

// A request-scoped database snapshot drives the public clock and the request form.
export const upcomingSyndicates = cache(async () => {
  const rows = await db.$queryRaw<{ schedule: { asOf: string; entries: SyndicateEntry[] } }[]>`
    SELECT jsonb_build_object('asOf',to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'entries',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'phase',phase,
        'startsAt',to_char("startsAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'endsAt',to_char("startsAt"+interval '28 days','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY "startsAt")
        FROM "SyndicateEntry" WHERE accepting AND "startsAt">CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),'[]'::jsonb)) AS schedule`;
  return rows[0].schedule;
});
