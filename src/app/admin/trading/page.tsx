import Link from "next/link";
import { walletTestMode } from "@/lib/environment";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTimeUtc as dateTime, usd } from "@/lib/format";
import { lockRemaining, tradingRequestsEnabled, tradingStatus } from "@/lib/trading";
import { AutoRefresh } from "@/app/checkout/pay/[id]/AutoRefresh";

export default async function AdminTrading({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; userId?: string; entry?: string; page?: string }> }) {
  await requireAdmin();
  const search = await searchParams;
  const page = Math.max(1, Math.min(100000, parseInt(search.page ?? "1", 10) || 1));
  const status = search.status ?? "all";
  const now = new Date();
  const where: Prisma.TradingAllocationWhereInput = {
    ...(search.entry ? { syndicateEntryId: search.entry.slice(0, 100) } : {}),
    ...(search.userId ? { userId: search.userId.slice(0, 100) } : {}),
    ...(search.q ? { user: { OR: [{ email: { contains: search.q.slice(0, 200), mode: "insensitive" } }, { name: { contains: search.q.slice(0, 200), mode: "insensitive" } }] } } : {}),
    ...(status === "due" ? { OR: [{ status: "ACTIVE", unlocksAt: { lte: now } }, { status: "PAYOUT_READY" }] } : ["PENDING", "ACTIVE", "PAYOUT_READY", "PAID", "REJECTED", "CANCELLED"].includes(status) ? { status } : {}),
  };
  const [records, count, groups, due, reconciliation, program] = await Promise.all([
    db.tradingAllocation.findMany({ where, include: { user: { select: { email: true, name: true } } }, orderBy: [{ requestedAt: "desc" }, { id: "desc" }], take: 25, skip: (page - 1) * 25 }),
    db.tradingAllocation.count({ where }),
    db.tradingAllocation.groupBy({ by: ["status"], _sum: { principalCents: true, profitCents: true, payoutCents: true }, _count: true }),
    db.tradingAllocation.count({ where: { status: "ACTIVE", unlocksAt: { lte: now } } }),
    db.$queryRaw<{ mismatches: number; journalLocked: bigint; allocationLocked: bigint }[]>`SELECT
      (SELECT count(*)::int FROM "User" u WHERE
        (SELECT COALESCE(sum(j."lockedDeltaCents"),0) FROM "WalletJournal" j WHERE j."userId"=u.id)<>
        (SELECT COALESCE(sum(a."principalCents"),0) FROM "TradingAllocation" a WHERE a."userId"=u.id AND a.status IN ('ACTIVE','PAYOUT_READY'))) AS mismatches,
      (SELECT COALESCE(sum("lockedDeltaCents"),0) FROM "WalletJournal") AS "journalLocked",
      (SELECT COALESCE(sum("principalCents"),0) FROM "TradingAllocation" WHERE status IN ('ACTIVE','PAYOUT_READY')) AS "allocationLocked"`,
    db.tradingProgram.findUnique({ where: { id: "harry" } }),
  ]);
  const open = tradingRequestsEnabled && Boolean(program?.enrollmentEnabled);
  const pending = groups.find(g => g.status === "PENDING");
  const ready = groups.find(g => g.status === "PAYOUT_READY");
  const paid = groups.find(g => g.status === "PAID");
  function pageUrl(next: number) { const p = new URLSearchParams(); for (const k of ["q", "status", "userId", "entry"] as const) if (search[k]) p.set(k, search[k]!); p.set("page", String(next)); return `?${p}`; }
  return <div className="space-y-6"><AutoRefresh seconds={30} />
    <div><h2 className="text-3xl">Trading allocations</h2><p className="muted mt-2 text-sm">{open ? walletTestMode() ? "Simulated enrollment is open on this test site." : "Manual allocation requests are open. Only the Super Admin can approve deposits and allocations." : "New allocation requests are paused."} Existing obligations remain visible and can be processed after maturity. No trading execution or automatic crypto transfer is connected.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="card"><p className="muted text-xs">Pending admin approval</p><p className="mt-2 text-2xl">{pending?._count ?? 0}</p><p className="muted text-sm">{usd(pending?._sum.principalCents ?? 0)} · not reserved</p></div>
      <div className="card"><p className="muted text-xs">Locked / unpaid principal</p><p className="mt-2 text-2xl">{usd(Number(reconciliation[0].allocationLocked))}</p><p className="muted text-sm">{due} matured, awaiting result</p></div>
      <div className="card"><p className="muted text-xs">Manual payouts due</p><p className="mt-2 text-2xl">{usd(ready?._sum.payoutCents ?? 0)}</p><p className="muted text-sm">{ready?._count ?? 0} recorded results</p></div>
      <div className="card"><p className="muted text-xs">Completed external payouts</p><p className="mt-2 text-2xl">{usd(paid?._sum.payoutCents ?? 0)}</p><p className="muted text-sm">Net member result: {usd(paid?._sum.profitCents ?? 0)}</p></div>
    </div>
    <p role="status" className={reconciliation[0].mismatches ? "text-red-200" : "text-emerald-300"}>Locked-principal reconciliation: {reconciliation[0].mismatches ? `${reconciliation[0].mismatches} mismatches — investigate before processing` : `all records match (${usd(Number(reconciliation[0].journalLocked))})`}</p>
    {search.entry && <p className="card text-sm text-gold-300">Syndicate filter: {search.entry} · <Link className="underline" href="/admin/syndicates">Back to moon calendar</Link></p>}<form className="card flex flex-wrap gap-3">{search.entry && <input type="hidden" name="entry" value={search.entry} />}<input name="q" defaultValue={search.q} placeholder="Member email or name" aria-label="Search members" className="input sm:max-w-xs" />{search.userId && <input name="userId" type="hidden" value={search.userId} />}
      <select name="status" defaultValue={status} aria-label="Trading status" className="input sm:max-w-xs">{["all", "due", "PENDING", "ACTIVE", "PAYOUT_READY", "PAID", "REJECTED", "CANCELLED"].map(s => <option key={s} value={s}>{s === "due" ? "Action due after maturity" : s.replaceAll("_", " ")}</option>)}</select><button className="btn-gold">Filter</button><Link className="btn-ghost" href="/admin/trading">Clear filters</Link>
    </form>
    <section className="card overflow-x-auto"><h3 className="mb-4 text-xl">All member allocations · {count} matching records</h3>
      <table className="table"><thead><tr><th>Member / reference</th><th>Principal</th><th>Status</th><th>Lock</th><th>Result / payout</th><th>Review</th></tr></thead><tbody>{records.map(a => <tr key={a.id}>
        <td><Link className="text-gold-300 underline" href={`/admin/users/${a.userId}`}>{a.user.name ?? a.user.email}</Link><p className="muted text-xs">{a.user.email}</p><p className="muted max-w-48 break-all text-xs">{a.id}</p></td><td>{usd(a.principalCents)}<p className="muted text-xs">{a.currency} · {a.network}</p></td>
        <td>{tradingStatus(a, now)}</td><td>{["REJECTED", "CANCELLED"].includes(a.status) ? "No lock created" : lockRemaining(a.unlocksAt, now, a.startsAt)}<p className="muted text-xs">Approved: {dateTime(a.approvedAt)}<br />Entry: {dateTime(a.startsAt ?? a.approvedAt)}<br />Ends: {dateTime(a.unlocksAt)} UTC</p></td>
        <td>{a.profitCents === null ? "No actual result recorded" : <>{usd(a.profitCents)} net result<br />{((a.payoutCents ?? 0) / 100).toFixed(2)} {a.currency}<p className="muted text-xs">{a.paidAt ? `Completed ${dateTime(a.paidAt)} UTC` : "Unpaid"}</p></>}</td><td><Link href={`/admin/trading/${a.id}`} className="text-gold-300 underline">Full record & controls</Link></td>
      </tr>)}</tbody></table>{records.length === 0 && <p className="muted mt-4 text-sm">No matching trading allocations.</p>}
      <div className="mt-4 flex gap-3">{page > 1 && <Link href={pageUrl(page - 1)} className="btn-ghost">Previous</Link>}{page * 25 < count && <Link href={pageUrl(page + 1)} className="btn-ghost">Next</Link>}</div><p className="muted mt-3 text-xs">Page {page} · 25 per page. Summary totals cover all members, regardless of filters.</p>
    </section>
  </div>;
}
