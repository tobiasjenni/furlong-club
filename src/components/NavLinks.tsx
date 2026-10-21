"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type NavLink = { href: string; label: string };

function isActive(pathname: string, href: string) {
  if (href.includes("#")) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="hidden items-center gap-1 text-sm xl:flex">
      {links.map((l) => {
        const active = isActive(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-3 py-2 transition ${active ? "bg-white/10 text-gold-300" : l.href === "/trading" ? "bg-gold-400/10 font-semibold text-gold-300 hover:bg-gold-400/20" : "text-cream/75 hover:text-gold-300"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

// Mobile menu built on <details> so it works without JavaScript; closes itself on navigation and outside taps.
export function MobileMenu({ links, children }: { links: NavLink[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    ref.current?.removeAttribute("open");
  }, [pathname]);

  useEffect(() => {
    const close = (e: MouseEvent | KeyboardEvent) => {
      const el = ref.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node)) {
        el.removeAttribute("open");
        if (e instanceof KeyboardEvent) el.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  return (
    <details ref={ref} className="group relative xl:hidden">
      <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full border border-white/15 [&::-webkit-details-marker]:hidden" aria-label="Menu">
        <svg viewBox="0 0 24 24" className="h-5 w-5 group-open:hidden" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        <svg viewBox="0 0 24 24" className="hidden h-5 w-5 group-open:block" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </summary>
      <div className="absolute right-0 mt-2 max-h-[calc(100dvh-6rem)] w-64 overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-turf-900 p-2 shadow-2xl" onClick={event => { if ((event.target as HTMLElement).closest("a, button")) ref.current?.removeAttribute("open"); }}>
        {links.map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={`block rounded-xl px-3 py-3 text-sm hover:bg-white/5 ${active ? "bg-white/5 text-gold-300" : l.href === "/trading" ? "bg-gold-400/10 font-semibold text-gold-300" : ""}`}>
              {l.label}
            </Link>
          );
        })}
        <div className="my-2 border-t border-white/10" />
        {children}
      </div>
    </details>
  );
}
