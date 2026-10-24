import Link from "next/link";
import type { MemberFunding as Funding } from "@/lib/admin-query";
import { usd } from "@/lib/format";

export function FundingStatus({ funding: f }: { funding: Funding }) {
  return <div className="flex flex-wrap gap-2 text-xs">
    {(f.depositedCents > 0 || f.adjustmentCents > 0) && <span className="badge bg-emerald-500/15 text-emerald-300">Funding credited</span>}
    {f.walletFrozen && <span className="badge bg-red-500/15 text-red-300">Wallet frozen</span>}
    {f.reportedCents > 0 && <span className="badge bg-amber-500/15 text-amber-200">Deposit needs review</span>}
    {f.pendingTradeCents > 0 && <span className="badge bg-amber-500/15 text-amber-200">Trading needs approval</span>}
    {f.availableCents > 0 && <span className="badge bg-sky-500/15 text-sky-200">Credit available</span>}
    {f.committedCents > 0 && <span className="badge bg-emerald-500/15 text-emerald-300">Committed to Rob</span>}
    {f.payoutCents > 0 && <span className="badge bg-gold-400/15 text-gold-300">Payout due</span>}
    {f.depositedCents === 0 && f.adjustmentCents <= 0 && <span className="muted">No approved funding</span>}
  </div>;
}

export function MemberFundingSummary({ funding: f, userId }: { funding: Funding; userId: string }) {
  const metrics = [
    ['Approved deposits', f.depositedCents], ['Net credit corrections', f.adjustmentCents], ['Available credit', f.availableCents],
    ['Committed to Rob', f.committedCents], ['Deposit review', f.reportedCents], ['Trading requests', f.pendingTradeCents],
  ] as const;
  return <section className="card space-y-4" id="funding"><h2 className="text-xl">Funding at a glance</h2><FundingStatus funding={f} />
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">{metrics.map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3"><dt className="muted text-xs">{label}</dt><dd className="mt-1 font-semibold text-gold-300">{usd(Number(value))}</dd></div>)}</dl>
    <p className="muted text-sm">Committed includes {usd(Number(f.scheduledCents))} reserved for an upcoming entry. Recorded payout due: {usd(Number(f.payoutCents))}. Pending requests do not reserve credit.</p>
    <div className="flex flex-wrap gap-2"><Link href={`/admin/users/${userId}#deposit-approvals`} className="btn-ghost">Review deposits</Link><Link href={`/admin/trading?userId=${encodeURIComponent(userId)}`} className="btn-ghost">Trading records →</Link></div>
  </section>;
}
