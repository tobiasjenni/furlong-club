import Link from "next/link";
import type { Plan } from "@prisma/client";
import { usd } from "@/lib/format";

export function PlanCard({ plan, highlight = false, cta, availableVideos }: { plan: Plan; highlight?: boolean; cta?: { href: string; label: string }; availableVideos?: number }) {
  return (
    <div className={`card flex flex-col ${highlight ? "border-gold-400/60 ring-1 ring-gold-400/40" : ""}`}>
      {highlight && <span className="badge mb-3 w-fit bg-gold-400 text-turf-950">Recommended</span>}
      <h3 className="text-2xl">{plan.name}</h3>
      <p className="muted mt-1 text-sm">{plan.tagline}</p>
      <p className="mt-5 flex items-baseline gap-1">
        <span className="font-display text-4xl">{plan.priceCents === 0 ? "Free" : usd(plan.priceCents)}</span>
        {plan.priceCents > 0 && <span className="muted text-sm">/ {plan.intervalDays} days</span>}
      </p>
      {plan.priceCents > 0 && <p className="muted mt-1 text-xs">One payment · No automatic renewal</p>}
      {availableVideos !== undefined && <p className={`mt-3 text-xs ${availableVideos ? "text-emerald-300" : "text-gold-300"}`}>{availableVideos ? `${availableVideos} video${availableVideos === 1 ? "" : "s"} ready to watch` : "Video library in preparation"}</p>}
      <ul className="mt-5 flex-1 space-y-2.5 text-sm">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2">
            <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" fill="currentColor"><path d="M8 13.6 4.4 10l-1.4 1.4L8 16.4l9-9L15.6 6z" /></svg>
            <span className="text-cream/85">{f}</span>
          </li>
        ))}
      </ul>
      {cta && (
        <Link href={cta.href} className={`${highlight ? "btn-gold" : "btn-ghost"} mt-6 w-full`}>
          {cta.label}
        </Link>
      )}
    </div>
  );
}
