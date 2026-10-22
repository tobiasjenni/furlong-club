import { PortalShell } from "@/components/v2/PortalShell";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { portalIdentity } from "@/lib/portal-data";
import { privateMetadata } from "@/lib/seo";
import { isAdmin } from "@/lib/roles";
import "./portal.css";

export const metadata = { ...privateMetadata, title: { default: "Member overview", template: "%s · Furlong Club" } };
export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <PortalShell name={user.name ?? "Member"} admin={isAdmin(user.role)} plan={<Suspense fallback="Membership"><MemberPlan /></Suspense>}>{children}</PortalShell>;
}

async function MemberPlan() {
  const { subscription } = await portalIdentity();
  return subscription?.plan.name ?? "Paddock · Free";
}
