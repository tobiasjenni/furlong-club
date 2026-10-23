import { requireUser } from "@/lib/auth";
import { PortalHeading } from "@/components/v2/PortalCommon";
import { upcomingSyndicates } from "@/lib/syndicate-data";
import { AllocationPlanner } from "@/components/v2/AllocationPlanner";
export const metadata = { title: "28-day allocation planner" };
export default async function PortalPlanner() {
  const [user, schedule] = await Promise.all([requireUser(), upcomingSyndicates()]);
  return <><PortalHeading title="28-day allocation planner" description="Choose a published moon entry and explore its capital requirement and maturity. This is separate from your actual account performance." /><AllocationPlanner availableCents={user.balanceCents} entries={schedule.entries} /></>;
}
