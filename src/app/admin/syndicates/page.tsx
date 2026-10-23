import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { usd } from "@/lib/format";
import { entryDate, moonPhaseName } from "@/lib/syndicate";
import { EntryControls } from "./EntryControls";
import { AutoRefresh } from "@/app/checkout/pay/[id]/AutoRefresh";

type Entry = { id: string; phase: string; startsAt: string; endsAt: string; accepting: boolean; revision: number; pending: number; reserved: number; capital: string; future: boolean };
export default async function AdminSyndicates() {
  const admin = await requireAdmin();
  const entries = await db.$queryRaw<Entry[]>`SELECT s.id,s.phase,s.accepting,s.revision,
    to_char(s."startsAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "startsAt",
    to_char(s."startsAt"+interval '28 days','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "endsAt",
    s."startsAt">CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AS future,
    count(a.id) FILTER(WHERE a.status='PENDING')::int AS pending,
    count(a.id) FILTER(WHERE a.status IN ('ACTIVE','PAYOUT_READY'))::int AS reserved,
    COALESCE(sum(a."principalCents") FILTER(WHERE a.status IN ('ACTIVE','PAYOUT_READY')),0)::text AS capital
    FROM "SyndicateEntry" s LEFT JOIN "TradingAllocation" a ON a."syndicateEntryId"=s.id
    GROUP BY s.id ORDER BY s."startsAt"`;
  return <div className="space-y-6"><AutoRefresh seconds={30} /><section className="card space-y-3"><p className="text-xs uppercase tracking-wider text-gold-300">TRADING WITH ROB</p><h2 className="text-3xl">Moon calendar & syndicates</h2><p className="muted text-sm">One full-moon and one new-moon entry each UTC month. Each entry starts at 00:00 UTC and matures 28 days later. Approval reserves funds before the entry; the trading period starts at its published time. Existing approved allocations retain their original terms and are listed under Trading allocations.</p><p className="muted text-xs">Closing an entry stops new requests and approvals. It does not cancel already reserved allocations or alter their saved dates. Published dates cannot be edited. The current calendar runs through December 2027; later dates need a reviewed schedule update.</p></section><div className="grid gap-4 lg:grid-cols-2">{entries.map(entry => <section key={entry.id} className="card"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl">{moonPhaseName(entry.phase)} · {entryDate(entry.startsAt)}</h3><span className="badge border border-gold-400/30">{!entry.future ? "Entry started" : entry.accepting ? "Accepting requests" : "Closed to requests"}</span></div><p className="muted mt-3 text-sm">Start: {entryDate(entry.startsAt)} · 00:00 UTC<br />Maturity: {entryDate(entry.endsAt)} · 00:00 UTC</p><dl className="mt-4 grid grid-cols-3 gap-3 text-sm"><div><dt className="muted">Pending requests</dt><dd className="mt-1 text-xl">{entry.pending}</dd></div><div><dt className="muted">Approved / unpaid</dt><dd className="mt-1 text-xl">{entry.reserved}</dd></div><div><dt className="muted">Reserved capital</dt><dd className="mt-1 text-xl">{usd(Number(entry.capital))}</dd></div></dl><Link href={`/admin/trading?entry=${encodeURIComponent(entry.id)}`} className="mt-4 inline-block text-sm text-gold-300 underline">View this syndicate’s allocations →</Link>{admin.role === "SUPER_ADMIN" && entry.future && <EntryControls key={entry.id} id={entry.id} revision={entry.revision} accepting={entry.accepting} />}</section>)}</div></div>;
}
