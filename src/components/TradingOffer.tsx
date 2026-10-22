import Link from "next/link";
import { tradingEnrollmentOpen } from "@/lib/trading-program";
import { proposedTradingTargets } from "@/lib/trading-marketing";

export async function TradingOffer({ showLink = true }: { showLink?: boolean }) {
  const open = await tradingEnrollmentOpen();
  return <section className="card space-y-5 border-gold-400/40 bg-gold-400/5">
    <div><p className="text-xs uppercase tracking-wider text-gold-300">The centrepiece of Form Room</p><h2 className="mt-2 text-3xl">Trading with Harry</h2><p className="mt-3 text-cream/85">Harry&apos;s experience. Your dedicated allocation. One clear record of the lock, actual results and payout.</p><p className="muted mt-3 text-sm">Access is part of Form Room and Inner Circle membership. Your membership fee does not fund the separate $500–$10,000 allocation. {open ? "Allocation requests are open, subject to Super Admin approval." : "New allocation requests are currently paused."}</p></div>
    <dl className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-xl bg-white/5 p-4"><dt className="muted text-xs">Allocation range</dt><dd className="mt-2 text-2xl text-gold-300">$500–$10,000</dd></div>
      <div className="rounded-xl bg-white/5 p-4"><dt className="muted text-xs">Lock from admin approval</dt><dd className="mt-2 text-2xl">33 days</dd></div>
      <div className="rounded-xl bg-white/5 p-4"><dt className="muted text-xs">Proposed daily target · unverified</dt><dd className="mt-2 text-lg"><span className="block">Form Room: {proposedTradingTargets.form.range}</span><span className="mt-1 block">Inner Circle: {proposedTradingTargets["inner-circle"].range}</span></dd></div>
    </dl>
    <p className="text-sm text-cream/80">These owner-proposed daily targets are provisional, are not predictions and have no verified performance record supplied. Returns and principal are not guaranteed; some or all of the allocation can be lost. No daily profit is automatically credited. Payout depends on actual recorded results and manual processing after the lock ends.</p>
    {showLink && <div className="flex flex-col gap-3 sm:flex-row"><Link className="btn-gold" href="/trading">Explore Trading with Harry</Link><Link className="btn-ghost" href="/plans#plan-form">View Form Room membership</Link></div>}
  </section>;
}
