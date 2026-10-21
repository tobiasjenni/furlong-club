"use client";
import Link from "next/link";
import { useState } from "react";
import type { PortalPoint } from "@/lib/portal-metrics";
import { usd } from "@/lib/format";
const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function ResultsCalendar({ points, asOf }: { points: PortalPoint[]; asOf: string }) {
  const now = new Date(asOf);
  const current = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const [month, setMonth] = useState(current);
  const [selected, setSelected] = useState<string | null>(null);
  const first = new Date(month);
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const byDay = new Map(points.map(point => [point.day, point]));
  const selectedPoint = selected ? byDay.get(selected) : null;
  const monthResults = points.filter(point => point.day.startsWith(first.toISOString().slice(0, 7))).reduce((sum, point) => sum + point.resultCount, 0);
  const move = (delta: number) => { setMonth(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + delta, 1)); setSelected(null); };
  const oldest = points[0]?.day ? new Date(points[0].day + "T00:00:00Z") : now;
  const minMonth = Date.UTC(oldest.getUTCFullYear(), oldest.getUTCMonth(), 1);
  return <section className="portal-panel" aria-label="Recorded results calendar"><div className="portal-panel-heading"><div><h2>Results calendar</h2><p className="portal-small mt-1">Actual allocation results · USD · UTC</p></div><span className="portal-pill green">{monthResults} result{monthResults === 1 ? "" : "s"}</span></div><div className="portal-calendar-header"><button className="portal-icon-button" aria-label="Previous month" disabled={month <= minMonth} onClick={() => move(-1)}>‹</button><span className="text-sm">{new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(first)}</span><button className="portal-icon-button" aria-label="Next month" disabled={month >= current} onClick={() => move(1)}>›</button></div>
    <div className="portal-calendar">{["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(day => <span key={day} className="portal-weekday">{day}</span>)}{Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}{Array.from({ length: count }, (_, i) => { const date = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), i + 1)); const key = date.toISOString().slice(0, 10); const point = byDay.get(key); const hasResult = (point?.resultCount ?? 0) > 0; return <button key={key} className={`portal-day ${hasResult ? (point!.dailyProfitCents < 0 ? "has-loss" : "has-result") : ""}`} disabled={key > asOf.slice(0, 10)} aria-label={`${key}, ${hasResult ? `${point!.resultCount} recorded result${point!.resultCount === 1 ? "" : "s"}, ${usd(point!.dailyProfitCents)} net` : "no recorded result"}`} aria-pressed={selected === key} onClick={() => setSelected(selected === key ? null : key)}><span>{i + 1}</span><small>{hasResult ? `${point!.dailyProfitCents >= 0 ? "+" : ""}${compactNumber.format(point!.dailyProfitCents / 100)}` : "—"}</small></button>; })}</div>
    <div className="portal-calendar-detail">{selected ? <><strong>{selected}</strong><p className={selectedPoint && selectedPoint.dailyProfitCents < 0 ? "portal-negative" : "portal-positive"}>{selectedPoint?.resultCount ? `${selectedPoint.resultCount} result${selectedPoint.resultCount === 1 ? "" : "s"} · ${usd(selectedPoint.dailyProfitCents)} net` : "No allocation result recorded on this date."}</p>{!!selectedPoint?.resultCount && <Link href={`/v2/performance?day=${selected}#results`} className="text-gold-300 underline underline-offset-4">View the recorded results →</Link>}</> : <p>Select a date to see its recorded results. A blank day means no result was recorded; it does not represent a zero-return trading day.</p>}</div>
  </section>;
}
