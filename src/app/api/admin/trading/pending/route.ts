import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await currentUser();
  const headers = { "Cache-Control": "private, no-store" };
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  const [pending, due] = await Promise.all([
    db.tradingAllocation.count({ where: { status: "PENDING" } }),
    db.tradingAllocation.count({ where: { OR: [{ status: "ACTIVE", unlocksAt: { lte: new Date() } }, { status: "PAYOUT_READY" }] } }),
  ]);
  return NextResponse.json({ pending, due }, { headers });
}
