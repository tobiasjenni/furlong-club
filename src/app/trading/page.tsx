import crypto from "node:crypto";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTimeUtc as dateTime, usd } from "@/lib/format";
import { tradingOptions, tradingRequestsEnabled, tradingStatus, tradingTermsVersion } from "@/lib/trading";
import { TradingOffer } from "@/components/TradingOffer";
import { TradingSummary } from "@/components/TradingSummary";
import { RequestTradingForm } from "@/components/TradingForms";
import { transactionUrl } from "@/lib/manual-deposits";
import { AutoRefresh } from "@/app/checkout/pay/[id]/AutoRefresh";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const metadata = pageMetadata("/trading");
export const dynamic = "force-dynamic";

export default async function TradingPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await currentUser();
  const page = Math.max(1, Math.min(100000, Number.parseInt((await searchParams).page ?? "1", 10) || 1));
  const open = tradingRequestsEnabled && Boolean((await db.tradingProgram.findUnique({ where: { id: "harry" } }))?.enrollmentEnabled);
  const [history, count, hasPending] = user ? await Promise.all([
    db.tradingAllocation.findMany({ where: { userId: user.id }, orderBy: [{ requestedAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20 }),
    db.tradingAllocation.count({ where: { userId: user.id } }),
    db.tradingAllocation.count({ where: { userId: user.id, status: "PENDING" } }),
  ]) : [[], 0, 0];
  return <div className="container-page max-w-5xl space-y-6 py-10">
    <Breadcrumbs path="/trading" label="Trading with Harry" />
    <h1 className="text-3xl md:text-4xl">Trading with Harry</h1>
    <TradingOffer showLink={false} />
    <section className="card"><h2 className="text-2xl">How the proposed flow works</h2><ol className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
      <li><strong className="text-gold-300">1. Membership & allocation</strong><p className="muted mt-2">Form Room is the membership built around Trading with Harry; Inner Circle includes its planned access too. Once enrollment opens, fund a separate $500–$10,000 allocation through the deposit approval process and save your external receiving wallet. A request alone does not reserve funds.</p></li>
      <li><strong className="text-gold-300">2. Admin approval & lock</strong><p className="muted mt-2">Approval moves available credit into a separate allocation and starts exactly 33 days. Locked principal cannot pay for membership or be withdrawn early.</p></li>
      <li><strong className="text-gold-300">3. Actual result & manual payout</strong><p className="muted mt-2">After maturity, an admin records the actual profit or loss and manually sends any amount due to the saved wallet. The confirmed transaction is recorded in your history.</p></li>
    </ol><p className="muted mt-5 text-xs">Draft accounting uses one USDT or USDC token per $1 of club credit; this is not a market exchange quote. The operator pays outgoing network fees. Compounding, performance fees and final return terms are not defined. No trading execution, yield accrual or automatic blockchain payout is connected to this website.</p></section>
    {user ? <>
      <AutoRefresh seconds={30} /><TradingSummary userId={user.id} />
      <section className="card space-y-4"><h2 className="text-2xl">Request an allocation</h2><p className="text-sm">Available wallet credit: <strong>{usd(user.balanceCents)}</strong> · <Link href="/wallet" className="text-gold-300 underline">Open wallet</Link></p>
        {open ? hasPending ? <p className="muted text-sm">You already have a request awaiting approval. Cancel it above before changing its amount or destination.</p> : <><p className="text-sm text-gold-300">Simulated trading requests are open on this test site. Draft terms {tradingTermsVersion} apply.</p><RequestTradingForm requestKey={crypto.randomUUID()} termsVersion={tradingTermsVersion} options={tradingOptions} disabled={user.walletFrozen || !user.emailVerifiedAt} />{!user.emailVerifiedAt && <p className="muted text-sm">Confirm your email first.</p>}{user.walletFrozen && <p className="text-red-200 text-sm">Your wallet is under review.</p>}</> : <p role="status" className="text-sm text-gold-300">Real trading enrollment is closed while the terms are finalized. Do not send funds for a trading allocation yet.</p>}
      </section>
      <section className="card space-y-4"><h2 className="text-2xl">Your complete trading history</h2><p className="muted text-xs">{count} records · page {page}. All dates are UTC. Targets are never booked as earnings.</p>
        {history.length === 0 && <p className="muted text-sm">No trading requests yet.</p>}
        {history.map(a => { const explorer = transactionUrl(a.network, a.payoutTxHash); return <article className="space-y-2 border-t border-white/10 pt-4" key={a.id}>
          <p><strong>{usd(a.principalCents)}</strong> · {tradingStatus(a)} · {a.currency} / {a.network}</p>
          <p className="muted text-xs">Requested: {dateTime(a.requestedAt)} · Approved: {dateTime(a.approvedAt)} · Lock ends: {dateTime(a.unlocksAt)}</p>
          <p className="muted break-all text-xs">Destination: {a.payoutAddress} · Terms: {a.termsVersion} · Reference: {a.id}</p>
          {a.reviewNote && <p className="text-sm">Review: {a.reviewNote}</p>}{a.resultNote && <p className="text-sm">Result: {usd(a.profitCents ?? 0)} net profit / loss. {a.resultNote}</p>}
          {a.payoutCents !== null && <p className="text-sm">{a.status === "PAID" ? "Recorded payout" : "Payout due"}: {(a.payoutCents / 100).toFixed(2)} {a.currency}</p>}
          {a.paidAt && <p className="text-sm">Completed: {dateTime(a.paidAt)} · {a.payoutNote}</p>}
          {explorer && <a className="inline-block break-all text-xs text-gold-300 underline" href={explorer} target="_blank" rel="noreferrer">Payout transaction: {a.payoutTxHash}</a>}
        </article>; })}
        <div className="flex gap-3">{page > 1 && <Link className="btn-ghost" href={`?page=${page - 1}`}>Previous</Link>}{page * 20 < count && <Link className="btn-ghost" href={`?page=${page + 1}`}>Next</Link>}</div>
      </section>
    </> : <section className="card"><p className="muted mb-4 text-sm">Sign in to view your allocations, lock dates and payout history.</p><Link href="/login" className="btn-gold">Sign in</Link></section>}
  </div>;
}
