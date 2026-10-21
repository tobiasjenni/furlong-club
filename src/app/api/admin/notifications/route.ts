import { NextResponse } from "next/server";
import { currentUser, adminConfirmed } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { adminCounts } from "@/lib/admin-data";

export async function GET() {
  const user = await currentUser();
  const headers = { "Cache-Control": "private, no-store" };
  if (!user || !isAdmin(user.role) || !await adminConfirmed(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  return NextResponse.json(await adminCounts(), { headers });
}
