import { privateMetadata } from "@/lib/seo";
import { roleLabel } from "@/lib/roles";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Suspense } from "react";
import { adminCounts } from "@/lib/admin-data";
import { AdminNotices } from "@/components/AdminNotices";

export const metadata = { ...privateMetadata, title: { default: "Admin", template: "%s · Admin" } };

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users & CRM" },
  { href: "/admin/deposits", label: "Deposit approvals" },
  { href: "/admin/trading", label: "Trading allocations" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/wallet", label: "Wallet & reconciliation" },
  { href: "/admin/videos", label: "Videos" },
  { href: "/admin/plans", label: "Plans" },
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
      <nav className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className="btn-ghost shrink-0 px-4 py-2">{n.label}</Link>
        ))}
      </nav>
      <Suspense fallback={null}><Notifications /></Suspense>
      {children}
    </div>
  );
}

async function Notifications() {
  return <AdminNotices initial={await adminCounts()} />;
}
