import Link from "next/link";
import { portalData } from "@/lib/portal-data";
import { db } from "@/lib/db";
import { PlanCard } from "@/components/PlanCard";
import { hasPlayableSource } from "@/lib/video";
import { dateTimeUtc } from "@/lib/format";
import { PortalHeading } from "@/components/v2/PortalCommon";

export const metadata = { title: "Membership" };
export default async function PortalPlans() {
  const { subscription } = await portalData();
  const [plans, videos] = await Promise.all([db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }), db.video.findMany({ where: { published: true }, select: { minTier: true, bunnyVideoId: true, embedUrl: true } })]);
  return <><PortalHeading title="Your membership" description="Form Room puts Trading with Harry at the heart of the club. Compare planned access, published lessons and your membership period." /><div className="portal-banner"><span><strong className="text-gold-300">Current plan: {subscription?.plan.name ?? "Paddock · Free"}.</strong> {subscription ? `Access ends ${dateTimeUtc(subscription.endsAt)} UTC. Extend only when you choose.` : "Your free account stays open when paid access ends."}</span><Link href="/videos">Browse video availability →</Link></div><p className="portal-lead mb-6">Real trading enrollment is closed while final terms are prepared. Membership and the separate $500–$10,000 allocation are different payments. Buying a plan does not start trading. Paid plans have no automatic renewal.</p><div className="portal-three-col">{plans.map(plan => <PlanCard key={plan.id} plan={plan} highlight={plan.slug === "form"} availableVideos={videos.filter(video => video.minTier <= plan.tier && hasPlayableSource(video)).length} cta={plan.priceCents > 0 ? { href: `/v2/membership/${plan.slug}`, label: subscription?.planId === plan.id ? `Extend ${plan.intervalDays} days` : `Choose ${plan.name}` } : undefined} />)}</div></>;
}
