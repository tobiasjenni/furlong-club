import { currentUser } from "@/lib/auth";
import { SubscriptionsComingSoon } from "@/components/SubscriptionsComingSoon";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";
export const metadata = pageMetadata("/plans");
export const dynamic = "force-dynamic";
export default async function PlansPage() {
 const user = await currentUser();
 return <div className="container-page max-w-4xl space-y-6 py-12 md:py-16"><Breadcrumbs path="/plans" label="Subscriptions coming soon" /><h1 className="text-4xl">More from the club. Coming soon.</h1><p className="muted max-w-2xl">We are focusing on Trading with Rob. Create your free account to view the funding process, request an allocation and follow its progress.</p><SubscriptionsComingSoon member={Boolean(user)} /></div>;
}
