import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, usd } from "@/lib/format";
import { checkoutOptions, walletEnabled } from "@/lib/config";
import { paymentsReady, poolAddress } from "@/lib/payments";
import { depositAddress, depositsReady, manualDepositsEnabled } from "@/lib/manual-deposits";

export default async function AdminWallet() {
  await requireAdmin();
  const [totals, drift, pools, review, entries] = await Promise.all([
    db.walletJournal.aggregate({ _sum: { userDeltaCents: true, revenueDeltaCents: true, lockedDeltaCents: true, tradingResultDeltaCents: true } }),
    db.$queryRaw<{ id: string; email: string; balanceCents: number; ledgerCents: bigint }[]>`
      SELECT u.id,u.email,u."balanceCents",COALESCE(SUM(j."userDeltaCents"),0)::bigint AS "ledgerCents"
      FROM "User" u LEFT JOIN "WalletJournal" j ON j."userId"=u.id
      GROUP BY u.id HAVING u."balanceCents" <> COALESCE(SUM(j."userDeltaCents"),0)`,
    db.payment.groupBy({ by: ["currency", "network", "provider"], where: { provider: { in: ["nowpayments", "manual"] }, settlementStatus: "SETTLED" },
      _sum: { receivedAmount: true, outcomeAmount: true }, _count: true }),
    db.payment.findMany({ where: { reviewReason: { not: null } }, orderBy: { updatedAt: "desc" }, take: 100, include: { user: true } }),
    db.walletJournal.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100, include: { user: true } }),
  ]);
  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="card"><p className="muted text-sm">Outstanding member credit</p><p className="mt-2 text-3xl">{usd(totals._sum.userDeltaCents ?? 0)}</p></div>
      <div className="card"><p className="muted text-sm">Membership sales (ledger)</p><p className="mt-2 text-3xl">{usd(totals._sum.revenueDeltaCents ?? 0)}</p></div>
      <div className="card"><p className="muted text-sm">Balance reconciliation</p><p className={`mt-2 text-2xl ${drift.length ? "text-red-300" : "text-emerald-300"}`}>{drift.length ? `${drift.length} mismatches` : "All member balances match"}</p></div>
    </div>
    <section className="card"><h2 className="text-xl">Trading funds · separate from membership credit</h2><p className="mt-3 text-sm">Locked / unpaid principal: <strong>{usd(totals._sum.lockedDeltaCents ?? 0)}</strong> · Completed net member trading result: {usd(-(totals._sum.tradingResultDeltaCents ?? 0))}</p><Link href="/admin/trading" className="mt-3 inline-block text-sm text-gold-300 underline">Review all allocations, maturity dates, payouts and locked-principal reconciliation →</Link></section>
    <section className="card"><h2 className="text-xl">Receiving wallet setup</h2>
      <p className="muted mt-2 text-sm">Wallet payments are {walletEnabled ? "enabled" : "disabled"}. Configure a receiving address for each enabled token/network. No private keys belong in this app.</p>
      <ul className="mt-4 space-y-3 text-sm">{checkoutOptions.map(o => {
        let address: string | null; try { address = manualDepositsEnabled ? depositAddress(o) : poolAddress(o); } catch { address = "Invalid address configuration"; }
        return <li key={o.label}><strong>{o.label}</strong> · {manualDepositsEnabled ? depositsReady(o) ? "Manual approval ready" : "Receiving address needed" : paymentsReady(o) ? "Payment provider ready" : "Setup needed"}<code className="muted mt-1 block break-all text-xs">{address ?? `Set POOL_WALLET_${o.currency}_${o.network}`}</code></li>;
      })}</ul>
    </section>
    <section className="card overflow-x-auto"><h2 className="mb-3 text-xl">Recorded crypto receipts</h2>
      <p className="muted mb-4 text-sm">Manual deposits arrive directly in the club wallet and are recorded after an admin verifies them. Automated receipts use provider settlement reports. These totals are historical receipts, not the current on-chain wallet balance. Compare the transactions and receiving wallet independently.</p>
      <table className="table"><thead><tr><th>Token / network</th><th>Source</th><th>Payments</th><th>Received</th><th>Received by club</th><th>Difference</th></tr></thead>
        <tbody>{pools.map(p => <tr key={`${p.provider}:${p.currency}:${p.network}`}><td>{p.currency} · {p.network}</td><td>{p.provider === "manual" ? "Admin verified" : "Provider reported"}</td><td>{p._count}</td><td>{p._sum.receivedAmount?.toFixed() ?? "—"}</td><td>{p._sum.outcomeAmount?.toFixed() ?? "—"}</td><td>{p._sum.receivedAmount && p._sum.outcomeAmount ? p._sum.receivedAmount.minus(p._sum.outcomeAmount).toFixed() : "—"}</td></tr>)}</tbody></table>
    </section>
    {drift.length > 0 && <section className="card"><h2 className="text-xl text-red-300">Balance mismatches</h2>{drift.map(d => <p key={d.id} className="mt-3 text-sm">{d.email}: displayed {usd(d.balanceCents)}, ledger {usd(Number(d.ledgerCents))}</p>)}</section>}
    <section className="card overflow-x-auto"><h2 className="mb-4 text-xl">Payments needing review</h2>
      {review.length === 0 ? <p className="muted text-sm">No flagged payments.</p> : <table className="table"><thead><tr><th>User</th><th>Reason</th><th>Reference</th></tr></thead><tbody>{review.map(p => <tr key={p.id}><td>{p.user.email}</td><td>{p.reviewReason}</td><td><Link className="text-gold-300 underline" href={`/admin/payments/${p.id}`}>{p.id}</Link></td></tr>)}</tbody></table>}
    </section>
    <section className="card overflow-x-auto"><h2 className="mb-4 text-xl">Latest 100 journal entries · USD cents</h2>
      <table className="table"><thead><tr><th>Date / reference</th><th>User</th><th>Operation</th><th>Member credit</th><th>Locked</th><th>Clearing</th><th>Trading result offset</th><th>Sales</th></tr></thead>
        <tbody>{entries.map(e => <tr key={e.id}><td>{dateTime(e.createdAt)}<span className="muted block max-w-48 break-all text-xs">{e.paymentId ? <Link className="text-gold-300 underline" href={`/admin/payments/${e.paymentId}`}>{e.id}</Link> : e.allocationId ? <Link className="text-gold-300 underline" href={`/admin/trading/${e.allocationId}`}>{e.id}</Link> : e.id}</span></td><td>{e.user.email}</td><td>{e.kind}<br />{e.description}</td><td>{e.userDeltaCents}</td><td>{e.lockedDeltaCents}</td><td>{e.clearingDeltaCents}</td><td>{e.tradingResultDeltaCents}</td><td>{e.revenueDeltaCents}</td></tr>)}</tbody>
      </table><p className="muted mt-3 text-xs">Each row sums to zero across all five accounts. Trading locks and actual results are separate from membership sales. Historical pre-ledger payments are marked LEGACY and are not reconstructed here.</p>
    </section>
  </div>;
}
