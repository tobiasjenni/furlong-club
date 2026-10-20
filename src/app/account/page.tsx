import { TradingSummary } from "@/components/TradingSummary";
import { manualDepositLabel } from "@/lib/manual-deposits";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { date, usd } from "@/lib/format";
import { EmailForm, PasswordForm, ProfileForm } from "./AccountForms";
import { DangerZone } from "./DangerZone";

export const metadata = { title: "Account" };

const statusColor: Record<string, string> = {
  CONFIRMED: "bg-emerald-500/15 text-emerald-300",
  PENDING: "bg-gold-400/15 text-gold-300",
  CONFIRMING: "bg-gold-400/15 text-gold-300",
};

export default async function AccountPage() {
  const user = await requireUser();
  const [subs, payments] = await Promise.all([
    db.subscription.findMany({ where: { userId: user.id }, include: { plan: true }, orderBy: { createdAt: "desc" } }),
    db.payment.findMany({ where: { userId: user.id }, include: { plan: true }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return (
    <div className="container-page space-y-6 py-10">
      <h1 className="text-3xl md:text-4xl">Account</h1>
      <TradingSummary userId={user.id} />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card"><h2 className="mb-4 text-xl">Profile</h2><p className="muted mb-4 text-sm">{user.email} · {user.emailVerifiedAt ? "confirmed" : "not confirmed yet"}</p><ProfileForm name={user.name ?? ""} country={user.country ?? ""} marketing={user.marketingOptIn} /></div>
        <div className="card"><h2 className="mb-4 text-xl">Email</h2><EmailForm email={user.email} /></div>
        <div className="card"><h2 className="mb-4 text-xl">Password</h2><PasswordForm /></div>
      </div>
      <div className="card overflow-x-auto">
        <h2 className="mb-4 text-xl">Subscriptions</h2>
        {subs.length === 0 ? <p className="muted text-sm">No paid subscriptions yet.</p> : (
          <table className="table"><thead><tr><th>Plan</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
            <tbody>{subs.map((s) => <tr key={s.id}><td>{s.plan.name}</td><td>{date(s.startsAt)}</td><td>{date(s.endsAt)}</td><td>{s.endsAt < new Date() ? "EXPIRED" : s.status}</td></tr>)}</tbody></table>
        )}
      </div>
      <div className="card overflow-x-auto">
        <h2 className="mb-4 text-xl">Payments</h2>
        {payments.length === 0 ? <p className="muted text-sm">No payments yet.</p> : (
          <table className="table"><thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Coin</th><th>Status</th></tr></thead>
            <tbody>{payments.map((p) => <tr key={p.id}><td>{date(p.createdAt)}</td><td>{p.planName ?? "Wallet top-up"}</td><td>{usd(p.amountCents)}</td><td>{p.currency} · {p.network}</td><td><span className={`badge ${statusColor[p.status] ?? "bg-white/10 text-cream/70"}`}>{p.provider === "manual" ? manualDepositLabel(p.status, p.providerStatus) : p.status}</span></td></tr>)}</tbody></table>
        )}
      </div>
      <DangerZone />
    </div>
  );
}
