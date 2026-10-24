import { SubmitButton } from "@/components/SubmitButton";
import { ClubResultsCalendar } from "@/components/v2/ClubResultsCalendar";
import { TradingSummary } from "@/components/TradingSummary";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import { addNote, cancelSubscription, confirmEmail, grantPlan, signOutUser } from "@/app/actions/admin";
import { canManageUser, roleLabel } from "@/lib/roles";
import { ResetLinkForm, RoleForm, ProfileForm, DeleteAccountForm, PermanentDeleteForm, CreditAdjustmentForm } from "../AdminForms";
import crypto from "node:crypto";
import { memberFundingQuery, type MemberFunding } from "@/lib/admin-query";
import { MemberFundingSummary } from "@/components/admin/MemberFunding";
import { db } from "@/lib/db";
import { date, dateTime, usd } from "@/lib/format";
import { ReviewDepositForm } from "@/components/ManualDepositForms";
import { transactionUrl } from "@/lib/manual-deposits";

export default async function AdminUser({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tradingOpen?: string; management?: string }> }) {
  const admin = await requireAdmin();
  const user = await db.user.findUnique({
    where: { id: (await params).id },
    include: {
      subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } },
      payments: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 20 },
      notes: { include: { author: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!user) notFound();
  const pendingDeposits = await db.payment.findMany({ where: { userId: user.id, provider: "manual", status: "CONFIRMING" }, orderBy: { submittedAt: "asc" }, take: 50 });
  const plans = await db.plan.findMany({ where: { priceCents: { gt: 0 } }, orderBy: { sortOrder: "asc" } });
  const history = await db.auditLog.findMany({ where: { target: user.id }, orderBy: { createdAt: "desc" }, take: 20 });
  const funding = (await db.$queryRaw<{ data: MemberFunding }[]>(memberFundingQuery(user.id)))[0].data;
  const receipts = await db.payment.findMany({ where: { userId: user.id, purpose: 'WALLET_TOPUP', status: 'CONFIRMED' }, orderBy: { confirmedAt: 'desc' }, take: 100, select: { id: true, amountCents: true, currency: true, confirmedAt: true } });
  const now = new Date();
  const manageable = canManageUser(admin,user);
  const superAdmin = admin.role === "SUPER_ADMIN";
  const management = (await searchParams).management;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="min-w-0 space-y-4">
        <MemberFundingSummary funding={funding} userId={user.id} />
        {manageable && superAdmin && <CreditAdjustmentForm key={user.updatedAt.toISOString()} userId={user.id} balanceCents={user.balanceCents} expectedUpdatedAt={user.updatedAt.toISOString()} operationId={crypto.randomUUID()} receipts={receipts.map(p => ({ id: p.id, label: `${date(p.confirmedAt)} · ${usd(p.amountCents)} ${p.currency} · ${p.id}` }))} />}
        <div className="card">
          <h2 className="text-xl">{user.name ?? "—"}</h2>
          <p className="muted break-all text-sm">{user.email}</p>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <dt className="muted">Email confirmed</dt>
            <dd>
              {user.emailVerifiedAt ? date(user.emailVerifiedAt) : manageable && superAdmin ? (
                <form action={confirmEmail}><input type="hidden" name="userId" value={user.id} /><label className="label">Ownership verification note<input name="reason" minLength={10} maxLength={500} required className="input" placeholder="How you verified this email belongs to the member" /></label><SubmitButton className="btn-gold workspace-action-positive" pendingLabel="Confirming ownership…">Confirm verified ownership</SubmitButton></form>
              ) : "Not yet"}
            </dd>
            <dt className="muted">Role</dt><dd>{roleLabel(user.role)}</dd>
            <dt className="muted">Account status</dt><dd>{user.status === 'CLOSED' ? 'Closed' : user.status === 'SUSPENDED' ? 'Suspended' : 'Active'}</dd>
            <dt className="muted">Country</dt><dd>{user.country ?? "—"}</dd>
            <dt className="muted">Joined</dt><dd>{dateTime(user.createdAt)}</dd>
            <dt className="muted">Last login</dt><dd>{dateTime(user.lastLoginAt)}</dd>
            <dt className="muted">18+ confirmed</dt><dd>{date(user.ageConfirmedAt)}</dd>
            <dt className="muted">Marketing</dt><dd>{user.marketingOptIn ? "Opted in" : "No"}</dd>
            <dt className="muted">Balance</dt><dd>{usd(user.balanceCents)}</dd>
            {user.closedAt && <><dt className="muted">Account closed</dt><dd>{dateTime(user.closedAt)}</dd></>}
          </dl>
        </div>
        {management && <p role="status" className="card text-sm">{management === 'saved' ? 'Account updated and recorded in the audit history.' : management === 'wallet_unresolved' ? 'Resolve the balance, pending deposits and open trading allocations before closing this account.' : 'This action is unavailable. Check your permissions and the account status.'}</p>}
        {!manageable && <div className="card"><h3 className="text-lg">Protected account</h3><p className="muted mt-2 text-sm">{user.role === 'SUPER_ADMIN' ? 'The Super Admin owner account cannot be demoted, suspended or closed here.' : 'Your role does not allow changes to this account.'} Use your own profile for personal password and session settings.</p></div>}
        {manageable && <ProfileForm key={user.id} user={{ id: user.id, name: user.name, country: user.country, tags: user.tags, status: user.status, updatedAt: user.updatedAt.toISOString() }} />}
        {manageable && <DeleteAccountForm key={user.status} userId={user.id} email={user.email} closed={user.status === 'CLOSED'} />}
        {manageable && <PermanentDeleteForm key={user.id} userId={user.id} email={user.email} />}
        {manageable && superAdmin && <RoleForm userId={user.id} role={user.role} />}
        {manageable && <div className="card space-y-3">
          <h3 className="text-lg">Access & security</h3>
          {superAdmin && <ResetLinkForm userId={user.id} />}
          <form action={signOutUser}>
            <input type="hidden" name="userId" value={user.id} />
            <SubmitButton className="btn-ghost w-full" pendingLabel="Signing out devices…">Sign out of all devices</SubmitButton>
          </form>
        </div>}
        {manageable && <form action={grantPlan} className="card space-y-3">
          <h3 className="text-lg">Grant access</h3>
          <input type="hidden" name="userId" value={user.id} />
          <div className="grid grid-cols-2 gap-3">
            <select aria-label="Plan to grant" name="planId" className="input">{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <input aria-label="Days of access to grant" name="days" type="number" defaultValue={33} min={1} max={366} className="input" />
          </div>
          <SubmitButton className="btn-ghost" pendingLabel="Granting access…">Grant days</SubmitButton>
        </form>}
      </div>
      <div className="min-w-0 space-y-4">
        <TradingSummary userId={user.id} admin />
        <ClubResultsCalendar />
        <div className="card" id="deposit-approvals">
          <h3 className="mb-3 text-lg">Crypto deposit approvals</h3>
          {pendingDeposits.length === 0 && <p className="muted text-sm">No reported deposits awaiting approval for this member.</p>}
          {pendingDeposits.map(payment => {
            const explorer = transactionUrl(payment.network, payment.submittedTxHash);
            return <div key={payment.id} className="space-y-4 border-t border-white/10 py-4">
              <div><p className="font-semibold text-gold-300">{(payment.amountCents / 100).toFixed(2)} {payment.currency} · {payment.network} · {usd(payment.amountCents)} credit</p>
                <p className="muted mt-1 text-xs">Reported {dateTime(payment.submittedAt)}</p>
                <p className="mt-2 break-all text-xs">Receiving address: <code>{payment.poolAddress}</code></p>
                {explorer && <a href={explorer} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-gold-300 underline">Inspect reported transaction ↗</a>}</div>
              {superAdmin ? <ReviewDepositForm id={payment.id} submittedHash={payment.submittedTxHash} amount={(payment.amountCents / 100).toFixed(2)} token={payment.currency} network={payment.network} /> : <p className="muted text-sm">Awaiting Super Admin review.</p>}
            </div>;
          })}
        </div>
        <div className="card">
          <h3 className="mb-3 text-lg">CRM notes</h3>
          {manageable && <form action={addNote} className="space-y-2">
            <input type="hidden" name="userId" value={user.id} />
            <textarea aria-label="New CRM note" name="body" rows={3} className="input" placeholder="Called, interested in Trading with Rob…" />
            <SubmitButton className="btn-gold" pendingLabel="Saving note…">Add note</SubmitButton>
          </form>}
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
                    <td>{live && manageable && <form action={cancelSubscription}><input type="hidden" name="id" value={s.id} /><SubmitButton className="btn-danger" pendingLabel="Cancelling access…">Cancel</SubmitButton></form>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3 className="text-lg">Recent account history</h3>
          <p className="muted mt-2 text-sm">The latest 20 recorded events. <Link href="/admin/audit" className="text-gold-300 underline">Open the full audit log</Link></p>
          <ul className="mt-3 space-y-3">{history.map(event => <li key={event.id} className="rounded-xl bg-white/5 p-3 text-sm"><p className="break-all">{event.action}</p><p className="muted mt-1 text-xs">{dateTime(event.createdAt)}</p>{event.meta && <p className="muted mt-1 break-all text-xs">{JSON.stringify(event.meta)}</p>}</li>)}</ul>
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
