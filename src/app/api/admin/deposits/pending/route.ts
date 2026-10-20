import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await currentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  const count = await db.payment.count({ where: { provider: "manual", status: "CONFIRMING" } });
  return NextResponse.json({ count }, { headers: { "Cache-Control": "private, no-store" } });
}
