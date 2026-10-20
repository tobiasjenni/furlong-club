import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTimeUtc as dateTime, usd } from "@/lib/format";
import { lockRemaining, tradingRequestsEnabled, tradingStatus } from "@/lib/trading";
import { ManageTradingForm } from "@/components/TradingForms";
import { transactionUrl } from "@/lib/manual-deposits";
import { AutoRefresh } from "@/app/checkout/pay/[id]/AutoRefresh";

export default async function AdminTradingRecord({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const [a, program] = await Promise.all([
    db.tradingAllocation.findUnique({ where: { id: (await params).id }, include: { user: { select: { email: true, name: true, balanceCents: true, walletFrozen: true, status: true } }, events: { orderBy: { createdAt: "asc" } }, journal: { orderBy: { createdAt: "asc" } } } }),
    db.tradingProgram.findUnique({ where: { id: "harry" } }),
  ]);
  if (!a) notFound();
  const now = new Date();
  const explorer = transactionUrl(a.network, a.payoutTxHash);
  const actorIds = [...new Set(a.events.map(e => e.actorId))];
  const actors = await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } });
  const actor = new Map(actors.map(u => [u.id, u.email]));
  return <div className="space-y-6"><AutoRefresh seconds={30} />
    <Link href="/admin/trading" className="text-sm text-gold-300 underline">← All allocations</Link>
    <section className="card space-y-4"><div><h2 className="text-3xl">{usd(a.principalCents)} trading allocation</h2><p className="mt-2 text-gold-300">{tradingStatus(a, now)} · {lockRemaining(a.unlocksAt, now)}</p></div>
      <p className="text-sm"><Link href={`/admin/users/${a.userId}`} className="text-gold-300 underline">{a.user.name ?? a.user.email}</Link> · {a.user.email} · {a.user.status}{a.user.walletFrozen && " · WALLET FROZEN"}</p>
      <dl className="grid gap-3 break-words text-sm sm:grid-cols-2">
        <div><dt className="muted">Reference</dt><dd>{a.id}</dd></div><div><dt className="muted">Available member credit</dt><dd>{usd(a.user.balanceCents)}</dd></div>
        <div><dt className="muted">Requested</dt><dd>{dateTime(a.requestedAt)} UTC</dd></div><div><dt className="muted">Terms accepted</dt><dd>{a.termsVersion}</dd></div>
        <div><dt className="muted">Approved / lock starts</dt><dd>{dateTime(a.approvedAt)} UTC · {a.approvedById ? actor.get(a.approvedById) ?? a.approvedById : "—"}</dd></div><div><dt className="muted">33-day lock ends</dt><dd>{dateTime(a.unlocksAt)} UTC</dd></div>
        <div><dt className="muted">Payout token / network</dt><dd>{a.currency} · {a.network}</dd></div><div><dt className="muted">Saved external receiving wallet</dt><dd className="break-all font-mono text-xs">{a.payoutAddress}</dd></div>
        <div><dt className="muted">Actual net profit / loss</dt><dd>{a.profitCents === null ? "Not recorded" : usd(a.profitCents)}</dd></div><div><dt className="muted">External payout due / recorded</dt><dd>{a.payoutCents === null ? "Not determined" : `${(a.payoutCents / 100).toFixed(2)} ${a.currency}`}</dd></div>
        <div><dt className="muted">Result recorded</dt><dd>{dateTime(a.resultAt)} UTC · {a.resultById ? actor.get(a.resultById) ?? a.resultById : "—"}</dd></div><div><dt className="muted">Payout completed / recorded</dt><dd>{dateTime(a.paidAt)} UTC · {a.paidById ? actor.get(a.paidById) ?? a.paidById : "—"}</dd></div>
      </dl>
      {a.reviewNote && <p className="text-sm">Approval / decline note: {a.reviewNote}</p>}{a.resultNote && <p className="text-sm">Result note: {a.resultNote}</p>}{a.payoutNote && <p className="text-sm">Payout note: {a.payoutNote}</p>}
      {explorer && <a href={explorer} target="_blank" rel="noreferrer" className="block break-all text-xs text-gold-300 underline">Inspect outgoing transaction: {a.payoutTxHash}</a>}
      <ManageTradingForm key={`${a.id}:${a.status}`} id={a.id} status={a.status} mature={Boolean(a.unlocksAt && a.unlocksAt <= now)} enrollmentOpen={tradingRequestsEnabled && Boolean(program?.enrollmentEnabled)} principal={(a.principalCents / 100).toFixed(2)} payout={a.payoutCents === null ? null : (a.payoutCents / 100).toFixed(2)} token={a.currency} network={a.network} address={a.payoutAddress} />
    </section>
    <section className="card space-y-3"><h3 className="text-xl">Immutable event history</h3>{a.events.map(e => <div className="border-t border-white/10 pt-3" key={e.id}><p className="text-sm">{dateTime(e.createdAt)} UTC · {e.action} · {actor.get(e.actorId) ?? e.actorId}</p><pre className="muted mt-2 whitespace-pre-wrap break-all text-xs">{JSON.stringify(e.payload, null, 2)}</pre></div>)}</section>
    <section className="card overflow-x-auto"><h3 className="mb-3 text-xl">Balanced postings · USD cents</h3><table className="table"><thead><tr><th>Operation</th><th>Available</th><th>Locked</th><th>Clearing</th><th>Member result offset</th><th>Sales</th></tr></thead><tbody>{a.journal.map(j => <tr key={j.id}><td>{j.kind}</td><td>{j.userDeltaCents}</td><td>{j.lockedDeltaCents}</td><td>{j.clearingDeltaCents}</td><td>{j.tradingResultDeltaCents}</td><td>{j.revenueDeltaCents}</td></tr>)}</tbody></table><p className="muted mt-3 text-xs">Every row sums to zero. Positive member profit has a negative result offset. Trading results never enter membership sales.</p></section>
    <details className="card"><summary className="cursor-pointer text-lg">Accepted terms snapshot</summary><pre className="muted mt-4 whitespace-pre-wrap break-all text-xs">{JSON.stringify(a.termsSnapshot, null, 2)}</pre></details>
  </div>;
}
