import crypto from "node:crypto";
import { db } from "./db";

// One atomic, shared counter across Worker instances. Hash identifying keys before storage.
export async function rateLimit(key: string, limit: number, windowMs: number) {
  const digest = crypto.createHash("sha256").update(key).digest("hex");
  const rows = await db.$queryRaw<{ hits: number }[]>`INSERT INTO "RateLimit" (key,hits,"resetAt")
    VALUES (${digest},1,(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')+${windowMs}::integer*interval '1 millisecond')
    ON CONFLICT (key) DO UPDATE SET
      hits=CASE WHEN "RateLimit"."resetAt"<=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') THEN 1 ELSE LEAST("RateLimit".hits+1,${limit + 1}::integer) END,
      "resetAt"=CASE WHEN "RateLimit"."resetAt"<=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
    RETURNING hits`;
  return rows[0].hits <= limit;
}
