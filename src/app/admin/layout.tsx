import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users & CRM" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/videos", label: "Videos" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/audit", label: "Audit log" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="container-page py-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="badge bg-gold-400 text-turf-950">Admin</span>
        <h1 className="text-2xl">Back office</h1>
      </div>
      <nav className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className="btn-ghost shrink-0 px-4 py-2">{n.label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
