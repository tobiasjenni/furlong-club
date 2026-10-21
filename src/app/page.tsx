import { TradingOffer } from "@/components/TradingOffer";
import Link from "next/link";
import { PlanCard } from "@/components/PlanCard";
import { HostPortrait } from "@/components/HostPortrait";
import { brand } from "@/lib/config";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { hasPlayableSource } from "@/lib/video";
import { usd } from "@/lib/format";
import { organization, pageMetadata, siteUrl, website } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata("/");

const steps = [
  { title: "Join free", body: "Create your Paddock account and explore the club before choosing a paid plan." },
  { title: "Meet Harry’s approach", body: "Explore Trading with Harry and his experience reading horses and riders. Review the allocation, lock and payout terms." },
  { title: "Choose Form Room", body: "Trading with Harry is the main planned membership benefit. Enrollment is currently closed; membership and trading capital are paid separately." },
];

const faqs = [
  { q: "Is Furlong Club a bookmaker?", a: "No. We teach you how to read a race and share our opinion on the day's cards. This website does not place bets. Trading with Harry is a proposed allocation service with its own terms, described on the trading page; real enrollment is currently closed." },
  { q: "Who is Harry Whitcombe?", a: "Harry Whitcombe is the host of Furlong Club, bringing more than 40 years of experience reading horses and riders. He helps members look beyond the numbers to understand the horse, the rider and the race in front of them." },
  { q: "How do I pay?", a: "Add USDT or USDC to your club wallet, report your transfer, and wait for an admin to approve the deposit. Then use your available club credit to activate a plan. Your access period is shown on the plan and at checkout." },
  { q: "Will I be charged again?", a: "No. Paid plans are one-off purchases with no automatic renewal. When your access period ends, paid access stops and your free account stays open. Extend only if you choose to." },
  { q: "Are all videos available now?", a: "Check the video library before choosing a paid plan. Titles marked In preparation are not available to watch yet; joining or upgrading does not make those videos available sooner." },
  { q: "How does Trading with Harry fit into membership?", a: "Trading with Harry is the main planned benefit of Form Room and is also included in Inner Circle’s planned access. Real trading enrollment is currently closed while final terms are prepared. The membership fee is separate from the $500–$10,000 allocation: buying a plan does not create an allocation, start the 33-day lock or generate profit." },
  { q: "Do you guarantee winnings?", a: "No one can. Our videos are education and opinion, not advice. Only bet what you can afford to lose, and stop if it stops being fun." },
];

export default async function Home() {
  const [plans, videos, user] = await Promise.all([
    db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.video.findMany({ where: { published: true }, select: { minTier: true, bunnyVideoId: true, embedUrl: true } }),
    currentUser(),
  ]);
  const periods = [...new Set(plans.filter(p => p.priceCents > 0).map(p => p.intervalDays))];
  const formPlan = plans.find(p => p.slug === "form" && p.priceCents > 0);
  const membershipLabel = formPlan ? `${usd(formPlan.priceCents)} / ${formPlan.intervalDays} days` : "View membership";
  const highlights = [
    { value: "40+ years", label: "Harry’s experience" },
    { value: "Trading with Harry", label: "Form Room’s main feature" },
    { value: periods.length === 1 ? `${periods[0]} days` : "Your choice", label: "Plans, no auto-renew" },
    { value: "18+", label: "Responsible gambling first" },
  ];
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [organization, website, { "@type": "WebPage", "@id": siteUrl("/#webpage"), url: siteUrl(), name: "Trading with Harry & Horse Racing | Furlong Club", isPartOf: { "@id": website["@id"] }, about: { "@id": organization["@id"] }, inLanguage: "en" }] }} />
      <section className="silk-stripes relative overflow-hidden border-b border-white/10">
        <div className="container-page grid items-center gap-10 py-14 md:grid-cols-[1.2fr_1fr] md:py-24">
          <div>
            <p className="badge mb-5 border border-gold-400/40 text-gold-300">{formPlan?.name ?? "Form Room"} · {membershipLabel}</p>
            <h1 className="text-4xl leading-[1.05] sm:text-5xl md:text-6xl">
              Trading with <span className="text-gold-400">Harry.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-cream/75">
              The centrepiece of Form Room. More than 40 years of reading horses and riders, brought to your membership by {brand.host.name}.
            </p>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-cream/75">A proposed service for Harry to trade a dedicated allocation on your behalf, alongside the club&apos;s racing lessons. Trading enrollment is not yet open; your allocation is funded separately from membership.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/trading" className="btn-gold px-7 py-3 text-base">Explore Trading with Harry</Link>
              <Link href="/plans#plan-form" className="btn-ghost px-7 py-3 text-base">{formPlan ? `View ${usd(formPlan.priceCents)} membership` : "View membership"}</Link>
            </div>
            <p className="muted mt-4 text-xs">{formPlan ? `${formPlan.intervalDays}-day membership` : "One-off membership"} · No automatic renewal · 18+ only</p>
          </div>
          <div className="relative">
            <HostPortrait priority className="mx-auto w-full max-w-[340px] shadow-2xl" />
            <p className="muted mt-3 text-center text-xs">{brand.host.name} · Over 40 years of racing experience</p>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-turf-900/60">
        <dl className="container-page grid grid-cols-2 gap-6 py-8 md:grid-cols-4">
          {highlights.map((h) => (
            <div key={h.label} className="text-center">
              <dt className="muted text-xs uppercase tracking-wider">{h.label}</dt>
              <dd className="mt-1 font-display text-2xl text-gold-300">{h.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="container-page py-8 md:py-12"><TradingOffer /></div>

      <section id="how" className="container-page py-12 md:py-20">
        <h2 className="text-3xl md:text-4xl">How it works</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="card">
              <span className="font-display text-4xl text-gold-400">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-3 text-xl">{s.title}</h3>
              <p className="muted mt-2 text-sm">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-6">
        <div className="card grid items-center gap-8 md:grid-cols-[auto_1fr]">
          <HostPortrait className="mx-auto h-40 w-40" rounded="rounded-full" />
          <div>
            <h2 className="text-3xl">Experience that looks beyond the form</h2>
            <p className="mt-3 text-cream/75">
              {brand.host.name} brings more than 40 years of experience reading horses and riders to {brand.name}. Learn to consider how a horse moves, how its rider responds and how the pair fit the conditions.
            </p>
            <Link href={brand.host.page} className="mt-4 inline-block text-gold-300 hover:underline">Meet {brand.host.first} →</Link>
          </div>
        </div>
      </section>

      <section id="plans" className="container-page py-12 md:py-20">
        <h2 className="text-3xl md:text-4xl">Choose your plan</h2>
        <p className="muted mt-2">Form Room puts Trading with Harry at the heart of your membership. Compare the planned access and current availability below, or explore the club with a free account.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} availableVideos={videos.filter(v => v.minTier <= p.tier && hasPlayableSource(v)).length} highlight={p.tier === 1} cta={{ href: p.priceCents ? `/checkout/${p.slug}` : user ? "/dashboard" : "/signup", label: p.priceCents ? `Choose ${p.name}` : user ? "Open dashboard" : "Join free" }} />
          ))}
        </div>
      </section>

      <section id="faq" className="container-page max-w-3xl pb-8">
        <h2 className="text-3xl md:text-4xl">Questions, answered</h2>
        <div className="mt-6 divide-y divide-white/10 rounded-2xl border border-white/10 bg-turf-900/40">
          {faqs.map((f) => (
            <details key={f.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-cream">
                {f.q}
                <span className="text-gold-400 transition group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="muted mt-3 text-sm leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
