import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

function csv(value: unknown) {
  const s = value == null ? "" : String(value);
  // Prefix formula-like values so spreadsheets don't execute them.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET() {
  const admin = await currentUser();
  if (admin?.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
  const now = new Date();
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { subscriptions: { where: { status: "ACTIVE", endsAt: { gt: now } }, include: { plan: true }, take: 1 } },
  });
  const rows = [
    ["email", "name", "country", "plan", "plan_ends", "marketing_opt_in", "status", "tags", "joined", "last_login"],
    ...users.map((u) => [u.email, u.name, u.country, u.subscriptions[0]?.plan.name ?? "Free", u.subscriptions[0]?.endsAt.toISOString(), u.marketingOptIn, u.status, u.tags.join("|"), u.createdAt.toISOString(), u.lastLoginAt?.toISOString()]),
  ];
  return new Response(rows.map((r) => r.map(csv).join(",")).join("\n"), {
    headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="users-${now.toISOString().slice(0, 10)}.csv"` },
  });
}
