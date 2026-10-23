import type { PortalIconName } from "@/components/v2/PortalIcon";

export type WorkspaceKind = "member" | "admin";
export type WorkspaceLink = { href: string; label: string; icon: PortalIconName };

export const memberNavigation: WorkspaceLink[] = [
  { href: "/dashboard", label: "Overview", icon: "overview" },
  { href: "/allocations", label: "Trading with Rob", icon: "trading" },
  { href: "/performance", label: "Results & profit", icon: "performance" },
  { href: "/activity", label: "Transactions", icon: "activity" },
  { href: "/planner", label: "28-day planner", icon: "clock" },
  { href: "/wallet", label: "Wallet & deposits", icon: "wallet" },
  { href: "/membership", label: "Future subscriptions", icon: "plans" },
  { href: "/videos", label: "Video library", icon: "video" },
  { href: "/account", label: "Account & security", icon: "account" },
  { href: "/support", label: "Help & support", icon: "support" },
];

export const adminNavigation: WorkspaceLink[] = [
  { href: "/admin", label: "Overview", icon: "overview" },
  { href: "/admin/users", label: "Users & CRM", icon: "users" },
  { href: "/admin/deposits", label: "Deposits", icon: "wallet" },
  { href: "/admin/trading", label: "Trading allocations", icon: "trading" },
  { href: "/admin/syndicates", label: "Moon calendar", icon: "moon" },
  { href: "/admin/results", label: "Daily performance", icon: "performance" },
  { href: "/admin/payments", label: "Payments", icon: "activity" },
  { href: "/admin/wallet", label: "Wallet & reconciliation", icon: "wallet" },
  { href: "/admin/videos", label: "Videos", icon: "video" },
  { href: "/admin/plans", label: "Future subscriptions", icon: "plans" },
  { href: "/admin/audit", label: "Audit log", icon: "audit" },
  { href: "/admin/security", label: "Security", icon: "security" },
];

export function isAdminWorkspacePath(path: string) {
  return path === "/admin" || path.startsWith("/admin/");
}

export function workspaceLinkActive(path: string, href: string) {
  return path === href || href !== "/admin" && href !== "/dashboard" && path.startsWith(href + "/");
}
