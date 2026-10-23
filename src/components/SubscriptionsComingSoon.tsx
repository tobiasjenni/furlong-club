import Link from "next/link";

export function SubscriptionsComingSoon({ member = false }: { member?: boolean }) {
  return <section className={member ? "portal-panel" : "card"} aria-label="Subscriptions coming soon">
    <p className="text-xs font-semibold uppercase tracking-wider text-gold-300">Subscriptions · Coming soon</p>
    <h2 className="mt-3 text-2xl">Start with Trading with Rob.</h2>
    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-cream/80">Paid subscriptions and additional club benefits will follow. For now, create your free account and explore Trading with Rob. No paid subscription is required; allocation funding and Super Admin approval are separate steps.</p>
    <div className="mt-5 flex flex-wrap gap-3"><Link prefetch={false} className="btn-gold" href={member ? "/allocations" : "/signup?next=%2Fallocations"}>{member ? "Open Trading with Rob" : "Sign up for Trading with Rob"}</Link><Link prefetch={false} className="btn-ghost" href="/trading">How trading works</Link></div>
  </section>;
}
