import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { reconcileRecentPayments } from "@/lib/payments";

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!expected || !token || Buffer.byteLength(token) !== Buffer.byteLength(expected) || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await reconcileRecentPayments());
}
