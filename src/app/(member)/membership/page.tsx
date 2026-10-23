import { portalIdentity } from "@/lib/portal-data";
import { dateTimeUtc } from "@/lib/format";
import { PortalHeading } from "@/components/v2/PortalCommon";
import { SubscriptionsComingSoon } from "@/components/SubscriptionsComingSoon";
export const metadata = { title: "Subscriptions · Coming soon" };
export default async function PortalPlans() {
 const { subscription } = await portalIdentity();
 return <><PortalHeading title="Subscriptions · Coming soon" description="Your free account gives you access to request Trading with Rob. No paid subscription is required." /><SubscriptionsComingSoon member />{subscription && <section className="portal-panel portal-section"><h2>Existing membership record</h2><p className="portal-small mt-3">{subscription.plan.name} · Access recorded until {dateTimeUtc(subscription.endsAt)} UTC. Your existing access and payment history are retained. New purchases and renewals are paused.</p></section>}</>;
}
