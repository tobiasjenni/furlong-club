import { isAdmin } from "@/lib/roles";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { currentUser } from "@/lib/auth";
import { brand } from "@/lib/config";
import { BrandLogo } from "./Logo";
import { DesktopNav, MobileMenu } from "./NavLinks";

export async function SiteHeader() {
  const user = await currentUser();
  const links = user
    ? [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/trading", label: "Trade with Harry" },
        { href: "/videos", label: "Videos" },
        { href: "/plans", label: "Plans" },
        { href: "/wallet", label: "Wallet" },
        { href: "/account", label: "Account" },
        ...(isAdmin(user.role) ? [{ href: "/admin", label: "Admin" }] : []),
      ]
    : [
        { href: "/trading", label: "Trade with Harry" },
        { href: "/plans", label: "Plans" },
        { href: "/#how", label: "How it works" },
        { href: brand.host.page, label: `Meet ${brand.host.first}` },
      ];
  const initials = (user?.name ?? user?.email ?? "?").trim().slice(0, 1).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-turf-950/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href={user ? "/dashboard" : "/"} className="shrink-0 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-400" aria-label={`${brand.name} home`}>
          <BrandLogo />
        </Link>

        <DesktopNav links={links} />

        <div className="hidden items-center gap-2 xl:flex">
          {user ? (
            <>
              <Link href="/account" aria-label="Account settings" className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-400 text-sm font-bold text-turf-950" title={user.email}>
                {initials}
              </Link>
              <form action={logout}>
                <button className="btn-ghost">Sign out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">Sign in</Link>
              <Link href="/signup" className="btn-gold">Join free</Link>
            </>
          )}
        </div>

        <MobileMenu links={links}>
          {user ? (
            <>
              <p className="truncate px-3 pb-2 text-xs text-cream/50">{user.email}</p>
              <form action={logout}>
                <button className="w-full rounded-xl px-3 py-3 text-left text-sm hover:bg-white/5">Sign out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="block rounded-xl px-3 py-3 text-sm hover:bg-white/5">Sign in</Link>
              <Link href="/signup" className="btn-gold mt-1 w-full">Join free</Link>
            </>
          )}
        </MobileMenu>
      </div>
    </header>
  );
}
