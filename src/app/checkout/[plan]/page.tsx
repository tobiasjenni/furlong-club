import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { checkoutOptions } from "@/lib/config";
import { db } from "@/lib/db";
import { usd } from "@/lib/format";
import { CheckoutForm } from "./CheckoutForm";
import crypto from "node:crypto";
import { walletEnabled } from "@/lib/config";
import { paymentsReady } from "@/lib/payments";
import { WalletPurchase } from "./WalletPurchase";
import { manualDepositsEnabled } from "@/lib/manual-deposits";
import { emailDelivers } from "@/lib/email";
import { hasPlayableSource } from "@/lib/video";
import Link from "next/link";
import { TradingMembership } from "@/components/TradingMembership";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage({ params }: { params: Promise<{ plan: string }> }) {
  const user = await requireUser();
  const plan = await db.plan.findUnique({ where: { slug: (await params).plan } });
  if (!plan || !plan.active || plan.priceCents === 0) notFound();
  const videos = await db.video.findMany({ where: { published: true, minTier: { lte: plan.tier } }, select: { bunnyVideoId: true, embedUrl: true } });
  const readyCount = videos.filter(hasPlayableSource).length;
  return (
    <div className="container-page grid max-w-4xl gap-6 py-10 md:grid-cols-2">
      <div className="card">
        <p className="muted text-sm">Your membership</p>
        <h1 className="mt-1 text-3xl">{plan.name}</h1>
        <p className="mt-4 font-display text-4xl">{usd(plan.priceCents)}</p>
        <p className="muted text-sm">for {plan.intervalDays} days of access</p>
        {plan.tier >= 1 && <div className="mt-5"><TradingMembership planSlug={plan.slug} /></div>}
        <ul className="mt-5 space-y-2 text-sm text-cream/80">{plan.features.map((f) => <li key={f}>· {f}</li>)}</ul>
        <p className="muted mt-5 text-xs">One-off payment. No automatic renewal. New access begins when your purchase is confirmed. Buying the same active plan extends its current expiry.</p>
        <p className="muted mt-3 text-xs">{readyCount} video{readyCount === 1 ? "" : "s"} ready to watch on this plan. <Link href="/videos" className="text-gold-300 underline">Browse the library before paying.</Link></p>
        {readyCount === 0 && <p className="mt-3 rounded-xl border border-gold-400/30 p-3 text-sm text-gold-300">This plan&apos;s video library is still in preparation. New access starts when payment is confirmed; it does not make unpublished videos available.</p>}
      </div>
      <div className="card space-y-5">
        {!user.emailVerifiedAt && (
          <p className="rounded-xl bg-gold-400/10 p-3 text-sm text-gold-300">Please confirm your email before paying. {emailDelivers() ? "Use the link in your inbox, or request a new one from your dashboard." : "Email delivery is currently unavailable. Contact support@furlong.club from your registered address for help confirming your account."}</p>
        )}
        {walletEnabled && <WalletPurchase planId={plan.id} priceCents={plan.priceCents} balanceCents={user.balanceCents} requestKey={crypto.randomUUID()} disabled={!user.emailVerifiedAt || user.walletFrozen} />}
        {!manualDepositsEnabled && <><h2 className="text-xl">Pay directly with crypto</h2>
          <CheckoutForm plan={plan.slug} options={checkoutOptions.map((o) => ({ label: o.label, enabled: paymentsReady(o) }))} /></>}
        {manualDepositsEnabled && <p className="muted text-sm">Add USDT or USDC to your wallet. Once an admin approves your deposit, return here to activate this plan using your club credit.</p>}
      </div>
    </div>
  );
}
