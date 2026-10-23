import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { db } from "@/lib/db";
import { dateTimeUtc, usd } from "@/lib/format";
import { adminOverviewQuery } from "@/lib/admin-query";

export default async function AdminHome() {
  await requireAdmin();
  const [rows, recent] = await Promise.all([
    db.$queryRaw<{ users: number; newUsers: number; activeAllocations: number; committedCents: number; payoutDueCents: number }[]>(adminOverviewQuery()),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, email: true, name: true, createdAt: true } }),
  ]);
  const { users, newUsers, activeAllocations, committedCents, payoutDueCents } = rows[0];
  const stats = [
    { label: "Users", value: users },
    { label: "New (30 days)", value: newUsers },
    { label: "Approved / unpaid allocations", value: activeAllocations },
    { label: "Reserved / unpaid principal", value: usd(committedCents) },
    { label: "Recorded payouts due", value: usd(payoutDueCents) },
  ];
  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl">Rob’s syndicate overview</h2><p className="muted mt-2 text-sm">Funding review, scheduled entries and manual payouts. Reserved principal includes approved allocations waiting for their start. All times are UTC.</p></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="card p-4 sm:p-4">
            <p className="muted text-xs">{s.label}</p>
            <p className="mt-1 font-display text-2xl">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
        ["/admin/deposits", "Deposit review", "Check reported incoming transfers."],
        ["/admin/trading?status=PENDING", "Allocation requests", "Review funds, destinations and entry dates."],
        ["/admin/syndicates", "Moon calendar", "See entry availability and reserved capital."],
        ["/admin/trading?status=due", "Results & payouts due", "Process matured allocations and recorded amounts due."],
      ].map(([href,title,description]) => <Link key={href} href={href} className="card block hover:border-gold-400/50"><h3 className="text-gold-300">{title} →</h3><p className="muted mt-2 text-xs">{description}</p></Link>)}</div>
      <div className="card overflow-x-auto">
        <h2 className="mb-4 text-xl">Newest sign-ups</h2>
        <table className="table">
          <thead><tr><th>Email</th><th>Name</th><th>Joined · UTC</th></tr></thead>
          <tbody>
            {recent.map((u) => (
              <tr key={u.id}><td><Link href={`/admin/users/${u.id}`} className="text-gold-300 hover:underline">{u.email}</Link></td><td>{u.name}</td><td>{dateTimeUtc(u.createdAt)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
