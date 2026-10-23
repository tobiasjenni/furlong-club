import { PortalShell } from "@/components/v2/PortalShell";
import { requireUser } from "@/lib/auth";
import { privateMetadata } from "@/lib/seo";
import { isAdmin } from "@/lib/roles";
import "./portal.css";
import "@/components/workspace-controls.css";

export const metadata = { ...privateMetadata, title: { default: "Member overview", template: "%s · Furlong Club" } };
export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <PortalShell name={user.name ?? "Member"} admin={isAdmin(user.role)} plan="Free club account">{children}</PortalShell>;
}
