import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { tradingTermsVersion } from "@/lib/trading";
import { tradingEnrollmentOpen } from "@/lib/trading-program";
import { walletTestMode } from "@/lib/environment";
import { TradingOffer } from "@/components/TradingOffer";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const metadata = pageMetadata("/trading");
export const dynamic = "force-dynamic";

export default async function TradingPage() {
  const [user, open] = await Promise.all([currentUser(), tradingEnrollmentOpen()]);
  const funding = user ? "/wallet?for=trading#add-funds" : "/signup?next=%2Fwallet%3Ffor%3Dtrading%23add-funds";
  return <div className="container-page max-w-5xl space-y-6 py-10">
    <Breadcrumbs path="/trading" label="Trading with Harry" />
    <h1 className="text-3xl md:text-4xl">Trading with Harry</h1>
    <TradingOffer showLink={false} />
    <section className="card space-y-4"><h2 className="text-2xl">{open ? walletTestMode() ? "Simulated requests are open in this preview" : "Trading allocation requests are open" : "New allocation requests are paused"}</h2><p className="muted text-sm">{walletTestMode() ? "This preview uses simulated funds only. Do not send real cryptocurrency here." : "Deposit USDT or USDC, report your transfer and wait for Super Admin verification. Then request your allocation using approved credit. Membership and allocation capital are separate."}</p><div className="flex flex-wrap gap-3">{open && <Link className="btn-gold" href={funding}>Add funds for Harry</Link>}<Link className="btn-ghost" href={user ? "/allocations#request" : "/login?next=%2Fallocations"}>Your allocations & requests →</Link></div></section>
    <section className="card"><h2 className="text-2xl">How funding and approval work</h2><ol className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
      <li><strong className="text-gold-300">1. Membership & allocation</strong><p className="muted mt-2">Form Room is the membership built around Trading with Harry; Inner Circle includes access too. Fund a separate $500–$10,000 allocation through the deposit approval process and save your external receiving wallet. A request alone does not reserve funds.</p></li>
      <li><strong className="text-gold-300">2. Admin approval & lock</strong><p className="muted mt-2">Approval moves available credit into a separate allocation and starts exactly 33 days. Locked principal cannot pay for membership or be withdrawn early.</p></li>
      <li><strong className="text-gold-300">3. Actual result & manual payout</strong><p className="muted mt-2">After maturity, an admin records the actual profit or loss and manually sends any amount due to the saved wallet. The confirmed transaction is recorded in your history.</p></li>
    </ol><p className="muted mt-5 text-xs">Club accounting uses one USDT or USDC token per $1 of club credit; this is not a market exchange quote. The operator pays outgoing network fees. The displayed daily targets are not contractual rates. This website does not calculate daily returns or compound earnings. No trading execution, yield accrual or automatic blockchain payout is connected to this website.</p></section>
    <section className="card"><h2 className="text-2xl">Your allocation terms</h2><p className="muted mt-3 text-sm">Every new request saves allocation terms {tradingTermsVersion}, your membership and receiving wallet. A pending request does not reserve funds. Only Super Admin approval starts the 33-day lock. <Link className="text-gold-300 underline" href="/legal/terms#trading-terms">Read the allocation terms →</Link></p></section>
  </div>;
}
