import Link from "next/link";
import { proposedTargetFor, proposedTradingTargets } from "@/lib/trading-marketing";

export function TradingMembership({ compact = false, planSlug }: { compact?: boolean; planSlug?: string }) {
  const target = proposedTargetFor(planSlug);
  return <div className={`rounded-xl border border-gold-400/35 bg-gold-400/10 ${compact ? "mt-4 p-4" : "p-5"}`}>
    <p className="text-xs font-semibold uppercase tracking-wider text-gold-300">{compact ? "Main planned benefit" : "Your membership’s main feature"}</p>
    <p className="mt-2 font-display text-xl text-cream">Trading with Harry</p>
    {target ? <><p className="mt-3 text-xs text-cream/75">Proposed daily target · unverified</p><p className="mt-1 text-2xl font-semibold text-gold-300">{target.range} <span className="text-sm font-normal">per day</span></p><p className="mt-2 text-xs leading-relaxed text-cream/80">A proposed target, not a forecast or promised return. Actual returns are not determined by the membership fee. Losses, including all capital, are possible.</p></> : <p className="mt-2 text-sm text-cream/85">Owner-proposed daily targets: {proposedTradingTargets.form.name} {proposedTradingTargets.form.range}; {proposedTradingTargets["inner-circle"].name} {proposedTradingTargets["inner-circle"].range}. Unverified and not guaranteed.</p>}
    <p className="muted mt-3 text-xs leading-relaxed">{compact ? "Enrollment remains closed. Membership and trading capital are separate." : "The membership fee is separate from the $500–$10,000 trading allocation. Real trading enrollment is closed while final terms are prepared. Buying a plan does not start trading or lock any funds."}</p>
    <Link href="/trading" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-gold-300 underline underline-offset-4">{compact ? "Trading details →" : "Explore Trading with Harry →"}</Link>
  </div>;
}
