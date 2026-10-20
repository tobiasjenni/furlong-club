import Link from "next/link";
import { HostPortrait } from "@/components/HostPortrait";
import { brand } from "@/lib/config";

export const metadata = { title: `Meet ${brand.host.name}` };

export default function MeetHost() {
  return <div className="container-page grid gap-10 py-12 md:grid-cols-[1fr_1.3fr] md:py-16">
    <div><HostPortrait className="mx-auto w-full max-w-sm shadow-2xl" /><p className="muted mt-4 text-center text-xs">AI-generated illustration for {brand.host.name}; not a photograph.</p></div>
    <article className="space-y-5 text-cream/80">
      <p className="text-sm text-gold-300">Your Furlong Club host</p><h1 className="text-4xl text-cream">Meet {brand.host.name}</h1>
      <p>{brand.host.name} is the host of Furlong Club. Join Harry for racing education, race-day analysis and a closer look at the form.</p>
      <p>Explore the member videos to follow Harry&apos;s approach to race cards, conditions and staking discipline. Racing outcomes are uncertain, and no analysis can promise a winning result.</p>
      <h2 className="pt-4 text-2xl text-cream">Trading with Harry</h2>
      <p>We are preparing a separate trading allocation service with a proposed $500–$10,000 range and a 33-day lock beginning on admin approval. Its proposed daily target is provisional and unverified. Real trading enrollment is closed while final terms are prepared.</p>
      <p>Trading can result in losses, including loss of the full allocation. Any eventual payout depends on actual results and manual processing; the website does not execute trades or send payouts automatically.</p>
      <div className="flex flex-wrap gap-3"><Link href="/trading" className="btn-ghost">View the trading proposal</Link><Link href="/signup" className="btn-gold">Join Furlong Club</Link></div>
    </article>
  </div>;
}
