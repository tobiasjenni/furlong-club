import { privateMetadata } from "@/lib/seo";
import { roleLabel } from "@/lib/roles";
import { PortalShell } from "@/components/v2/PortalShell";
import { PortalHeading } from "@/components/v2/PortalCommon";
import { requireAdmin } from "@/lib/auth";
import { Suspense } from "react";
import { adminCounts } from "@/lib/admin-data";
import { AdminNotices } from "@/components/AdminNotices";
import "../(member)/portal.css";
import "@/components/workspace-controls.css";

export const metadata = { ...privateMetadata, title: { default: "Admin", template: "%s · Admin" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <PortalShell name={admin.name ?? "Admin"} admin plan={roleLabel(admin.role)} workspace="admin">
      <PortalHeading title="Back office" eyebrow="PRIVATE CLUB OPERATIONS" description="Members, funding, syndicate entries and recorded results in one workspace."><span className="workspace-role-badge">{roleLabel(admin.role)}</span></PortalHeading>
      {admin.role === "ADMIN" && <p className="portal-banner" role="status">Read-only access. You can view club records. Only the Super Admin can approve deposits or make changes. Your personal security settings remain available.</p>}
      <Suspense fallback={null}><Notifications canApprove={admin.role === "SUPER_ADMIN"} /></Suspense>
      {children}
    </PortalShell>
  );
}

async function Notifications({ canApprove }: { canApprove: boolean }) {
  return <AdminNotices initial={await adminCounts()} canApprove={canApprove} />;
}
