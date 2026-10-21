import Link from "next/link";
import { HostPortrait } from "@/components/HostPortrait";
import { brand } from "@/lib/config";

export const metadata = { title: `Meet ${brand.host.name}`, description: "More than 40 years of experience reading horses and riders. Meet Harry Whitcombe, the host of Furlong Club." };

export default function MeetHost() {
  return <div className="container-page grid gap-10 py-12 md:grid-cols-[1fr_1.3fr] md:py-16">

    <article className="order-1 space-y-5 text-cream/85 md:order-2">
      <p className="text-sm text-gold-300">Experience behind the insight</p><h1 className="text-3xl text-cream sm:text-4xl">Meet {brand.host.name}</h1>
      <p className="text-lg leading-relaxed">More than 40 years of reading horses and riders, brought to Furlong Club.</p>
      <p>Harry looks beyond a set of form figures. His experience centres on understanding the horse, the rider and how they work together in the conditions of a race.</p>
      <h2 className="pt-2 text-2xl text-cream">Learn what to look for</h2>
      <p>Look at how a horse moves, how its rider responds and what the pace, going and draw may mean for the pair. Put those observations alongside the form to build a more considered view of a race.</p>
      <p>Explore the club&apos;s video catalogue and its availability before choosing a plan. Racing outcomes remain uncertain, and no amount of experience can promise a winning result.</p>
      <h2 className="pt-4 text-2xl text-cream">Trading with Harry</h2>
      <p>We are preparing a separate trading allocation service with a proposed $500–$10,000 range and a 33-day lock beginning on admin approval. Its proposed daily target is provisional and unverified. Real trading enrollment is closed while final terms are prepared.</p>
      <p>Trading can result in losses, including loss of the full allocation. Any eventual payout depends on actual results and manual processing; the website does not execute trades or send payouts automatically.</p>
      <div className="flex flex-wrap gap-3"><Link href="/trading" className="btn-ghost">View the trading proposal</Link><Link href="/signup" className="btn-gold">Join Furlong Club</Link></div>
    </article>
    <div className="order-2 md:order-1"><HostPortrait className="mx-auto w-full max-w-sm shadow-2xl" /><div className="mx-auto mt-5 max-w-sm rounded-2xl border border-gold-400/25 bg-gold-400/5 p-5 text-center"><p className="font-display text-4xl text-gold-300">40+ years</p><p className="muted mt-2 text-sm">Reading horses. Understanding riders. Studying the race.</p></div></div>
  </div>;
}
