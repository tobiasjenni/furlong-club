"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { BrandLogo } from "@/components/Logo";
import { logout } from "@/app/actions/auth";
import { PortalIcon } from "./PortalIcon";
import { SubmitButton } from "@/components/SubmitButton";
import { adminNavigation, memberNavigation, workspaceLinkActive, type WorkspaceKind } from "@/lib/workspace-navigation";

export function PortalShell({ children, name, admin, plan, workspace = "member" }: { children: React.ReactNode; name: string; admin: boolean; plan: ReactNode; workspace?: WorkspaceKind }) {
  const path = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  const backOffice = workspace === "admin";
  const kind = backOffice ? "Admin" : "Member";
  const links = backOffice ? adminNavigation : memberNavigation;
  const home = backOffice ? "/admin" : "/dashboard";
  useEffect(() => { menu.current?.removeAttribute("open"); }, [path]);
  useEffect(() => { const close = (event: KeyboardEvent | MouseEvent) => { if (!menu.current?.open) return; if (event instanceof KeyboardEvent ? event.key === "Escape" : !menu.current.contains(event.target as Node)) { menu.current.removeAttribute("open"); if (event instanceof KeyboardEvent) menu.current.querySelector("summary")?.focus(); } }; document.addEventListener("keydown", close); document.addEventListener("click", close); return () => { document.removeEventListener("keydown", close); document.removeEventListener("click", close); }; }, []);
  const navigation = <>{links.map(link => <Link prefetch={false} key={link.href} href={link.href} aria-current={workspaceLinkActive(path, link.href) ? "page" : undefined} className="portal-nav-link"><PortalIcon name={link.icon} /><span>{link.label}</span></Link>)}</>;
  const switcher = backOffice ? <Link prefetch={false} href="/dashboard" className="portal-nav-link"><PortalIcon name="account" /><span>Member workspace ↗</span></Link> : admin ? <Link prefetch={false} href="/admin" className="portal-nav-link"><PortalIcon name="overview" /><span>Admin workspace ↗</span></Link> : null;
  return <div className={`v2-portal workspace-${workspace}`} data-workspace-section={path === home ? "overview" : "detail"}><div className="portal-layout">
    <aside className="portal-sidebar" aria-label={`${kind} navigation`}><Link prefetch={false} href={home} aria-label={`Furlong Club ${workspace} home`} className="portal-brand"><BrandLogo /></Link><p className="portal-nav-caption">{kind.toUpperCase()} WORKSPACE</p><nav aria-label={`${kind} workspace`}>{navigation}</nav><div className="portal-sidebar-bottom"><div className="portal-membership"><span className="portal-dot" />{plan}<span className="portal-small">{backOffice ? "Club operations" : "Your club account"}</span></div>{switcher}<Link prefetch={false} href="/" className="portal-nav-link"><PortalIcon name="arrow" /><span>Public website</span></Link></div></aside>
    <div className="portal-workspace"><header className="portal-topbar"><div className="portal-topbar-title"><span className="portal-dot" /><span>Furlong Club <span className="portal-small">/ {backOffice ? "Administration" : "Member portal"}</span></span></div><Link prefetch={false} href="/account" className="portal-avatar" aria-label={`Account settings for ${name}`}>{name.slice(0, 1).toUpperCase()}</Link><details ref={menu} className="portal-mobile-menu"><summary aria-label={`${kind} menu`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg></summary><nav aria-label={`Mobile ${workspace} workspace`} onClick={event => { if ((event.target as HTMLElement).closest("a,button")) menu.current?.removeAttribute("open"); }}>{navigation}{switcher}<Link prefetch={false} className="portal-nav-link" href="/">Public website</Link><form action={logout}><SubmitButton className="portal-nav-link w-full" pendingLabel="Signing out…">Sign out</SubmitButton></form></nav></details><form action={logout} className="portal-desktop-signout"><SubmitButton className="btn-ghost portal-text-button" pendingLabel="Signing out…">Sign out</SubmitButton></form></header>
      <div className="portal-content">{children}</div><footer className="portal-footer"><span>© {new Date().getUTCFullYear()} Furlong Club · All account times UTC</span><div><Link prefetch={false} href="/legal/terms">Terms</Link><Link prefetch={false} href="/legal/privacy">Privacy</Link><Link prefetch={false} href="/legal/responsible-gambling">Responsible gambling</Link></div></footer>
    </div>
  </div></div>;
}
