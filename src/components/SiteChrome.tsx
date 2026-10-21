"use client";
import { usePathname } from "next/navigation";

export function SiteChrome({ children, header, footer }: { children: React.ReactNode; header: React.ReactNode; footer: React.ReactNode }) {
  const path = usePathname();
  const portal = path === "/v2" || path.startsWith("/v2/");
  return <>{!portal && header}<main id="main-content" tabIndex={-1} className="min-w-0 flex-1">{children}</main>{!portal && footer}</>;
}
