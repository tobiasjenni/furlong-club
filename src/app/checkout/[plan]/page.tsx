import { notFound } from "next/navigation";
import { Disclaimer } from "@/components/Disclaimer";
import { requireUser } from "@/lib/auth";
import { checkoutOptions } from "@/lib/config";
import { db } from "@/lib/db";
import { usd } from "@/lib/format";
import { CheckoutForm } from "./CheckoutForm";
import crypto from "node:crypto";
import { walletEnabled } from "@/lib/config";
import { paymentsReady } from "@/lib/payments";
import { WalletPurchase } from "./WalletPurchase";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage({ params }: { params: Promise<{ plan: string }> }) {
  const user = await requireUser();
  const plan = await db.plan.findUnique({ where: { slug: (await params).plan } });
  if (!plan || !plan.active || plan.priceCents === 0) notFound();
  return (
    <div className="container-page grid max-w-4xl gap-6 py-10 md:grid-cols-2">
      <div className="card">
        <p className="muted text-sm">You&apos;re getting</p>
        <h1 className="mt-1 text-3xl">{plan.name}</h1>
        <p className="mt-4 font-display text-4xl">{usd(plan.priceCents)}</p>
        <p className="muted text-sm">for {plan.intervalDays} days of access</p>
        <ul className="mt-5 space-y-2 text-sm text-cream/80">{plan.features.map((f) => <li key={f}>· {f}</li>)}</ul>
        <p className="muted mt-5 text-xs">One-off payment. It does not renew automatically; we&apos;ll email you before it ends.</p>
      </div>
      <div className="card space-y-5">
        {!user.emailVerifiedAt && (
          <p className="rounded-xl bg-gold-400/10 p-3 text-sm text-gold-300">Please confirm your email before paying. The link is in your inbox, or resend it from your dashboard.</p>
        )}
        {walletEnabled && <WalletPurchase planId={plan.id} priceCents={plan.priceCents} balanceCents={user.balanceCents} requestKey={crypto.randomUUID()} disabled={!user.emailVerifiedAt || user.walletFrozen} />}
        <h2 className="text-xl">Pay directly with crypto</h2>
        <CheckoutForm plan={plan.slug} options={checkoutOptions.map((o) => ({ label: o.label, enabled: paymentsReady(o) }))} />
        <Disclaimer compact />
      </div>
    </div>
  );
}
