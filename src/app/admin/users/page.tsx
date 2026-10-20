import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { date } from "@/lib/format";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  const { q = "", filter = "all", page = "1" } = await searchParams;
  const take = 25;
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
  const now = new Date();
  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { tags: { has: q } }] } : {}),
    ...(filter === "subscribers" ? { subscriptions: { some: { status: "ACTIVE", endsAt: { gt: now } } } } : {}),
    ...(filter === "free" ? { subscriptions: { none: { status: "ACTIVE", endsAt: { gt: now } } } } : {}),
    ...(filter === "suspended" ? { status: "SUSPENDED" } : {}),
    ...(filter === "closed" ? { status: "CLOSED" } : {}),
    ...(filter === "unverified" ? { emailVerifiedAt: null } : {}),
    ...(filter === "marketing" ? { marketingOptIn: true } : {}),
  };
  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: { subscriptions: { where: { status: "ACTIVE", endsAt: { gt: now } }, include: { plan: true }, take: 1 } },
    }),
    db.user.count({ where }),
  ]);
  const filters = ["all", "subscribers", "free", "marketing", "unverified", "suspended", "closed"];
  const pageNum = skip / take + 1;

  return (
    <div className="space-y-4">
      <form className="flex flex-col gap-2 sm:flex-row">
        <input name="q" defaultValue={q} placeholder="Search email, name or tag" className="input sm:max-w-sm" />
        <select name="filter" defaultValue={filter} className="input sm:max-w-[200px]">
          {filters.map((f) => <option key={f} value={f}>{f[0].toUpperCase() + f.slice(1)}</option>)}
        </select>
        <button className="btn-gold">Search</button>
        <a href="/admin/users/export" className="btn-ghost">Export all (CSV)</a>
      </form>
      <div className="card overflow-x-auto p-0 sm:p-0">
        <table className="table">
          <thead><tr><th>Email</th><th>Name</th><th>Plan</th><th>Tags</th><th>Status</th><th>Joined</th><th>Last login</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><Link href={`/admin/users/${u.id}`} className="text-gold-300 hover:underline">{u.email}</Link>{u.role === "ADMIN" && <span className="badge ml-2 bg-gold-400/20 text-gold-300">admin</span>}</td>
                <td>{u.name}</td>
                <td>{u.subscriptions[0]?.plan.name ?? <span className="muted">Free</span>}</td>
                <td className="text-xs">{u.tags.join(", ")}</td>
                <td>{u.status === "ACTIVE" ? "Active" : <span className="text-red-300">{u.status === "CLOSED" ? "Closed" : "Suspended"}</span>}</td>
                <td>{date(u.createdAt)}</td>
                <td>{date(u.lastLoginAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="muted">{total} users</span>
        <div className="flex gap-2">
          {pageNum > 1 && <Link className="btn-ghost px-3 py-1.5" href={`?q=${encodeURIComponent(q)}&filter=${filter}&page=${pageNum - 1}`}>Previous</Link>}
          {skip + take < total && <Link className="btn-ghost px-3 py-1.5" href={`?q=${encodeURIComponent(q)}&filter=${filter}&page=${pageNum + 1}`}>Next</Link>}
        </div>
      </div>
    </div>
  );
}
