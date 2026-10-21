"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { BrandLogo } from "@/components/Logo";
import { logout } from "@/app/actions/auth";
import { PortalIcon, type PortalIconName } from "./PortalIcon";

const links: { href: string; label: string; icon: PortalIconName }[] = [
  { href: "/v2", label: "Overview", icon: "overview" }, { href: "/v2/trading", label: "Trading with Harry", icon: "trading" },
  { href: "/v2/performance", label: "Results & profit", icon: "performance" }, { href: "/v2/activity", label: "Transactions", icon: "activity" },
  { href: "/v2/planner", label: "33-day planner", icon: "clock" },
  { href: "/v2/wallet", label: "Wallet & deposits", icon: "wallet" }, { href: "/v2/plans", label: "Membership", icon: "plans" },
  { href: "/videos", label: "Video library", icon: "plans" },
  { href: "/v2/account", label: "Account & security", icon: "account" }, { href: "/v2/support", label: "Help & support", icon: "support" },
];

export function PortalShell({ children, name, admin, plan }: { children: React.ReactNode; name: string; admin: boolean; plan: string }) {
  const path = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => { menu.current?.removeAttribute("open"); }, [path]);
  useEffect(() => { const close = (event: KeyboardEvent | MouseEvent) => { if (!menu.current?.open) return; if (event instanceof KeyboardEvent ? event.key === "Escape" : !menu.current.contains(event.target as Node)) { menu.current.removeAttribute("open"); if (event instanceof KeyboardEvent) menu.current.querySelector("summary")?.focus(); } }; document.addEventListener("keydown", close); document.addEventListener("click", close); return () => { document.removeEventListener("keydown", close); document.removeEventListener("click", close); }; }, []);
  const navigation = <>{links.map(link => <Link key={link.href} href={link.href} aria-current={path === link.href || link.href !== "/v2" && path.startsWith(link.href + "/") ? "page" : undefined} className="portal-nav-link"><PortalIcon name={link.icon} /><span>{link.label}</span></Link>)}</>;
  return <div className="v2-portal"><div className="portal-layout">
    <aside className="portal-sidebar" aria-label="Member navigation"><Link href="/v2" aria-label="Furlong Club member home" className="portal-brand"><BrandLogo /></Link><p className="portal-nav-caption">MEMBER WORKSPACE</p><nav aria-label="Member workspace">{navigation}</nav><div className="portal-sidebar-bottom"><div className="portal-membership"><span className="portal-dot" />{plan}<span className="portal-small">Your membership</span></div>{admin && <Link href="/admin" className="portal-nav-link"><PortalIcon name="overview" /><span>Admin workspace ↗</span></Link>}<Link href="/" className="portal-nav-link"><PortalIcon name="arrow" /><span>Public website</span></Link><Link href="/dashboard?classic=1" className="portal-small px-3 py-2">Open classic dashboard ↗</Link></div></aside>
    <div className="portal-workspace"><header className="portal-topbar"><div className="portal-topbar-title"><span className="portal-dot" /><span>Furlong Club <span className="portal-small">/ Member portal</span></span></div><Link href="/v2/account" className="portal-avatar" aria-label={`Account settings for ${name}`}>{name.slice(0, 1).toUpperCase()}</Link><details ref={menu} className="portal-mobile-menu"><summary aria-label="Member menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg></summary><nav aria-label="Mobile member workspace" onClick={event => { if ((event.target as HTMLElement).closest("a,button")) menu.current?.removeAttribute("open"); }}>{navigation}{admin && <Link className="portal-nav-link" href="/admin">Admin workspace ↗</Link>}<Link className="portal-nav-link" href="/">Public website</Link><form action={logout}><button className="portal-nav-link w-full">Sign out</button></form></nav></details><form action={logout} className="portal-desktop-signout"><button className="portal-text-button">Sign out</button></form></header>
      <div className="portal-content">{children}</div><footer className="portal-footer"><span>© {new Date().getUTCFullYear()} Furlong Club · All account times UTC</span><div><Link href="/legal/terms">Terms</Link><Link href="/legal/privacy">Privacy</Link><Link href="/legal/responsible-gambling">Responsible gambling</Link></div></footer>
    </div>
  </div></div>;
}
