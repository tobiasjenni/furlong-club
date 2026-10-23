import { privateMetadata } from "@/lib/seo";
import { roleLabel } from "@/lib/roles";
import { AdminNavigation } from "@/components/AdminNavigation";
import { requireAdmin } from "@/lib/auth";
import { Suspense } from "react";
import { adminCounts } from "@/lib/admin-data";
import { AdminNotices } from "@/components/AdminNotices";

export const metadata = { ...privateMetadata, title: { default: "Admin", template: "%s · Admin" } };

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users & CRM" },
  { href: "/admin/deposits", label: "Deposits" },
  { href: "/admin/trading", label: "Trading allocations" },
  { href: "/admin/syndicates", label: "Moon calendar" },
  { href: "/admin/results", label: "Daily performance" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/wallet", label: "Wallet & reconciliation" },
  { href: "/admin/videos", label: "Videos" },
  { href: "/admin/plans", label: "Future subscriptions" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/security", label: "Security" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="container-page py-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="badge bg-gold-400 text-turf-950">{roleLabel(admin.role)}</span>
        <h1 className="text-2xl">Back office</h1>
      </div>
      {admin.role === "ADMIN" && <p className="card mb-6 text-sm" role="status">Read-only access. You can view club records. Only the Super Admin can approve deposits or make changes. Your personal security settings remain available.</p>}
      <AdminNavigation links={nav} />
      <Suspense fallback={null}><Notifications /></Suspense>
      {children}
    </div>
  );
}

async function Notifications() {
  return <AdminNotices initial={await adminCounts()} />;
}
