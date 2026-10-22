import { neon } from "@neondatabase/serverless";

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Club network storage is unavailable");
  // HTTP transport is compatible with middleware; no connection pool or raw IP log.
  return neon(url, { fetchOptions: { cache: "no-store", signal: AbortSignal.timeout(5000) } });
}
function validate(key: string) {
  if (!/^[0-9a-f]{64}$/.test(key)) throw new Error("Invalid club network key");
}
export async function clubNetworkAdmitted(key: string) {
  validate(key);
  const rows = await database()`SELECT 1 FROM "ClubAdmission" WHERE key = ${key} LIMIT 1`;
  return rows.length === 1;
}
export async function rememberClubNetwork(key: string) {
  validate(key);
  await database()`INSERT INTO "ClubAdmission" (key) VALUES (${key}) ON CONFLICT (key) DO NOTHING`;
}
