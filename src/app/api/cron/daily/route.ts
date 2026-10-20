import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { runDailyJobs } from "@/lib/daily";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Optional HTTP trigger for the daily jobs; production runs them from GitHub Actions with `npm run daily`.
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await runDailyJobs());
}
