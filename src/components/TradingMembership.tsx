import Link from "next/link";

export function TradingMembership({ compact = false }: { compact?: boolean }) {
  return <div className={`rounded-xl border border-gold-400/35 bg-gold-400/10 ${compact ? "mt-4 p-4" : "p-5"}`}>
    <p className="text-xs font-semibold uppercase tracking-wider text-gold-300">{compact ? "Main planned benefit" : "Your membership’s main feature"}</p>
    <p className="mt-2 font-display text-xl text-cream">Trading with Harry</p>
    {compact ? <p className="mt-2 text-sm text-cream/85">Enrollment is closed. A separate $500–$10,000 allocation is required when trading opens.</p> : <><p className="mt-2 text-sm text-cream/85">Planned access for Form Room and Inner Circle members when enrollment opens.</p><p className="muted mt-2 text-xs leading-relaxed">The membership fee is separate from the $500–$10,000 trading allocation. Real trading enrollment is closed while final terms are prepared. Buying a plan does not start trading or lock any funds.</p></>}
    <Link href="/trading" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-gold-300 underline underline-offset-4">{compact ? "Trading details →" : "Explore Trading with Harry →"}</Link>
  </div>;
}
