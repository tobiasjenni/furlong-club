import Link from "next/link";
import { Disclaimer } from "@/components/Disclaimer";
import { PlanCard } from "@/components/PlanCard";
import { RobMascot } from "@/components/RobMascot";
import { brand } from "@/lib/config";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const steps = [
  { title: "Join free", body: "Create an account with just your email. Intro videos unlock straight away." },
  { title: "Learn the form", body: "Rob walks you through race cards, the going, the draw and staking discipline." },
  { title: "Race-day breakdowns", body: "Members get Rob's take on the day's feature races before the off." },
];

export default async function Home() {
  const plans = await db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  return (
    <>
      <section className="silk-stripes relative overflow-hidden border-b border-white/10">
        <div className="container-page grid items-center gap-10 py-14 md:grid-cols-[1.2fr_1fr] md:py-24">
          <div>
            <p className="badge mb-5 border border-gold-400/40 text-gold-300">Horse racing, explained by Rob</p>
            <h1 className="text-4xl leading-[1.05] sm:text-5xl md:text-6xl">
              Read the race <span className="text-gold-400">before</span> the gates open.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-cream/75">
              {brand.name} is a video club for racing fans. Learn how to study form, judge the going and manage your
              stake, then watch Rob break down the big races on the card.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="btn-gold px-7 py-3 text-base">Join free</Link>
              <Link href="/plans" className="btn-ghost px-7 py-3 text-base">See plans</Link>
            </div>
            <p className="muted mt-4 text-xs">18+ only · Pay with USDT or USDC · Cancel anytime</p>
          </div>
          <div className="relative">
            <RobMascot className="mx-auto w-full max-w-[340px] drop-shadow-2xl" />
            <p className="muted mt-3 text-center text-xs">Meet Rob, our illustrated paddock guide. He is a fictional character.</p>
          </div>
        </div>
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
          <RobMascot className="mx-auto h-40 w-40" />
          <div>
            <h2 className="text-3xl">Who is Rob?</h2>
            <p className="mt-3 text-cream/75">
              Rob is the face of {brand.name}: a flat-capped, binocular-toting regular of British racecourses we created to
              host our videos. The analysis behind him comes from our team, who have spent years studying UK racing.
            </p>
            <Link href="/about-rob" className="mt-4 inline-block text-gold-300 hover:underline">Read Rob&apos;s story →</Link>
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
    </>
  );
}
