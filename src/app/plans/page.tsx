import { PlanCard } from "@/components/PlanCard";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { activeSubscription } from "@/lib/subscriptions";

export const metadata = { title: "Plans" };
export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const user = await currentUser();
  const [plans, sub] = await Promise.all([
    db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    user ? activeSubscription(user.id) : null,
  ]);
  return (
    <div className="container-page py-12 md:py-16">
      <h1 className="text-4xl">Plans</h1>
      <p className="muted mt-2">Choose your access period below. Paid plans use USDT or USDC and do not renew automatically.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const current = sub?.planId === p.id;
          const cta = p.priceCents === 0
            ? user ? undefined : { href: "/signup", label: "Join free" }
            : { href: `/checkout/${p.slug}`, label: current ? `Extend ${p.intervalDays} days` : `Get ${p.name}` };
          return <PlanCard key={p.id} plan={p} highlight={p.tier === 1} cta={cta} />;
        })}
      </div>
    </div>
  );
}
