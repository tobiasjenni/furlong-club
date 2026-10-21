import { portalData } from "@/lib/portal-data";
import { PortalHeading } from "@/components/v2/PortalCommon";
import { AllocationPlanner } from "@/components/v2/AllocationPlanner";
export const metadata = { title: "33-day allocation planner" };
export default async function PortalPlanner() {
  const { snapshot } = await portalData();
  return <><PortalHeading title="33-day allocation planner" description="Explore the capital requirement and lock dates with a scenario you choose. These figures are separate from your recorded account performance." /><AllocationPlanner availableCents={snapshot.availableCents} today={snapshot.asOf.slice(0, 10)} /></>;
}
