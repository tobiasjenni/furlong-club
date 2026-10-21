import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { db } from "@/lib/db";
import { dateTime, usd } from "@/lib/format";
import { adminOverviewQuery } from "@/lib/admin-query";

export default async function AdminHome() {
  await requireAdmin();
  const [rows, recent] = await Promise.all([
    db.$queryRaw<{ users: number; newUsers: number; activeSubs: number; revenue: number; payments: number }[]>(adminOverviewQuery()),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, email: true, name: true, createdAt: true } }),
  ]);
  const { users, newUsers, activeSubs, revenue, payments: pending } = rows[0];
  const stats = [
    { label: "Users", value: users },
    { label: "New (30 days)", value: newUsers },
    { label: "Active subscriptions", value: activeSubs },
    { label: "Sales (30 days, ledger)", value: usd(revenue) },
    { label: "Open payments", value: pending },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="card p-4 sm:p-4">
            <p className="muted text-xs">{s.label}</p>
            <p className="mt-1 font-display text-2xl">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <h2 className="mb-4 text-xl">Newest sign-ups</h2>
        <table className="table">
          <thead><tr><th>Email</th><th>Name</th><th>Joined</th></tr></thead>
          <tbody>
            {recent.map((u) => (
              <tr key={u.id}><td><Link href={`/admin/users/${u.id}`} className="text-gold-300 hover:underline">{u.email}</Link></td><td>{u.name}</td><td>{dateTime(u.createdAt)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
