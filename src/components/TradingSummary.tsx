import Link from "next/link";
import { db } from "@/lib/db";
import { dateTimeUtc as dateTime, usd } from "@/lib/format";
import { lockRemaining, tradingStatus } from "@/lib/trading";
import { CancelTradingForm } from "./TradingForms";

export async function TradingSummary({ userId, admin = false }: { userId: string; admin?: boolean }) {
  const allocations = await db.tradingAllocation.findMany({ where: { userId, status: { in: ["PENDING", "ACTIVE", "PAYOUT_READY"] } }, orderBy: { requestedAt: "desc" } });
  const locked = allocations.filter(a => a.status !== "PENDING").reduce((sum, a) => sum + a.principalCents, 0);
  const pending = allocations.filter(a => a.status === "PENDING").reduce((sum, a) => sum + a.principalCents, 0);
  const now = new Date();
  return <section className="card space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl">Trading with Rob</h2><p className="muted mt-1 text-sm">Locked / awaiting external payout: <strong className="text-cream">{usd(locked)}</strong> · Awaiting approval: {usd(pending)}</p></div><Link href={admin ? `/admin/trading?userId=${encodeURIComponent(userId)}` : "/trading"} className="text-sm text-gold-300 underline">{admin ? "All trading records" : "Details & history"}</Link></div>
    {allocations.length === 0 && <p className="muted text-sm">No open trading allocations. The proposed service has a $500–$10,000 allocation range and a 28-day trading period from its scheduled moon-calendar entry. Approval reserves capital before that start.</p>}
    {allocations.map(a => <article key={a.id} id={`allocation-${a.id}`} className="space-y-2 rounded-xl border border-white/10 p-4">
      <div className="flex flex-wrap justify-between gap-2"><strong>{usd(a.principalCents)} · {a.currency} · {a.network}</strong><span className="badge bg-gold-400/10 text-gold-300">{tradingStatus(a, now)}</span></div>
      <p className="text-sm">{a.status === "PENDING" ? "Funds remain available until approval." : lockRemaining(a.unlocksAt, now, a.startsAt)}</p>
      <p className="muted text-xs">Approved: {dateTime(a.approvedAt)}<br />Entry: {dateTime(a.startsAt ?? a.approvedAt)} · Saved maturity: {dateTime(a.unlocksAt)} (UTC)</p>
      <p className="muted break-all text-xs">Payout destination: {a.payoutAddress}</p>
      {a.payoutCents !== null && <p className="text-sm">Recorded net profit / loss: {usd(a.profitCents ?? 0)} · Payout due: {(a.payoutCents / 100).toFixed(2)} {a.currency}</p>}
      {admin ? <Link className="inline-block text-sm text-gold-300 underline" href={`/admin/trading/${a.id}`}>Open full record & controls</Link> : a.status === "PENDING" && <CancelTradingForm id={a.id} />}
    </article>)}
    <p className="muted text-xs">The lock ending does not mean payment has been sent. Funds remain recorded here until an admin records the external payout or a verified total loss.</p>
  </section>;
}
