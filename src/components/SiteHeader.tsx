import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { currentUser } from "@/lib/auth";
import { brand } from "@/lib/config";
import { Logo } from "./Logo";

export async function SiteHeader() {
  const user = await currentUser();
  const links = user
    ? [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/videos", label: "Videos" },
        { href: "/wallet", label: "Wallet" },
        { href: "/account", label: "Account" },
        ...(user.role === "ADMIN" ? [{ href: "/admin", label: "Admin" }] : []),
      ]
    : [
        { href: "/#how", label: "How it works" },
        { href: "/plans", label: "Plans" },
        { href: "/about-rob", label: "Meet Rob" },
      ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-turf-950/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${brand.name} home`}>
          <Logo className="h-8 w-8" />
          <span className="font-display text-lg font-semibold">{brand.name}</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-cream/75 hover:text-gold-300">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <form action={logout}>
              <button className="btn-ghost">Sign out</button>
            </form>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">Sign in</Link>
              <Link href="/signup" className="btn-gold">Join free</Link>
            </>
          )}
        </div>

        <details className="group relative md:hidden">
          <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-white/15" aria-label="Menu">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </summary>
          <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/10 bg-turf-900 p-2 shadow-2xl">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="block rounded-xl px-3 py-2.5 text-sm hover:bg-white/5">
                {l.label}
              </Link>
            ))}
            <div className="my-2 border-t border-white/10" />
            {user ? (
              <form action={logout}>
                <button className="w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/5">Sign out</button>
              </form>
            ) : (
              <>
                <Link href="/login" className="block rounded-xl px-3 py-2.5 text-sm hover:bg-white/5">Sign in</Link>
                <Link href="/signup" className="btn-gold mt-1 w-full">Join free</Link>
              </>
            )}
          </div>
        </details>
      </div>
    </header>
  );
}
