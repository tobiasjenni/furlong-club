"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNavigation({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return <nav aria-label="Admin workspace" className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1">{links.map(link => {
    const active = path === link.href || link.href !== "/admin" && path.startsWith(link.href + "/");
    return <Link prefetch={false} key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={`btn-ghost shrink-0 px-4 py-2 ${active ? "border-gold-400/50 bg-gold-400/10 text-gold-300" : ""}`}>{link.label}</Link>;
  })}</nav>;
}
