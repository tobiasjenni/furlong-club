import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";

export default async function AdminAudit({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  await requireAdmin();
  const { action = "" } = await searchParams;
  const entries = await db.auditLog.findMany({
    where: action ? { action: { startsWith: action } } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const actorIds = [...new Set(entries.map((e) => e.actorId).filter((id): id is string => !!id))];
  const actors = new Map((await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } })).map((u) => [u.id, u.email]));
  const filters = ["", "admin.", "payment.", "user.login", "user."];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link key={f} href={f ? `?action=${f}` : "?"} className={`btn-ghost px-3 py-1.5 text-xs ${action === f ? "border-gold-400 text-gold-300" : ""}`}>
            {f || "Everything"}
          </Link>
        ))}
      </div>
      <div className="card overflow-x-auto p-0 sm:p-0">
        <table className="table">
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap">{dateTime(e.createdAt)}</td>
                <td>{e.actorId ? actors.get(e.actorId) ?? e.actorId : <span className="muted">system</span>}</td>
                <td><code className="text-xs">{e.action}</code></td>
                <td className="text-xs">{e.target}</td>
                <td className="max-w-xs break-all text-xs text-cream/60">{e.meta ? JSON.stringify(e.meta) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
