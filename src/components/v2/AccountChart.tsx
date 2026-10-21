"use client";
import { useId, useState } from "react";
import { usd } from "@/lib/format";
import type { PortalPoint } from "@/lib/portal-metrics";

export function AccountChart({ points, results, reconciled, initialMetric = "value", hidden = false }: { points: PortalPoint[]; results: number; reconciled: boolean; initialMetric?: "value" | "profit"; hidden?: boolean }) {
  const id = useId().replace(/:/g, "");
  const [metric, setMetric] = useState(initialMetric);
  const [period, setPeriod] = useState(90);
  const [selected, setSelected] = useState<number | null>(null);
  const series = points.slice(-period);
  const key = metric === "value" ? "valueCents" : "profitCents";
  const point = series[selected ?? series.length - 1];
  const available = series.length > 0 && reconciled && (metric !== "profit" || results > 0);
  const min = Math.min(0, ...series.map(p => p[key]));
  const max = Math.max(100, ...series.map(p => p[key]));
  const x = (i: number) => 12 + i / Math.max(1, series.length - 1) * 616;
  const y = (value: number) => 185 - (value - min) / (max - min) * 165;
  const line = series.map((p, i) => i === 0 ? `M ${x(i)} ${y(p[key])}` : `H ${x(i)} V ${y(p[key])}`).join(" ");
  const color = metric === "profit" && (series.at(-1)?.profitCents ?? 0) < 0 ? "#f7a29c" : "#8ddbb1";
  const change = (series.at(-1)?.[key] ?? 0) - (series[0]?.[key] ?? 0);
  return <div>
    <div className="portal-chart-controls"><div className="portal-tabs" aria-label="Chart metric">{(["value", "profit"] as const).map(type => <button key={type} aria-pressed={metric === type} onClick={() => { setMetric(type); setSelected(null); }}>{type === "value" ? "Account value" : "Recorded profit"}</button>)}</div><div className="portal-tabs" aria-label="Chart period">{[30, 90, 366].map(days => <button key={days} aria-pressed={period === days} onClick={() => { setPeriod(days); setSelected(null); }}>{days === 366 ? "1Y" : `${days}D`}</button>)}</div></div>
    {hidden ? <div className="portal-chart-empty">Balances are hidden. Use “Show balances” to view your chart.</div> : <>
      <div className="portal-chart-summary"><div><p className="portal-small">{selected !== null && point ? `${point.day} · end of day UTC` : metric === "value" ? "Latest account value" : "Cumulative recorded profit / loss"}</p><p className={`portal-chart-amount ${metric === "profit" ? (point?.profitCents ?? 0) < 0 ? "portal-negative" : "portal-positive" : ""}`}>{usd(point?.[key] ?? 0)}</p></div>{available && <span className="portal-small text-right">{change >= 0 ? "+" : ""}{usd(change)}<br />change in displayed period</span>}</div>
      {available ? <div className="portal-chart-figure"><svg viewBox="0 0 640 210" role="img" aria-label={`${metric === "value" ? "Account value" : "Recorded profit"} chart. Daily values in USD, UTC. Use the data table below for exact figures.`}>
        <defs><linearGradient id={`chart-fill-${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".18" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {[20, 75, 130, 185].map(n => <line key={n} x1="12" x2="628" y1={n} y2={n} stroke="#c2d5c50c" />)}
        <line x1="12" x2="628" y1={y(0)} y2={y(0)} stroke="#c2d5c526" strokeDasharray="3 5" />
        {series.length > 1 && <path d={`${line} L ${x(series.length - 1)} ${y(0)} L 12 ${y(0)} Z`} fill={`url(#chart-fill-${id})`} />}
        <path d={line} fill="none" stroke={color} strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
        <circle cx={x(selected ?? series.length - 1)} cy={y(point?.[key] ?? 0)} r="4" fill={color} stroke="#10241c" strokeWidth="3" />
        {series.map((p, i) => <rect key={p.day} x={Math.max(0, x(i) - 310 / Math.max(series.length, 1))} y="10" width={Math.max(3, 620 / Math.max(series.length, 1))} height="180" className="portal-chart-hit" onMouseEnter={() => setSelected(i)} onMouseLeave={() => setSelected(null)} onClick={() => setSelected(i)}><title>{p.day}: {usd(p[key])}</title></rect>)}
      </svg><div className="portal-chart-legend"><span>{series[0].day}</span><span>Daily close · UTC</span><span>{series.at(-1)?.day}</span></div></div> : <div className="portal-chart-empty">{!reconciled ? "History totals need review. Contact support before relying on this chart." : metric === "profit" ? "Your profit chart will appear when an admin records an actual allocation result." : "Your account-value history will appear after your first confirmed financial entry."}</div>}
      <p className="portal-section-note">{metric === "value" ? "Account value includes available credit, active principal and recorded payouts due. Deposits, membership purchases and external payouts also change this value; this is not an investment-return chart." : "Only actual admin-recorded allocation results are counted. Deposits, principal returned and proposed daily targets are not earnings. This is not a live market valuation."}</p>
      {available && <details className="mt-3"><summary className="portal-small cursor-pointer text-gold-300">View accessible chart data</summary><div className="portal-scroll mt-3 max-h-64"><table className="portal-records"><thead><tr><th>Date (UTC)</th><th>Account value</th><th>Recorded profit</th></tr></thead><tbody>{series.map(p => <tr key={p.day}><td>{p.day}</td><td>{usd(p.valueCents)}</td><td>{usd(p.profitCents)}</td></tr>)}</tbody></table></div></details>}
    </>}
  </div>;
}
