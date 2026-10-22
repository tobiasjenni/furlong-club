import { requireUser } from "@/lib/auth";
import { PortalHeading } from "@/components/v2/PortalCommon";
import { AllocationPlanner } from "@/components/v2/AllocationPlanner";
export const metadata = { title: "33-day allocation planner" };
export default async function PortalPlanner() {
  const user = await requireUser();
  return <><PortalHeading title="33-day allocation planner" description="Explore the capital requirement and lock dates with a scenario you choose. These figures are separate from your recorded account performance." /><AllocationPlanner availableCents={user.balanceCents} today={new Date().toISOString().slice(0, 10)} /></>;
}
