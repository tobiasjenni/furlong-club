"use client";
import Link from "next/link";
import { useState } from "react";
import { usd } from "@/lib/format";
import { snapshotIsReconciled, type PortalSnapshot } from "@/lib/portal-metrics";
import { AccountChart } from "./AccountChart";
import { PortalIcon } from "./PortalIcon";

export function PortfolioOverview({ snapshot }: { snapshot: PortalSnapshot }) {
  const [hidden, setHidden] = useState(false);
  const money = (cents: number) => hidden ? "••••" : usd(cents);
  const metrics = [
    { label: "Available credit", value: snapshot.availableCents, note: "Ready for eligible club payments", icon: "wallet" as const },
    { label: "Committed principal", value: snapshot.committedCents, note: `${snapshot.activeCount} open allocation${snapshot.activeCount === 1 ? "" : "s"}`, icon: "trading" as const },
    { label: "Recorded profit / loss", value: snapshot.recordedProfitCents, note: `${snapshot.resultCount} recorded result${snapshot.resultCount === 1 ? "" : "s"}`, icon: "performance" as const },
    { label: "Payouts due", value: snapshot.payoutDueCents, note: "Awaiting external manual payment", icon: "activity" as const },
  ];
  return <>
    <section className="portal-panel portal-hero-panel" aria-label="Account value and history"><div className="portal-panel-heading"><div><p className="portal-value-label">Total account value</p><p className="portal-value">{money(snapshot.valueCents)}</p><p className="portal-value-detail">Available credit + active principal + payouts due</p></div><button className="portal-icon-button" onClick={() => setHidden(!hidden)} aria-label={hidden ? "Show balances" : "Hide balances"} aria-pressed={hidden}><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{hidden && <path d="m3 3 18 18" />}</svg></button></div>
      <AccountChart points={snapshot.series} results={snapshot.resultCount} reconciled={snapshotIsReconciled(snapshot)} hidden={hidden} />
      <div className="portal-actions"><Link prefetch={false} href="/wallet#add-funds" className="btn-gold"><PortalIcon name="plus" />Add funds</Link><Link prefetch={false} href="/allocations#request" className="btn-ghost"><PortalIcon name="trading" />View allocation options</Link><Link prefetch={false} href="/activity" className="btn-ghost">Transactions<PortalIcon name="arrow" /></Link></div>
    </section>
    <div className="portal-metrics">{metrics.map(metric => <section key={metric.label} className="portal-metric"><p className="portal-metric-label">{metric.label}<PortalIcon name={metric.icon} /></p><p className={`portal-metric-value ${metric.icon === "performance" ? metric.value < 0 ? "portal-negative" : "portal-positive" : ""}`}>{money(metric.value)}</p><p className="portal-small">{metric.note}</p></section>)}</div>
  </>;
}
