"use client";
import { useState } from 'react';
import { compoundedPercent, cycleWindow, signedPercent, type CycleSummary, type DailyResultPoint } from '@/lib/daily-results';
import './results-calendar.css';

export function ResultsCalendar({ points, asOf, cycle: reportedCycle }: { points: DailyResultPoint[]; asOf: string; cycle?: CycleSummary | null }) {
  const today = asOf.slice(0, 10), now = new Date(asOf);
  const current = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const latest = points.at(-1)?.day;
  const [month, setMonth] = useState(latest ? Date.parse(latest.slice(0, 7) + '-01T00:00:00Z') : current);
  const [selected, setSelected] = useState<string | null>(null);
  const first = new Date(month), prefix = first.toISOString().slice(0, 7);
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const byDay = new Map(points.map(point => [point.day, point]));
  const selectedPoint = selected ? byDay.get(selected) : undefined;
  const monthPoints = points.filter(point => point.day.startsWith(prefix));
  const change = compoundedPercent(monthPoints);
  const earliest = Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1);
  const move = (delta: number) => { setMonth(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + delta, 1)); setSelected(null); };
  const cycle = cycleWindow(latest ?? today);
  const cyclePoints = points.filter(p => p.day >= cycle.start && p.day <= cycle.end);
  const reportDays = reportedCycle?.lockDays ?? 33;
  const reportedWindow = reportedCycle ? cycleWindow(reportedCycle.endDay, reportDays) : null;
  const reportedDays = reportedWindow ? points.filter(p => p.day >= reportedWindow.start && p.day <= reportedWindow.end) : [];
  const reconciled = reportedDays.length === reportDays && Math.abs(compoundedPercent(reportedDays)! - reportedCycle!.profitBps / 100) < 0.005;
  return <section className="results-calendar" aria-label="Club daily percentage results calendar">
    <div className="results-calendar-heading"><div><h2>Results calendar</h2><p>Club daily performance · % · UTC</p></div><span className={`results-calendar-total ${change === null ? '' : change < 0 ? 'loss' : change > 0 ? 'win' : 'flat'}`} aria-label="Compounded change across recorded days in this month">{signedPercent(change)}</span></div>
    <div className="results-calendar-navigation"><button type="button" aria-label="Previous month" disabled={month <= earliest} onClick={() => move(-1)}>‹</button><h3>{new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first)}</h3><button type="button" aria-label="Next month" disabled={month >= current} onClick={() => move(1)}>›</button></div>
    <div className="results-calendar-shortcuts"><button type="button" onClick={() => { setMonth(current); setSelected(null); }}>This month</button><button type="button" onClick={() => { setMonth(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)); setSelected(null); }}>Last month</button></div>
    <div className="results-calendar-grid">{['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(day => <span key={day} className="results-calendar-weekday">{day}</span>)}{Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} aria-hidden="true" />)}{Array.from({ length: count }, (_, i) => {
      const key = `${prefix}-${String(i + 1).padStart(2, '0')}`, point = byDay.get(key);
      const kind = point ? point.returnBps < 0 ? 'loss' : point.returnBps > 0 ? 'win' : 'flat' : '';
      const value = point ? signedPercent(point.returnBps / 100) : '—';
      return <button type="button" key={key} className={`results-calendar-day ${kind}`} disabled={key > today} aria-label={`${key}, ${point ? `${value}, ${kind === 'flat' ? 'break-even' : kind}` : 'no daily result reported'}`} aria-pressed={selected === key} title={`${key}: ${value}`} onClick={() => setSelected(selected === key ? null : key)}><span>{i + 1}</span><small>{point ? signedPercent(point.returnBps / 100, Number.isInteger(point.returnBps / 100) ? 0 : 2) : '—'}</small></button>;
    })}</div>
    <div className="results-calendar-legend"><span className="win">+ Win</span><span className="loss">− Loss</span><span>0% Break-even</span><span>— Not reported</span></div>
    <p className="results-calendar-note"><strong>{monthPoints.length}/{count} days reported.</strong> {monthPoints.length ? 'Month change compounds the reported daily returns.' : 'Daily results will appear after Super Admin publishes them.'} {monthPoints.length > 0 && monthPoints.length < count && 'This is a partial daily history.'}</p>
    <div className="results-calendar-detail" aria-live="polite">{selected ? <><strong>{selected}</strong><p className={selectedPoint ? selectedPoint.returnBps < 0 ? 'loss' : selectedPoint.returnBps > 0 ? 'win' : '' : ''}>{selectedPoint ? `${signedPercent(selectedPoint.returnBps / 100)} daily ${selectedPoint.returnBps < 0 ? 'loss' : selectedPoint.returnBps > 0 ? 'gain' : 'return · break-even'}` : 'No daily result has been reported for this date.'}</p></> : <p>Select a day to view its reported percentage gain or loss.</p>}</div>
    {cyclePoints.length > 0 && <p className="results-calendar-note">28-day window ending {cycle.end}: <strong className={compoundedPercent(cyclePoints)! < 0 ? 'loss' : 'win'}>{signedPercent(compoundedPercent(cyclePoints))}</strong> compounded across {cyclePoints.length}/28 reported days.</p>}
    {reportedCycle && <aside className="results-cycle-report" aria-label="Owner-reported cycle summary"><h3>{reportDays === 33 ? "Previous 33-day cycle" : "28-day club cycle"} · ends {reportedCycle.endDay}</h3><strong className={reportedCycle.profitBps < 0 ? 'loss' : reportedCycle.profitBps > 0 ? 'win' : ''}>{signedPercent(reportedCycle.profitBps / 100)} net profit</strong><span>Owner-reported summary</span><p>{today < reportedCycle.endDay ? 'Scheduled cycle end is still ahead.' : 'Scheduled cycle end has been reached.'} {reportedDays.length < reportDays ? `Daily breakdown pending: ${reportedDays.length}/${reportDays} days supplied.` : reconciled ? 'The daily figures reconcile with this summary.' : 'Daily figures differ from this summary; review is pending.'} This summary does not confirm a personal payout.</p></aside>}
    <p className="results-calendar-note">Club performance is manually reported by Super Admin. Blank days are unknown. Personal allocation results and payouts are recorded separately.</p>
  </section>;
}
