import { PlanCard } from "@/components/PlanCard";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { activeSubscription } from "@/lib/subscriptions";
import { hasPlayableSource } from "@/lib/video";
import Link from "next/link";
import { usd } from "@/lib/format";

export const metadata = { title: "Plans" };
export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const user = await currentUser();
  const [plans, sub, videos] = await Promise.all([
    db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    user ? activeSubscription(user.id) : null,
    db.video.findMany({ where: { published: true }, select: { minTier: true, bunnyVideoId: true, embedUrl: true } }),
  ]);
  const formPlan = plans.find(p => p.slug === "form" && p.priceCents > 0);
  return (
    <div className="container-page py-12 md:py-16">
      <h1 className="text-4xl">Find your place in the club</h1>
      <p className="mt-3 max-w-3xl text-lg text-cream/85">Trading with Harry is at the heart of Form Room. Choose the membership built around Harry&apos;s racing experience, with trading access planned once enrollment opens.</p>
      <p className="muted mt-3 max-w-3xl text-sm">The membership fee and trading allocation are separate. Real trading enrollment is currently closed. Start with a free account to explore; paid plans run for the period shown with no automatic renewal.</p>
      {formPlan && <Link href="#plan-form" className="btn-gold mt-5">Explore {formPlan.name} · {usd(formPlan.priceCents)} / {formPlan.intervalDays} days</Link>}
      {!videos.some(hasPlayableSource) && <p className="mt-4 text-sm text-gold-300">The video library is in preparation. Browse the catalogue with a free account before buying a plan. Paid access starts when you activate it.</p>}
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const current = sub?.planId === p.id;
          const cta = p.priceCents === 0
            ? user ? undefined : { href: "/signup", label: "Join free" }
            : { href: `/checkout/${p.slug}`, label: current ? `Extend ${p.intervalDays} days` : `Choose ${p.name}` };
          return <PlanCard key={p.id} plan={p} availableVideos={videos.filter(v => v.minTier <= p.tier && hasPlayableSource(v)).length} highlight={p.tier === 1} cta={cta} />;
        })}
      </div>
    </div>
  );
}
