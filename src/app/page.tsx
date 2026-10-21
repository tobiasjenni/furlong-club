import { TradingOffer } from "@/components/TradingOffer";
import Link from "next/link";
import { PlanCard } from "@/components/PlanCard";
import { HostPortrait } from "@/components/HostPortrait";
import { brand } from "@/lib/config";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { hasPlayableSource } from "@/lib/video";

export const dynamic = "force-dynamic";

const steps = [
  { title: "Join free", body: "Create your Paddock account and explore the club before choosing a paid plan." },
  { title: "Explore the library", body: "Browse lessons on form, the going, the draw and staking discipline. Each title shows whether it is ready to watch." },
  { title: "Choose your access", body: "Pick the plan that suits you. Pay once for the period shown, and extend only when you choose." },
];

const faqs = [
  { q: "Is Furlong Club a bookmaker?", a: "No. We teach you how to read a race and share our opinion on the day's cards. We accept membership payments and club credit, but never take bets or bet on your behalf. If you choose to bet, you do it yourself with a licensed bookmaker." },
  { q: "Who is Harry Whitcombe?", a: "Harry Whitcombe is the host of Furlong Club. The current portrait on the site is an AI-generated illustration." },
  { q: "How do I pay?", a: "Add USDT or USDC to your club wallet, report your transfer, and wait for an admin to approve the deposit. Then use your available club credit to activate a plan. Your access period is shown on the plan and at checkout." },
  { q: "Will I be charged again?", a: "No. Paid plans are one-off purchases with no automatic renewal. When your access period ends, paid access stops and your free account stays open. Extend only if you choose to." },
  { q: "Are all videos available now?", a: "Check the video library before choosing a paid plan. Titles marked In preparation are not available to watch yet; joining or upgrading does not make those videos available sooner." },
  { q: "Is Trading with Harry included in membership?", a: "No. Trading with Harry is a separate proposed service with its own allocation, lock and payout terms. Real trading enrollment is currently closed. A membership payment does not create a trading allocation." },
  { q: "Do you guarantee winnings?", a: "No one can. Our videos are education and opinion, not advice. Only bet what you can afford to lose, and stop if it stops being fun." },
];

export default async function Home() {
  const [plans, videos, user] = await Promise.all([
    db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.video.findMany({ where: { published: true }, select: { minTier: true, bunnyVideoId: true, embedUrl: true } }),
    currentUser(),
  ]);
  const periods = [...new Set(plans.filter(p => p.priceCents > 0).map(p => p.intervalDays))];
  const highlights = [
    { value: "UK", label: "Racing focus" },
    { value: "Form & racecraft", label: "Learn the essentials" },
    { value: periods.length === 1 ? `${periods[0]} days` : "Your choice", label: "Plans, no auto-renew" },
    { value: "18+", label: "Responsible gambling first" },
  ];
  return (
    <>
      <section className="silk-stripes relative overflow-hidden border-b border-white/10">
        <div className="container-page grid items-center gap-10 py-14 md:grid-cols-[1.2fr_1fr] md:py-24">
          <div>
            <p className="badge mb-5 border border-gold-400/40 text-gold-300">Horse racing, explained by {brand.host.first}</p>
            <h1 className="text-4xl leading-[1.05] sm:text-5xl md:text-6xl">
              Read the race <span className="text-gold-400">before</span> the gates open.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-cream/75">
              A clearer view of the form. Explore race cards, understand the going and build a disciplined approach to staking,
              with {brand.host.first} as your guide. Start with a free account and find your place in the club.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={user ? "/dashboard" : "/signup"} className="btn-gold px-7 py-3 text-base">{user ? "Open your dashboard" : "Join free"}</Link>
              <Link href="/plans" className="btn-ghost px-7 py-3 text-base">Explore plans</Link>
            </div>
            <p className="muted mt-4 text-xs">Free to join · No automatic renewal · 18+ only</p>
          </div>
          <div className="relative">
            <HostPortrait className="mx-auto w-full max-w-[340px] shadow-2xl" />
            <p className="muted mt-3 text-center text-xs">Meet {brand.host.name}, our paddock guide. AI-generated illustration.</p>
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

      <section id="how" className="container-page py-16 md:py-20">
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
            <h2 className="text-3xl">Who is {brand.host.first}?</h2>
            <p className="mt-3 text-cream/75">
              {brand.host.name} is the host of {brand.name}. Join Harry for racing education, race-day analysis and a closer look at the form.
            </p>
            <Link href={brand.host.page} className="mt-4 inline-block text-gold-300 hover:underline">Meet {brand.host.first} →</Link>
          </div>
        </div>
      </section>

      <div className="container-page py-8"><TradingOffer /></div>

      <section id="plans" className="container-page py-16 md:py-20">
        <h2 className="text-3xl md:text-4xl">Choose your plan</h2>
        <p className="muted mt-2">Start with Paddock for free. Compare each plan&apos;s access and published videos before choosing.</p>
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
