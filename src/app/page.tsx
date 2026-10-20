import Link from "next/link";
import { Disclaimer } from "@/components/Disclaimer";
import { PlanCard } from "@/components/PlanCard";
import { HostPortrait } from "@/components/HostPortrait";
import { brand } from "@/lib/config";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const steps = [
  { title: "Join free", body: "Create an account with just your email. Intro videos unlock straight away." },
  { title: "Learn the form", body: "Harry walks you through race cards, the going, the draw and staking discipline." },
  { title: "Race-day breakdowns", body: "Members get Harry's take on the day's feature races before the off." },
];

const highlights = [
  { value: "UK", label: "Racing covered" },
  { value: "Weekly", label: "New breakdowns" },
  { value: "30 days", label: "Plans, no auto-renew" },
  { value: "18+", label: "Responsible gambling first" },
];

const faqs = [
  { q: "Is Furlong Club a bookmaker?", a: "No. We teach you how to read a race and share our opinion on the day's cards. We never take bets, hold your money or bet on your behalf. If you choose to bet, you do it yourself with a licensed bookmaker." },
  { q: "Who is Harry Whitcombe?", a: "Harry is our fictional host with an AI-generated portrait. The analysis behind the videos comes from our team of racing analysts." },
  { q: "How do I pay?", a: "Paid plans are paid upfront in USDT or USDC and run for 30 days. They do not renew automatically, so you are never charged without choosing to." },
  { q: "Can I cancel?", a: "There is nothing to cancel: when your 30 days end, your plan simply stops. You keep your free account and the intro videos." },
  { q: "Do you guarantee winnings?", a: "No one can. Our videos are education and opinion, not advice. Only bet what you can afford to lose, and stop if it stops being fun." },
];

export default async function Home() {
  const plans = await db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
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
              {brand.name} is a video club for racing fans. Learn how to study form, judge the going and manage your
              stake, then watch {brand.host.first} break down the big races on the card.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="btn-gold px-7 py-3 text-base">Join free</Link>
              <Link href="/plans" className="btn-ghost px-7 py-3 text-base">See plans</Link>
            </div>
            <p className="muted mt-4 text-xs">18+ only · Pay with USDT or USDC · Cancel anytime</p>
          </div>
          <div className="relative">
            <HostPortrait className="mx-auto w-full max-w-[340px] shadow-2xl" />
            <p className="muted mt-3 text-center text-xs">Meet {brand.host.name}, our paddock guide. A fictional character with an AI-generated portrait.</p>
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
              {brand.host.name} is the face of {brand.name}: a flat-capped, binocular-toting regular of British racecourses we created to
              host our videos. The analysis behind him comes from our team, who have spent years studying UK racing.
            </p>
            <Link href={brand.host.page} className="mt-4 inline-block text-gold-300 hover:underline">Read {brand.host.first}&apos;s story →</Link>
          </div>
        </div>
      </section>

      <section id="plans" className="container-page py-16 md:py-20">
        <h2 className="text-3xl md:text-4xl">Choose your plan</h2>
        <p className="muted mt-2">Start free. Upgrade when you want the full library.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} highlight={p.tier === 1} cta={{ href: p.priceCents ? `/checkout/${p.slug}` : "/signup", label: p.priceCents ? `Get ${p.name}` : "Join free" }} />
          ))}
        </div>
        <div className="mt-8"><Disclaimer /></div>
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
