import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { adminUsersQuery, type AdminUserPage } from "@/lib/admin-query";
import { db } from "@/lib/db";
import { date } from "@/lib/format";
import { isAdmin, roleLabel } from "@/lib/roles";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? "").slice(0, 200), filter = params.filter ?? "all";
  const page = Math.min(100000, Math.max(1, Math.floor(Number(params.page) || 1)));
  const take = 25;
  const skip = (page - 1) * take;
  const { users, total } = (await db.$queryRaw<{ data: AdminUserPage }[]>(adminUsersQuery(q, filter, page)))[0].data;
  const filters = ["all", "admins", "subscribers", "free", "marketing", "unverified", "suspended", "closed"];
  const pageNum = skip / take + 1;

  return (
    <div className="space-y-4">
      <div className="card"><h2 className="text-lg">Member management</h2><p className="muted mt-2 text-sm">Members register at <Link href="/signup" className="text-gold-300 underline">Create account</Link>. Open a member’s profile to review their account. Only Super Admin can grant admin access after they have signed in and confirmed their email.</p><p className="mt-2 text-sm text-gold-300">Your access: {roleLabel(admin.role)}</p></div>
      <form className="flex flex-col gap-2 sm:flex-row">
        <input name="q" defaultValue={q} placeholder="Search email, name or tag" className="input sm:max-w-sm" />
        <select name="filter" defaultValue={filter} className="input sm:max-w-[200px]">
          {filters.map((f) => <option key={f} value={f}>{f[0].toUpperCase() + f.slice(1)}</option>)}
        </select>
        <button className="btn-gold">Search</button>
        {admin.role === "SUPER_ADMIN" && <a href="/admin/users/export" className="btn-ghost">Export all (CSV)</a>}
      </form>
      <ul className="space-y-2 md:hidden">
        {users.map((u) => (
          <li key={u.id}>
            <Link href={`/admin/users/${u.id}`} className="card block p-4 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-semibold text-gold-300">{u.email}</span>
                <span className={`badge shrink-0 ${u.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>{u.status.toLowerCase()}</span>
              </div>
              <p className="muted mt-1 text-sm">
                {u.name ?? "No name"} · {u.planName ?? "Free"}{isAdmin(u.role) ? ` · ${roleLabel(u.role)}` : ""} · joined {date(u.createdAt)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <div className="card hidden overflow-x-auto p-0 sm:p-0 md:block">
        <table className="table">
          <thead><tr><th>Email</th><th>Name</th><th>Plan</th><th>Tags</th><th>Status</th><th>Joined</th><th>Last login</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><Link href={`/admin/users/${u.id}`} className="text-gold-300 hover:underline">{u.email}</Link>{isAdmin(u.role) && <span className="badge ml-2 bg-gold-400/20 text-gold-300">{roleLabel(u.role)}</span>}</td>
                <td>{u.name}</td>
                <td>{u.planName ?? <span className="muted">Free</span>}</td>
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
