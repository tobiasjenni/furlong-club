import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { adminUsersQuery, type AdminUserPage } from "@/lib/admin-query";
import { db } from "@/lib/db";
import { usd } from "@/lib/format";
import { FundingStatus } from "@/components/admin/MemberFunding";
import { canManageUser, isAdmin, roleLabel } from "@/lib/roles";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string; deleted?: string }> }) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? "").slice(0, 200), filter = params.filter ?? "all";
  const page = Math.min(100000, Math.max(1, Math.floor(Number(params.page) || 1)));
  const take = 25;
  const skip = (page - 1) * take;
  const { users, total } = (await db.$queryRaw<{ data: AdminUserPage }[]>(adminUsersQuery(q, filter, page)))[0].data;
  const filters = { all: 'All members', paid: 'Approved funding', 'deposit-review': 'Deposits to review', available: 'Available credit', 'trading-review': 'Trading to approve', committed: 'Committed to Rob', 'payout-due': 'Payout due', admins: 'Admins', subscribers: 'Subscribers', free: 'Free', marketing: 'Marketing', unverified: 'Unverified', suspended: 'Suspended', closed: 'Closed' };
  const pageNum = skip / take + 1;

  return (
    <div className="space-y-4">
      {params.deleted === '1' && <p role="status" className="card border border-emerald-400/20 text-sm text-emerald-300">User permanently deleted from the CRM. Their account cannot sign in and their email can be used for a new registration.</p>}
      <div className="card"><h2 className="text-lg">Members & funding</h2><p className="muted mt-2 text-sm">See approved deposits, available credit and funds committed to Rob in one view. Open a member for approvals, corrections and account controls.{admin.role === 'SUPER_ADMIN' ? ' Credit corrections require your password and an internal reason.' : ' Your Admin access is read-only.'}</p><p className="mt-2 text-sm text-gold-300">Your access: {roleLabel(admin.role)}</p></div>
      <nav aria-label="Funding filters" className="flex flex-wrap gap-2">{(['deposit-review', 'available', 'trading-review', 'committed', 'payout-due'] as const).map(f => <Link key={f} href={`?q=${encodeURIComponent(q)}&filter=${f}`} className={filter === f ? 'btn-gold' : 'btn-ghost'} aria-current={filter === f ? 'page' : undefined}>{filters[f]}</Link>)}</nav>
      <form className="flex flex-col gap-2 sm:flex-row">
        <input aria-label="Search email, name or tag" name="q" defaultValue={q} placeholder="Search email, name or tag" className="input sm:max-w-sm" />
        <select aria-label="Member filter" name="filter" defaultValue={filter} className="input sm:max-w-[200px]">
          {Object.entries(filters).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
                {u.name ?? "No name"}{isAdmin(u.role) ? ` · ${roleLabel(u.role)}` : ""}
              </p>
              <dl className="my-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="muted text-xs">Approved deposits</dt><dd>{usd(u.depositedCents)}</dd></div><div><dt className="muted text-xs">Corrections</dt><dd>{usd(u.adjustmentCents)}</dd></div><div><dt className="text-sky-200 text-xs">Available credit</dt><dd>{usd(u.availableCents)}</dd></div><div><dt className="text-emerald-300 text-xs">Committed to Rob</dt><dd>{usd(u.committedCents)}</dd></div></dl>
              <FundingStatus funding={u} />
              {(u.reportedCents > 0 || u.pendingTradeCents > 0 || u.payoutCents > 0) && <p className="muted mt-2 text-xs">Deposit review: {usd(u.reportedCents)} · Trading requests: {usd(u.pendingTradeCents)} · Payout due: {usd(u.payoutCents)}</p>}
              <span className="mt-2 inline-block text-sm text-gold-300">{canManageUser(admin, u) ? 'Manage account →' : 'View account →'}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="card hidden overflow-x-auto p-0 sm:p-0 md:block">
        <table className="table">
          <thead><tr><th>Member</th><th>Approved deposits</th><th>Corrections</th><th>Available credit</th><th>Committed to Rob</th><th>Needs attention</th><th>Account</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><Link href={`/admin/users/${u.id}`} className="text-gold-300 hover:underline">{u.name ?? u.email}</Link><p className="muted text-xs">{u.email}</p>{isAdmin(u.role) && <span className="badge bg-gold-400/20 text-gold-300">{roleLabel(u.role)}</span>}<p className="muted text-xs">{u.status.toLowerCase()}</p></td>
                <td>{usd(u.depositedCents)}</td><td>{usd(u.adjustmentCents)}</td>
                <td className="text-sky-200">{usd(u.availableCents)}</td>
                <td className="text-emerald-300">{usd(u.committedCents)}{u.scheduledCents > 0 && <p className="muted text-xs">{usd(u.scheduledCents)} awaiting entry</p>}</td>
                <td className="min-w-48"><FundingStatus funding={u} />{u.reportedCents > 0 && <p className="mt-2 text-xs">Deposit review: {usd(u.reportedCents)}</p>}{u.pendingTradeCents > 0 && <p className="mt-2 text-xs">Trading request: {usd(u.pendingTradeCents)}</p>}{u.payoutCents > 0 && <p className="mt-2 text-xs">Payout due: {usd(u.payoutCents)}</p>}</td>
                <td><Link className="btn-ghost workspace-record-action" href={`/admin/users/${u.id}`}>{canManageUser(admin, u) ? 'Manage account' : 'View account'}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length === 0 && <p className="card muted">No members match this search and filter.</p>}
      <p className="muted text-xs">USD club credit. Approved deposits show the original posted receipts; signed corrections are listed separately. Available credit excludes committed capital. Pending deposit reports are unverified; pending trading requests are not reserved. Payout due includes principal and recorded results.</p>
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
