import { AutoRefresh } from "@/app/checkout/pay/[id]/AutoRefresh";
import Link from "next/link";
import { portalData } from "@/lib/portal-data";
import { db } from "@/lib/db";
import { PortfolioOverview } from "@/components/v2/PortfolioOverview";
import { ResultsCalendar } from "@/components/v2/ResultsCalendar";
import { ActivityTable, AllocationCard, EmptyState, PortalHeading } from "@/components/v2/PortalCommon";
import { HostPortrait } from "@/components/HostPortrait";
import { VerifyBanner } from "@/components/VerifyBanner";
import { emailDelivers } from "@/lib/email";
import { emailVerificationRequired } from "@/lib/email-verification";
import { dateTimeUtc } from "@/lib/format";
import { portalActivityQuery, type PortalActivityPage } from "@/lib/portal-activity";
import { PortalIcon } from "@/components/v2/PortalIcon";

export const metadata = { title: "Overview" };
export default async function PortalOverview({ searchParams }: { searchParams: Promise<{ walletPurchase?: string; welcome?: string; verification?: string }> }) {
  const params = await searchParams;
  const purchase = params.walletPurchase === "1";
  const welcome = params.welcome === "1";
  const { user, snapshot, subscription } = await portalData();
  const [allocations, activity] = await Promise.all([
    db.tradingAllocation.findMany({ where: { userId: user.id, status: { in: ["PENDING", "ACTIVE", "PAYOUT_READY"] } }, orderBy: { requestedAt: "desc" }, take: 3 }),
    db.$queryRaw<{ activity: PortalActivityPage }[]>(portalActivityQuery(user.id, "all", "", 1, 5)),
  ]);
  return <><AutoRefresh seconds={60} />
    <PortalHeading title={`Welcome${welcome ? " to the club" : " back"}${user.name ? `, ${user.name.split(" ")[0]}` : ""}.`} description={welcome ? `Your free account is ready and you are signed in. ${emailVerificationRequired() ? "Start by confirming your email, then explore" : "Explore"} your membership and wallet at your own pace.` : "Your balances, Trading with Harry allocations and actual recorded results, together in one place."} eyebrow="MEMBER OVERVIEW"><Link prefetch={false} href="/wallet#add-funds" className="btn-gold"><PortalIcon name="plus" />Add funds</Link></PortalHeading>
    {purchase && <div role="status" className="portal-banner">Your membership purchase is complete. Your plan and available credit have been updated.</div>}
    {emailVerificationRequired() && !user.emailVerifiedAt && <div className="mb-5"><VerifyBanner email={user.email} deliveryAvailable={emailDelivers()} deliveryFailed={params.verification === "unavailable"} /></div>}
    {user.walletFrozen && <p role="alert" className="portal-notice-error mb-5">Your wallet is under review. Financial actions are paused. <Link prefetch={false} href="/support" className="underline">Contact support</Link>.</p>}
    {(snapshot.pendingDepositCount > 0 || snapshot.pendingCount > 0) && <div className="portal-banner"><span><strong className="text-gold-300">Manual review in progress.</strong> {snapshot.pendingDepositCount} deposit{snapshot.pendingDepositCount === 1 ? "" : "s"} and {snapshot.pendingCount} allocation request{snapshot.pendingCount === 1 ? "" : "s"} awaiting review. Pending deposits are not included in your available balance.</span><Link prefetch={false} href="/wallet">View deposit status →</Link></div>}
    <div className="portal-overview-grid"><div><PortfolioOverview snapshot={snapshot} /></div><div className="portal-stack">
      <section className="portal-panel"><div className="portal-harry"><div><p className="portal-eyebrow">EXPERIENCE BEHIND THE INSIGHT</p><h2>Trading with Harry</h2><p className="portal-small mt-2">40+ years reading horses and riders. A dedicated allocation with a clear record.</p></div><HostPortrait /></div><div className="portal-divider" /><div className="flex items-center justify-between gap-3"><span className="portal-pill gold">33-day lock from approval</span><Link prefetch={false} className="portal-small text-gold-300" href="/allocations">Explore →</Link></div></section>
      <section className="portal-panel"><div className="portal-panel-heading"><h2>Your membership</h2><PortalIcon name="plans" /></div><p className="text-2xl font-medium tracking-tight">{subscription?.plan.name ?? "Paddock"}</p><p className="portal-small mt-2">{subscription ? `Access until ${dateTimeUtc(subscription.endsAt)} UTC. No automatic renewal.` : "Your free club account is ready. Form Room is the membership built around Trading with Harry access."}</p><Link prefetch={false} href="/membership" className="btn-ghost mt-5 w-full">{subscription ? "Manage membership" : "Explore membership"}</Link></section>
      <section className="portal-panel"><p className="portal-eyebrow">A CLEAR PROCESS</p><ol className="portal-checklist"><li><span><PortalIcon name="wallet" /></span><div><strong>Fund your club wallet</strong>Report your transfer for manual approval.</div></li><li><span><PortalIcon name="trading" /></span><div><strong>Follow your allocation</strong>Approval starts the 33-day lock.</div></li><li><span><PortalIcon name="performance" /></span><div><strong>View actual results</strong>Profit and loss appear after they are recorded.</div></li></ol></section>
    </div></div>
    <div className="portal-overview-grid portal-section"><section className="portal-panel"><div className="portal-panel-heading"><div><h2>Your allocations</h2><p className="portal-small mt-1">Principal, lock dates and payout progress</p></div><Link prefetch={false} href="/allocations">View all →</Link></div>{allocations.length ? allocations.map(allocation => <AllocationCard key={allocation.id} allocation={allocation} />) : <EmptyState title="No open allocations">Explore the planned service and its current availability.<br /><Link prefetch={false} className="btn-ghost mt-4" href="/allocations">Trading with Harry</Link></EmptyState>}<p className="portal-section-note">The lock ending does not mean payment has been sent. Every payout is recorded after an admin verifies the external transfer.</p></section><ResultsCalendar points={snapshot.series} asOf={snapshot.asOf} /></div>
    <section className="portal-panel portal-section"><div className="portal-panel-heading"><div><h2>Recent account activity</h2><p className="portal-small mt-1">A traceable record of your club funds</p></div><Link prefetch={false} href="/activity">Full history →</Link></div><ActivityTable rows={activity[0]?.activity.rows ?? []} /></section>
    <p className="portal-section-note">Updated {dateTimeUtc(snapshot.asOf)} UTC · refreshes every minute while visible. Account value is a club accounting total, not an on-chain token balance or a live market valuation.</p>
  </>;
}
