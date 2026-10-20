import Link from "next/link";

export function TradingOffer() {
  return <section className="card space-y-5">
    <div><p className="text-xs uppercase tracking-wider text-gold-300">Trading with Harry · proposal</p><h2 className="mt-2 text-3xl">A dedicated trading allocation</h2><p className="muted mt-3 text-sm">A proposed service for members who want Harry to trade an allocation on their behalf. Final terms are being prepared; real trading enrollment is closed.</p></div>
    <dl className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-xl bg-white/5 p-4"><dt className="muted text-xs">Allocation range</dt><dd className="mt-2 text-2xl text-gold-300">$500–$10,000</dd></div>
      <div className="rounded-xl bg-white/5 p-4"><dt className="muted text-xs">Lock from admin approval</dt><dd className="mt-2 text-2xl">33 days</dd></div>
      <div className="rounded-xl bg-white/5 p-4"><dt className="muted text-xs">Proposed daily target · unverified</dt><dd className="mt-2 text-2xl">2–3%</dd></div>
    </dl>
    <p className="text-sm text-cream/80">The daily target is provisional, is not a prediction and has no verified performance record supplied. Returns and principal are not guaranteed; some or all of the allocation can be lost. No daily profit is automatically credited. Payout depends on actual recorded results and manual processing after the lock ends.</p>
    <Link className="btn-ghost" href="/trading">View trading details</Link>
  </section>;
}
