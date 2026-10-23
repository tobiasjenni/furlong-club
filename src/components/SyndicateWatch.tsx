"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { countdownParts, entryDate, moonPhaseName, nextSyndicateEntry, type SyndicateEntry } from "@/lib/syndicate";
import "./syndicate-watch.css";

export function SyndicateWatch({ entries, asOf, member = false }: { entries: SyndicateEntry[]; asOf: string; member?: boolean }) {
  const [now, setNow] = useState(() => Date.parse(asOf));
  useEffect(() => { const update = () => setNow(Date.now()); update(); const timer = setInterval(update, 1000); return () => clearInterval(timer); }, []);
  const upcoming = entries.filter(entry => Date.parse(entry.startsAt) > now);
  const next = nextSyndicateEntry(entries, now);
  const time = next ? countdownParts(next.startsAt, now) : null;
  return <section className="syndicate-watch" aria-label="Syndicate horse watch">
    <div className="syndicate-watch-top"><span><i /> THE SYNDICATE HORSE WATCH</span><span className="syndicate-watch-zone">UTC</span></div>
    <div className="syndicate-watch-face">
      <svg viewBox="0 0 160 170" className="syndicate-watch-dial" aria-hidden="true">
        <circle cx="80" cy="85" r="68" fill="none" stroke="currentColor" strokeOpacity=".16" />
        {Array.from({ length: 28 }, (_, i) => <line key={i} x1="80" y1="20" x2="80" y2={i % 7 === 0 ? "29" : "24"} transform={`rotate(${i * 360 / 28} 80 85)`} stroke="currentColor" strokeWidth={i % 7 === 0 ? 2 : 1} />)}
        <path d="M44 45C36 56 33 70 35 88C38 112 54 128 80 128C106 128 122 112 125 88C127 70 124 56 116 45L102 52C108 61 111 73 109 86C107 104 97 113 80 113C63 113 53 104 51 86C49 73 52 61 58 52Z" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M68 96V82L60 84L55 77L69 62L73 52L80 60L86 55L88 68L100 78L97 96M70 83L81 77L87 83L85 96" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx="77" cy="68" r="1.7" fill="currentColor" />
        <circle cx="80" cy="153" r="6" fill={next?.phase === "FULL" ? "currentColor" : "none"} stroke="currentColor" />
      </svg>
      <div><p className="syndicate-watch-kicker">THE NEXT SHARED START</p><h2>{next ? moonPhaseName(next.phase) + " entry" : "Next entry to be announced"}</h2><p className="syndicate-watch-date">{next ? entryDate(next.startsAt) + " · 00:00 UTC" : "Published entry dates will appear here."}</p><span className="syndicate-watch-period">28-day trading period</span></div>
    </div>
    {time && <div className="syndicate-watch-countdown" aria-label="Time until the next syndicate start" aria-live="off">{Object.entries(time).map(([label, value]) => <div key={label}><strong>{String(value).padStart(2, "0")}</strong><span>{label}</span></div>)}</div>}
    <div className="syndicate-watch-entries">{upcoming.slice(0, 2).map((entry, i) => <div key={entry.id}><span className={`syndicate-moon ${entry.phase.toLowerCase()}`} aria-hidden="true" /><div><span>{i === 0 ? "NEXT ENTRY" : "FOLLOWING ENTRY"} · {moonPhaseName(entry.phase)}</span><strong>{entryDate(entry.startsAt)}</strong><small>28-day period ends {entryDate(entry.endsAt)}</small></div></div>)}</div>
    <p className="syndicate-watch-note">One full-moon and one new-moon entry each month. Starts at 00:00 UTC on the published dates. Funds must be approved before entry; approval reserves capital until the scheduled start and 28-day maturity.</p>
    <Link prefetch={false} className="syndicate-watch-link" href={member ? "/allocations#request" : "/signup?next=%2Fallocations"}>{member ? "Choose your syndicate entry" : "Join Trading with Rob"}<span aria-hidden="true">↗</span></Link>
  </section>;
}
