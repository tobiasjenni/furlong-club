import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import { addNote, cancelSubscription, confirmEmail, grantPlan, signOutUser, updateUser } from "@/app/actions/admin";
import { ResetLinkForm } from "../AdminForms";
import { db } from "@/lib/db";
import { date, dateTime, usd } from "@/lib/format";

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const user = await db.user.findUnique({
    where: { id: (await params).id },
    include: {
      subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } },
      payments: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 20 },
      notes: { include: { author: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!user) notFound();
  const plans = await db.plan.findMany({ where: { priceCents: { gt: 0 } }, orderBy: { sortOrder: "asc" } });
  const now = new Date();

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-4">
        <div className="card">
          <h2 className="text-xl">{user.name ?? "—"}</h2>
          <p className="muted text-sm">{user.email}</p>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <dt className="muted">Email confirmed</dt>
            <dd>
              {user.emailVerifiedAt ? date(user.emailVerifiedAt) : (
                <form action={confirmEmail}><input type="hidden" name="userId" value={user.id} /><button className="text-gold-300 hover:underline">Not yet · confirm manually</button></form>
              )}
            </dd>
            <dt className="muted">Country</dt><dd>{user.country ?? "—"}</dd>
            <dt className="muted">Joined</dt><dd>{dateTime(user.createdAt)}</dd>
            <dt className="muted">Last login</dt><dd>{dateTime(user.lastLoginAt)}</dd>
            <dt className="muted">18+ confirmed</dt><dd>{date(user.ageConfirmedAt)}</dd>
            <dt className="muted">Marketing</dt><dd>{user.marketingOptIn ? "Opted in" : "No"}</dd>
            <dt className="muted">Balance</dt><dd>{usd(user.balanceCents)}</dd>
            {user.closedAt && <><dt className="muted">Closed by user</dt><dd>{dateTime(user.closedAt)}</dd></>}
          </dl>
        </div>
        <form action={updateUser} className="card space-y-3">
          <h3 className="text-lg">Account</h3>
          <input type="hidden" name="userId" value={user.id} />
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Role</label><select name="role" defaultValue={user.role} className="input"><option>USER</option><option>ADMIN</option></select></div>
            <div><label className="label">Status</label><select name="status" defaultValue={user.status} className="input"><option>ACTIVE</option><option>SUSPENDED</option><option>CLOSED</option></select></div>
          </div>
          <div><label className="label">Tags (comma separated)</label><input name="tags" defaultValue={user.tags.join(", ")} className="input" placeholder="vip, uk, referral" /></div>
          <button className="btn-gold">Save</button>
        </form>
        <div className="card space-y-3">
          <h3 className="text-lg">Access & security</h3>
          <ResetLinkForm userId={user.id} />
          <form action={signOutUser}>
            <input type="hidden" name="userId" value={user.id} />
            <button className="btn-ghost w-full">Sign out of all devices</button>
          </form>
        </div>
        <form action={grantPlan} className="card space-y-3">
          <h3 className="text-lg">Grant access</h3>
          <input type="hidden" name="userId" value={user.id} />
          <div className="grid grid-cols-2 gap-3">
            <select name="planId" className="input">{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <input name="days" type="number" defaultValue={30} min={1} max={366} className="input" />
          </div>
          <button className="btn-ghost">Grant days</button>
        </form>
      </div>
      <div className="space-y-4">
        <div className="card">
          <h3 className="mb-3 text-lg">CRM notes</h3>
          <form action={addNote} className="space-y-2">
            <input type="hidden" name="userId" value={user.id} />
            <textarea name="body" rows={3} className="input" placeholder="Called, interested in Inner Circle…" />
            <button className="btn-gold">Add note</button>
          </form>
          <ul className="mt-4 space-y-3">
            {user.notes.map((n) => (
              <li key={n.id} className="rounded-xl bg-white/5 p-3 text-sm">
                <p className="whitespace-pre-wrap">{n.body}</p>
                <p className="muted mt-1 text-xs">{n.author.email} · {dateTime(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="card overflow-x-auto">
          <h3 className="mb-3 text-lg">Subscriptions</h3>
          <table className="table">
            <thead><tr><th>Plan</th><th>Ends</th><th>Source</th><th>Status</th><th /></tr></thead>
            <tbody>
              {user.subscriptions.map((s) => {
                const live = s.status === "ACTIVE" && s.endsAt > now;
                return (
                  <tr key={s.id}>
                    <td>{s.plan.name}</td><td>{date(s.endsAt)}</td><td>{s.source}</td><td>{live ? "Active" : s.status === "CANCELLED" ? "Cancelled" : "Expired"}</td>
                    <td>{live && <form action={cancelSubscription}><input type="hidden" name="id" value={s.id} /><button className="text-xs text-red-300 hover:underline">Cancel</button></form>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card overflow-x-auto">
          <h3 className="mb-3 text-lg">Payments</h3>
          <table className="table">
            <thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Coin</th><th>Status</th></tr></thead>
            <tbody>{user.payments.map((p) => <tr key={p.id}><td>{date(p.createdAt)}</td><td>{p.planName ?? "Wallet top-up"}</td><td>{usd(p.amountCents)}</td><td>{p.currency} · {p.network}</td><td><Link href={`/admin/payments/${p.id}`} className="text-gold-300 underline">{p.status}</Link></td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
import Link from "next/link";
