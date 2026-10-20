import Link from "next/link";
import { brand } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-white/10 bg-turf-950">
      <div className="container-page grid gap-8 py-10 text-sm md:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-3">
          <p className="font-display text-base text-cream">{brand.name}</p>
          <p className="muted max-w-md">
            Horse racing education and opinion. Nothing here is financial advice or a promise of winnings. Betting involves
            risk and you can lose the money you stake. Only bet what you can afford to lose.
          </p>
          <p className="muted max-w-md">
            Rob is a fictional character and the brand mascot of {brand.name}. The videos are made by our team of racing
            analysts.
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-cream">Company</p>
          <Link href="/about-rob" className="muted block hover:text-gold-300">Meet Rob</Link>
          <Link href="/plans" className="muted block hover:text-gold-300">Plans</Link>
          <a href={`mailto:${brand.supportEmail}`} className="muted block hover:text-gold-300">Support</a>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-cream">Legal</p>
          <Link href="/legal/terms" className="muted block hover:text-gold-300">Terms</Link>
          <Link href="/legal/privacy" className="muted block hover:text-gold-300">Privacy</Link>
          <Link href="/legal/responsible-gambling" className="muted block hover:text-gold-300">Responsible gambling</Link>
        </div>
      </div>
      <div className="border-t border-white/5">
        <div className="container-page flex flex-col gap-2 py-4 text-xs text-cream/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {brand.name}. All rights reserved.</p>
          <p className="flex items-center gap-2">
            <span className="badge border border-cream/30 text-cream/70">18+</span>
            Gambling can be addictive. Help: <a className="underline" href="https://www.begambleaware.org" target="_blank" rel="noreferrer">BeGambleAware.org</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
