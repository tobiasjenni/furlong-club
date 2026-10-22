import Link from "next/link";
import type { TradingAllocation } from "@prisma/client";
import { dateTimeUtc, usd } from "@/lib/format";
import { lockRemaining, tradingStatus } from "@/lib/trading";
import { PortalIcon } from "./PortalIcon";
import type { PortalActivity } from "@/lib/portal-activity";

export function PortalHeading({ title, description, children, eyebrow = "YOUR FURLONG WORKSPACE" }: { title: string; description: string; eyebrow?: string; children?: React.ReactNode }) {
  return <div className="portal-page-heading"><div><p className="portal-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="portal-lead">{description}</p></div>{children}</div>;
}
export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="portal-empty"><PortalIcon name="activity" /><strong>{title}</strong>{children}</div>;
}
export function AllocationCard({ allocation: a, now = new Date() }: { allocation: TradingAllocation; now?: Date }) {
  const duration = a.approvedAt && a.unlocksAt ? a.unlocksAt.getTime() - a.approvedAt.getTime() : 33 * 86400000;
  const progress = a.approvedAt ? Math.min(100, Math.max(0, (now.getTime() - a.approvedAt.getTime()) / duration * 100)) : 0;
  return <article id={`allocation-${a.id}`} className="portal-allocation"><div className="portal-allocation-head"><div><strong className="portal-allocation-amount">{usd(a.principalCents)}</strong><span className="portal-small ml-2">{a.currency} / {a.network}</span></div><span className={`portal-pill ${a.status === "PAID" ? "green" : a.status === "REJECTED" ? "red" : "gold"}`}>{tradingStatus(a, now)}</span></div>
    <div className="portal-allocation-details"><span>{lockRemaining(a.unlocksAt, now)}</span><span>{a.unlocksAt ? `Ends ${dateTimeUtc(a.unlocksAt)} UTC` : "Lock starts on admin approval"}</span></div>
    {["ACTIVE", "PAYOUT_READY"].includes(a.status) && <div className="portal-progress" role="progressbar" aria-label="33-day lock progress" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>}
    {a.profitCents !== null && <div className="portal-allocation-details"><span>Recorded result <strong className={a.profitCents < 0 ? "portal-negative" : "portal-positive"}>{usd(a.profitCents)}</strong></span><span>{a.status === "PAID" ? "External payout recorded" : "External payout due"}: {usd(a.payoutCents ?? 0)}</span></div>}
    <details className="mt-3"><summary className="portal-small cursor-pointer text-gold-300">Allocation details</summary><dl className="mt-3"><div className="portal-key-value"><dt>Reference</dt><dd className="max-w-[70%] break-all text-xs">{a.id}</dd></div><div className="portal-key-value"><dt>Requested</dt><dd>{dateTimeUtc(a.requestedAt)} UTC</dd></div><div className="portal-key-value"><dt>Approved</dt><dd>{dateTimeUtc(a.approvedAt)} UTC</dd></div><div className="portal-key-value"><dt>Receiving wallet</dt><dd className="max-w-[65%] break-all font-mono text-xs">{a.payoutAddress}</dd></div>{a.reviewNote && <div className="portal-key-value"><dt>Review</dt><dd className="max-w-[70%]">{a.reviewNote}</dd></div>}{a.resultNote && <div className="portal-key-value"><dt>Actual result note</dt><dd className="max-w-[70%]">{a.resultNote}</dd></div>}{a.payoutTxHash && <div className="portal-key-value"><dt>Payout transaction</dt><dd className="max-w-[70%] break-all text-xs">{a.payoutTxHash}</dd></div>}</dl></details>
  </article>;
}
export function ActivityTable({ rows }: { rows: PortalActivity[] }) {
  if (!rows.length) return <EmptyState title="No matching activity">Your deposits, membership purchases, allocation results and external payouts will appear here.</EmptyState>;
  return <div className="portal-scroll"><table className="portal-records"><thead><tr><th>Activity / reference</th><th>Amount</th><th>Credit change</th><th>Date · UTC</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><strong>{row.description}</strong><span className="portal-reference">{row.paymentId ? <Link prefetch={false} className="text-gold-300 underline" href={`/deposits/${encodeURIComponent(row.paymentId)}`}>View deposit receipt</Link> : row.allocationId ? <Link prefetch={false} className="text-gold-300 underline" href={`/allocations?reference=${encodeURIComponent(row.allocationId)}#allocations`}>View allocation</Link> : row.reference}</span></td><td className={row.bucket === "result" ? row.amountCents < 0 ? "portal-negative" : "portal-positive" : ""}>{usd(row.amountCents)}<span className="portal-small block capitalize">{row.bucket}</span></td><td>{row.creditDeltaCents > 0 ? "+" : ""}{usd(row.creditDeltaCents)}</td><td className="whitespace-nowrap">{dateTimeUtc(row.at)}</td></tr>)}</tbody></table></div>;
}
