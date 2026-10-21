import { PortalShell } from "@/components/v2/PortalShell";
import { AutoRefresh } from "@/app/checkout/pay/[id]/AutoRefresh";
import { portalData } from "@/lib/portal-data";
import { privateMetadata } from "@/lib/seo";
import { isAdmin } from "@/lib/roles";
import "./portal.css";

export const metadata = { ...privateMetadata, title: { default: "Member overview · V2", template: "%s · Furlong V2" } };
export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, subscription } = await portalData();
  return <PortalShell name={user.name ?? "Member"} admin={isAdmin(user.role)} plan={subscription?.plan.name ?? "Paddock · Free"}><AutoRefresh seconds={30} />{children}</PortalShell>;
}
