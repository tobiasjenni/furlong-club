import { memberEmailReady } from "@/lib/email-verification";
import crypto from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { subscriptionSalesEnabled } from "@/lib/subscription-sales";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { usd } from "@/lib/format";
import { walletEnabled } from "@/lib/config";
import { hasPlayableSource } from "@/lib/video";
import { WalletPurchase } from "@/app/checkout/[plan]/WalletPurchase";
import { PortalHeading } from "@/components/v2/PortalCommon";

export const metadata = { title: "Activate membership" };
export default async function PortalMembership({ params }: { params: Promise<{ plan: string }> }) {
  const user = await requireUser();
  if (!subscriptionSalesEnabled) redirect("/membership");
  const plan = await db.plan.findUnique({ where: { slug: (await params).plan } });
  if (!plan || !plan.active || plan.priceCents === 0) notFound();
  const videos = await db.video.findMany({ where: { published: true, minTier: { lte: plan.tier } }, select: { bunnyVideoId: true, embedUrl: true } });
  const ready = videos.filter(hasPlayableSource).length;
  return <><PortalHeading title={`Activate ${plan.name}`} description="Review the current price, availability and access period before confirming your purchase."><Link prefetch={false} className="btn-ghost" href="/membership">Back to membership</Link></PortalHeading><div className="portal-two-col"><section className="portal-panel"><p className="portal-eyebrow">YOUR MEMBERSHIP</p><h2>{plan.name}</h2><p className="portal-value">{usd(plan.priceCents)}</p><p className="portal-small">{plan.intervalDays} days · one payment · no automatic renewal</p><ul className="mt-6 space-y-3 text-sm text-cream/80">{plan.features.map(feature => <li key={feature}>✓ {feature}</li>)}</ul><div className="portal-divider" /><p className="portal-small">Form Room and Inner Circle include access to request a Trading with Rob allocation, subject to Super Admin approval. The allocation is funded separately; membership does not start a lock or create profit.</p><p className="portal-small mt-4">{ready} videos are ready to watch on this plan. {ready === 0 ? "The video library is still in preparation. Paid access starts when payment is confirmed and does not make unpublished videos available." : "Check the catalogue before choosing."} <Link prefetch={false} href="/videos" className="text-gold-300 underline">View the library</Link>.</p></section><section className="portal-panel"><h2 className="mb-5">Confirm your purchase</h2>{(!memberEmailReady(user.emailVerifiedAt) || user.walletFrozen) && <p className="portal-banner">{user.walletFrozen ? "Your wallet is under review. Membership payments are paused." : "Confirm your email before purchasing membership."}</p>}{walletEnabled ? <WalletPurchase key={`${plan.id}:${plan.priceCents}`} planSlug={plan.slug} planId={plan.id} priceCents={plan.priceCents} balanceCents={user.balanceCents} requestKey={crypto.randomUUID()} disabled={!memberEmailReady(user.emailVerifiedAt) || user.walletFrozen} portal /> : <p className="portal-small">Wallet payments are currently unavailable. Contact support before sending funds.</p>}<p className="portal-section-note">New access begins when the purchase is confirmed. Buying the same active plan extends its current expiry. Your available club credit is charged once, and the purchase is recorded in your account history.</p></section></div></>;
}
