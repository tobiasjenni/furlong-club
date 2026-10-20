import { TradingSummary } from "@/components/TradingSummary";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { checkoutOptions, walletEnabled } from "@/lib/config";
import { db } from "@/lib/db";
import { dateTime, usd } from "@/lib/format";
import { depositsReady, manualDepositLabel, manualDepositsEnabled } from "@/lib/manual-deposits";
import { TopupForm } from "./TopupForm";
import { AutoRefresh } from "@/app/checkout/pay/[id]/AutoRefresh";

export const metadata = { title: "Wallet" };

export default async function WalletPage() {
  const user = await requireUser();
  const [entries, payments] = await Promise.all([
    db.walletJournal.findMany({ where: { userId: user.id, userDeltaCents: { not: 0 } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 }),
    db.payment.findMany({ where: { userId: user.id, purpose: "WALLET_TOPUP" }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const options = checkoutOptions.map((o, value) => ({ label: o.label, currency: o.currency, value, enabled: depositsReady(o) }));
  const ready = walletEnabled && options.some(o => o.enabled);
  const pending = payments.filter(p => p.status !== "CONFIRMED" && p.status !== "FAILED" && p.status !== "EXPIRED");
  const pendingCents = pending.reduce((sum, p) => sum + p.amountCents, 0);
  return <div className="container-page max-w-5xl space-y-6 py-10">
    {pending.length > 0 && <AutoRefresh seconds={15} />}
    <div><p className="muted text-sm">Your membership funds</p><h1 className="text-3xl md:text-4xl">Wallet</h1></div>
    {user.walletFrozen && <p role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-red-200">Your wallet is under review. Payments from your balance are paused. Please contact support.</p>}
    <div className="grid gap-6 md:grid-cols-2">
      <section className="card silk-stripes flex flex-col justify-between">
        <div><p className="muted text-sm">Available balance · USD credit</p><p className="mt-2 font-display text-5xl">{usd(user.balanceCents)}</p>
          <p className="muted mt-4 text-sm">Pending top-ups: {usd(pendingCents)}. Pending funds cannot be spent.</p></div>
        <div className="mt-8"><Link href="/plans" className="btn-gold">Use balance for membership</Link>
          <p className="muted mt-4 text-xs">Your balance is Furlong Club credit in USD. It is not a USDT or USDC token balance. General withdrawals and transfers to other members are not supported. Approved trading allocations have a separate lock and external payout record.</p></div>
      </section>
      <section className="card space-y-4"><h2 className="text-2xl">Add funds</h2>
        {!ready && <p role="status" className="rounded-xl bg-gold-400/10 p-3 text-sm text-gold-300">Deposits are currently unavailable. Please check back soon.</p>}
        {!user.emailVerifiedAt && <p className="text-sm text-gold-300">Confirm your email from your dashboard before adding funds.</p>}
        <TopupForm options={options} manual={manualDepositsEnabled} disabled={!ready || user.walletFrozen || !user.emailVerifiedAt} />
      </section>
    </div>
    <TradingSummary userId={user.id} />
    <section className="card"><h2 className="text-xl">How deposits work</h2>
      <ol className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
        <li><span className="text-gold-300">1. Choose and send</span><p className="muted mt-1">Choose your token, network and amount. Send the exact amount to the address shown.</p></li>
        <li><span className="text-gold-300">{manualDepositsEnabled ? "2. Tell us you sent it" : "2. Payment completes"}</span><p className="muted mt-1">{manualDepositsEnabled ? "Enter your transaction ID and confirm that you have sent the transfer. The admin is notified." : "The provider confirms your payment and transfers it to the club's receiving wallet."}</p></li>
        <li><span className="text-gold-300">3. Credit arrives</span><p className="muted mt-1">{manualDepositsEnabled ? "An admin verifies the receipt and approves it. Your USD credit then becomes available." : "Your USD credit becomes available and a receipt appears below."}</p></li>
      </ol>
    </section>
    <section className="card overflow-x-auto"><h2 className="mb-4 text-xl">Deposit payments</h2>
      {payments.length === 0 ? <p className="muted text-sm">No deposits yet. Start by adding funds above.</p> : <table className="table">
        <thead><tr><th>Date</th><th>Credit</th><th>Pay with</th><th>Progress</th><th>Receipt</th></tr></thead>
        <tbody>{payments.map(p => <tr key={p.id}><td>{dateTime(p.createdAt)}</td><td>{usd(p.amountCents)}</td><td>{p.currency} · {p.network}</td>
          <td>{p.provider === "manual" ? manualDepositLabel(p.status, p.providerStatus) : p.reviewReason ? "Needs review" : p.status === "CONFIRMED" ? "Credited" : p.settlementStatus === "TRANSFERRING" ? "Transferring to club wallet" : p.status.toLowerCase()}</td>
          <td><Link href={`/checkout/pay/${p.id}`} className="text-gold-300 underline">View payment</Link></td></tr>)}</tbody>
      </table>}
    </section>
    <section className="card overflow-x-auto"><h2 className="mb-4 text-xl">Balance activity</h2>
      {entries.length === 0 ? <p className="muted text-sm">Your deposits and membership purchases will appear here.</p> : <table className="table">
        <thead><tr><th>Date</th><th>Activity</th><th>USD credit</th><th>Reference</th></tr></thead>
        <tbody>{entries.map(e => <tr key={e.id}><td>{dateTime(e.createdAt)}</td><td>{e.description}</td>
          <td className={e.userDeltaCents > 0 ? "text-emerald-300" : "text-cream"}>{e.userDeltaCents > 0 ? "+" : ""}{usd(e.userDeltaCents)}</td>
          <td className="max-w-48 break-all text-xs">{e.paymentId ? <Link href={`/checkout/pay/${e.paymentId}`} className="text-gold-300 underline">{e.paymentId}</Link> : e.id}</td></tr>)}</tbody>
      </table>}
      <p className="muted mt-3 text-xs">Showing your latest 50 balance entries and 20 deposit payments. All records are retained.</p>
    </section>
  </div>;
}
