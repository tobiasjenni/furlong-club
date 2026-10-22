"use client";
import { usePathname } from "next/navigation";
import { isMemberPath } from "@/lib/member-routes";

export function SiteChrome({ children, header, footer }: { children: React.ReactNode; header: React.ReactNode; footer: React.ReactNode }) {
  const path = usePathname();
  const portal = isMemberPath(path) || path === "/entrance" || (path === "/login" && header === null);
  // Keep the content boundary stable when navigating between the website and portal.
  return <>{!portal && header}<main id="main-content" tabIndex={-1} className={`min-w-0 flex-1 ${portal ? "" : "public-v2"}`}>{children}</main>{!portal && footer}</>;
}
