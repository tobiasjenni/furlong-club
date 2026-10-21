import { currentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";

function csv(value: unknown) {
  const s = value == null ? "" : String(value);
  // Prefix formula-like values so spreadsheets don't execute them.
  const safe = /^[\t\r\n ]*[=+\-@]/.test(s) || /^[\t\r\n]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET() {
  const admin = await currentUser();
  if (admin?.role !== "SUPER_ADMIN") return new Response("Forbidden", { status: 403 });
  const now = new Date();
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { email: true, name: true, country: true, marketingOptIn: true, status: true, tags: true, createdAt: true, lastLoginAt: true, subscriptions: { where: { status: "ACTIVE", endsAt: { gt: now } }, select: { endsAt: true, plan: { select: { name: true } } }, take: 1 } },
  });
  await audit(admin.id,"admin.users_exported",undefined,{ count: users.length });
  const rows = [
    ["email", "name", "country", "plan", "plan_ends", "marketing_opt_in", "status", "tags", "joined", "last_login"],
    ...users.map((u) => [u.email, u.name, u.country, u.subscriptions[0]?.plan.name ?? "Free", u.subscriptions[0]?.endsAt.toISOString(), u.marketingOptIn, u.status, u.tags.join("|"), u.createdAt.toISOString(), u.lastLoginAt?.toISOString()]),
  ];
  return new Response(rows.map((r) => r.map(csv).join(",")).join("\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "X-Content-Type-Options": "nosniff", "cache-control": "private, no-store", "content-disposition": `attachment; filename="users-${now.toISOString().slice(0, 10)}.csv"` },
  });
}
