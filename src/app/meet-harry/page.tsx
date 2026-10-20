import Link from "next/link";
import { HostPortrait } from "@/components/HostPortrait";
import { brand } from "@/lib/config";

export const metadata = { title: `Meet ${brand.host.name}` };

export default function MeetHost() {
  return (
    <div className="container-page grid gap-10 py-12 md:grid-cols-[1fr_1.3fr] md:py-16">
      <div>
        <HostPortrait className="mx-auto w-full max-w-sm shadow-2xl" />
        <div className="mt-4 rounded-xl border border-gold-400/30 bg-gold-400/5 p-4 text-sm text-cream/80">
          <strong className="text-gold-300">Please note:</strong> {brand.host.name} is a fictional character and the host of
          {brand.name}. He is not a real person, and his portrait is AI-generated. Our videos are researched and scripted by the {brand.name} team.
        </div>
      </div>
      <article className="space-y-5 text-cream/80">
        <h1 className="text-4xl text-cream">{brand.host.first}&apos;s story</h1>
        <p>
          Picture a grey Saturday at a London-area track: steam off the paddock, the smell of chips, and a man in a tweed
          flat cap studying the parade ring through a pair of battered binoculars. That&apos;s Harry Whitcombe: a Londoner in his mid-fifties who has spent more Saturdays at the races than he&apos;d care to count.
        </p>
        <p>
          We created Harry to be the guide we wish we&apos;d had when we started following racing: patient, a little dry, and
          obsessed with the details most people skip. How a horse handles soft ground. Why a high draw matters at Chester.
          What a trainer&apos;s recent run of form is really telling you.
        </p>
        <p>
          In the {brand.name} videos, Harry walks you through the fundamentals first, then joins members on race days to talk
          through the big cards before the off. He&apos;ll always tell you what he thinks and why, and he&apos;ll always remind
          you that no one wins every race.
        </p>
        <h2 className="pt-4 text-2xl text-cream">What {brand.host.first} won&apos;t do</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Promise you profits or quote you return figures.</li>
          <li>Place bets for you or hold your money to bet with.</li>
          <li>Encourage you to chase losses. If it stops being fun, stop.</li>
        </ul>
        <Link href="/signup" className="btn-gold mt-4">Watch {brand.host.first}&apos;s intro free</Link>
      </article>
    </div>
  );
}
