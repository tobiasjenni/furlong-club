import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { dateTimeUtc, usd } from '@/lib/format';
import { pageParam, textParam } from '@/lib/portal-filters';
import { adminDepositsQuery, adminDepositStatus, depositHistoryStatuses, type DepositHistoryStatus, type AdminDepositPage, type AdminDeposit } from '@/lib/admin-deposits';
import { expireManualDeposits, transactionUrl } from '@/lib/manual-deposits';
import { AutoRefresh } from '@/app/checkout/pay/[id]/AutoRefresh';

export const metadata = { title: 'Deposits' };

export default async function Deposits({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; status?: string; page?: string }> }) {
  await requireAdmin();
  await expireManualDeposits();
  const params = await searchParams;
  const view = params.view === 'history' ? 'history' : 'review';
  const q = textParam(params.q, 200), page = pageParam(params.page);
  const status: DepositHistoryStatus = Object.hasOwn(depositHistoryStatuses, params.status ?? '') ? params.status as DepositHistoryStatus : 'CONFIRMED';
  const { rows, total, reviewCount, historyCount, summary } = (await db.$queryRaw<{ data: AdminDepositPage }[]>(adminDepositsQuery(view, q, status, page)))[0].data;
  const href = (next: number) => '/admin/deposits?' + new URLSearchParams({ view, ...(view === 'history' ? { q, status } : {}), page: String(next) }).toString();
  const empty = view === 'review' ? 'No deposits awaiting approval. Open Deposit history to view previous requests.' : 'No deposits match these filters.';
  return <div className="space-y-5">
    <AutoRefresh seconds={30} />
    <div><h2 className="text-3xl">Deposits</h2><p className="muted mt-2 text-sm">See what was credited, what needs review and what is still only a request.</p></div>
    <nav aria-label="Deposit views" className="flex flex-wrap gap-2">
      <Link href="/admin/deposits" aria-current={view === 'review' ? 'page' : undefined} className={view === 'review' ? 'btn-gold' : 'btn-ghost'}>Awaiting review · {reviewCount}</Link>
      <Link href="/admin/deposits?view=history" aria-current={view === 'history' ? 'page' : undefined} className={view === 'history' ? 'btn-gold' : 'btn-ghost'}>Deposit history · {historyCount}</Link>
    </nav>
    <section aria-labelledby="deposit-totals-title" className="space-y-3">
      <div><h3 id="deposit-totals-title" className="text-xl">{view === 'history' && q ? 'Search totals' : 'Club deposit totals'}</h3><p className="muted mt-1 text-xs">{view === 'history' && q ? 'All requests matching your search' : 'All club deposit requests'} · across every status and page · USD</p></div>
      <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="card p-4 sm:p-6"><dt className="muted text-sm">Confirmed deposits</dt><dd className="mt-2 break-words text-lg font-semibold sm:text-2xl">{usd(summary.depositCents)}</dd><dd className="muted mt-2 text-xs">{summary.confirmedCount} confirmed · original deposit credit</dd></div>
        <div className="card p-4 sm:p-6"><dt className="muted text-sm">Linked corrections</dt><dd className="mt-2 break-words text-lg font-semibold sm:text-2xl">{usd(summary.correctionCents)}</dd><dd className="muted mt-2 text-xs">Adjustments attached to these deposits</dd></div>
        <div className="card order-first col-span-2 border-gold-400/40 p-4 sm:p-6 xl:order-none xl:col-span-1"><dt className="text-sm text-gold-300">Total deposit credit issued</dt><dd className="mt-2 break-words text-2xl font-semibold text-gold-300">{usd(summary.creditCents)}</dd><dd className="muted mt-2 text-xs">Deposits + linked corrections · excludes unfinished requests</dd></div>
        <div className="card col-span-2 p-4 sm:p-6 xl:col-span-1"><dt className="muted text-sm">Unfinished requests</dt><dd className="mt-2 text-2xl font-semibold">{summary.reviewCount + summary.pendingCount}</dd><dd className="muted mt-2 text-xs">{summary.reviewCount} to review · {usd(summary.reviewCents)} requested<br />{summary.pendingCount} awaiting transfer · {usd(summary.pendingCents)} requested</dd></div>
      </dl>
      <p className="muted text-xs">Credit issued is a historical total, not the current available balance or an on-chain wallet balance. General wallet adjustments and current trading balances are in each member’s profile. Unreported requests expire after 60 minutes; reported transfers remain open for review.</p>
    </section>
    {view === 'history' ? <section className="card space-y-4" aria-labelledby="deposit-history-title">
      <h3 id="deposit-history-title" className="text-xl">Deposit history</h3>
      <form className="flex flex-col gap-3 lg:flex-row">
        <input type="hidden" name="view" value="history" />
        <input name="q" aria-label="Search deposits" defaultValue={q} maxLength={200} className="input min-w-0 flex-1" placeholder="Member name, email, deposit or transaction ID" />
        <select name="status" aria-label="Deposit status" defaultValue={status} className="input lg:max-w-64">{Object.entries(depositHistoryStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <button className="btn-gold">Search history</button>
        {(q || status !== 'CONFIRMED') && <Link href="/admin/deposits?view=history" className="btn-ghost">Reset to confirmed</Link>}
      </form>
      <div className="flex flex-wrap gap-2"><Link href={'/admin/deposits?' + new URLSearchParams({view:'history',q,status:'CONFIRMED'})} className={status === 'CONFIRMED' ? 'btn-gold' : 'btn-ghost'}>Confirmed deposits</Link><Link href={'/admin/deposits?' + new URLSearchParams({view:'history',q,status:'unfinished'})} className={status === 'unfinished' ? 'btn-gold' : 'btn-ghost'}>Unfinished requests</Link><Link href={'/admin/deposits?' + new URLSearchParams({view:'history',q,status:'all'})} className={status === 'all' ? 'btn-gold' : 'btn-ghost'}>All requests</Link></div>
      <p className="muted text-xs">{total} matching record{total === 1 ? '' : 's'} · newest first · all times UTC. An unfinished request is not another received deposit. Only posted ledger entries count toward the credit total above.</p>
    </section> : <p className="muted text-sm">{reviewCount} reported transfer{reviewCount === 1 ? '' : 's'} awaiting review. Verify receipt and sender before adding credit. Oldest reports appear first.</p>}
    <ul className="space-y-3 md:hidden" aria-label={view === 'history' ? 'Deposit history records' : 'Deposits awaiting review'}>{rows.map(p => <li key={p.id} className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><Link href={`/admin/users/${p.userId}`} className="break-words font-semibold text-gold-300 underline">{p.name || p.email}</Link><p className="muted mt-1 break-all text-xs">{p.email}</p></div><span className={`portal-pill ${p.status === 'CONFIRMED' ? 'green' : p.status === 'FAILED' || p.status === 'EXPIRED' ? 'red' : 'gold'}`}>{adminDepositStatus(p)}</span></div>
      <DepositAmount payment={p} />
      <p className="muted text-xs">{view === 'review' ? 'Reported' : 'Created'} {dateTimeUtc(view === 'review' ? p.submittedAt : p.createdAt)} UTC{p.confirmedAt && <><br />Confirmed {dateTimeUtc(p.confirmedAt)} UTC</>}</p>
      <p className="muted break-all text-xs">Reference: {p.id}</p>
      <div className="flex flex-wrap gap-2"><Link href={`/admin/payments/${p.id}`} className="btn-gold">{view === 'review' ? 'Review deposit' : 'Deposit record'}</Link><Link href={`/admin/users/${p.userId}`} className="btn-ghost">Member profile →</Link></div>
    </li>)}</ul>
    <div className="card hidden overflow-x-auto md:block">{rows.length ? <table className="table"><thead><tr><th>{view === 'review' ? 'Reported' : 'Created'} · UTC</th><th>Member</th><th>Amount / credit</th><th>Status</th><th>Reference / transaction</th><th>Record</th></tr></thead>
      <tbody>{rows.map(p => <tr key={p.id}>
        <td>{dateTimeUtc(view === 'review' ? p.submittedAt : p.createdAt)}{p.confirmedAt && <p className="muted mt-1 text-xs">Confirmed {dateTimeUtc(p.confirmedAt)}</p>}</td>
        <td><Link href={`/admin/users/${p.userId}`} className="text-gold-300 underline">{p.name || p.email}</Link><p className="muted break-all text-xs">{p.email}</p><Link href={`/admin/users/${p.userId}`} className="mt-2 text-xs text-gold-300 underline">Member profile →</Link></td>
        <td><DepositAmount payment={p} /></td>
        <td><span className={`portal-pill ${p.status === 'CONFIRMED' ? 'green' : p.status === 'FAILED' || p.status === 'EXPIRED' ? 'red' : 'gold'}`}>{adminDepositStatus(p)}</span></td>
        <td className="max-w-44 break-all text-xs"><Link href={`/admin/payments/${p.id}`} className="text-gold-300 underline">{p.id}</Link>{transactionUrl(p.network,p.transactionHash) && <a href={transactionUrl(p.network,p.transactionHash)!} target="_blank" rel="noreferrer" className="mt-2 block text-gold-300 underline">View transaction ↗</a>}</td>
        <td><Link href={`/admin/payments/${p.id}`} className={view === 'review' ? 'btn-gold' : 'btn-ghost'}>{view === 'review' ? 'Review' : 'Open record'}</Link></td>
      </tr>)}</tbody></table> : <p className="muted text-sm">{empty}</p>}</div>
    {!rows.length && <p className="card muted text-sm md:hidden">{empty}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span className="muted">{total} request{total === 1 ? '' : 's'} · Page {page}</span><div className="flex gap-2">{page > 1 && <Link href={href(page-1)} className="btn-ghost">← Previous</Link>}{page*25 < total && <Link href={href(page+1)} className="btn-ghost">Next →</Link>}</div></div>
  </div>;
}

function DepositAmount({ payment: p }: { payment: AdminDeposit }) {
  const posted = p.creditCents !== null;
  return <div className="space-y-1">
    <p className="muted text-xs">{posted ? 'Credit issued' : p.status === 'CONFIRMED' ? 'Credit missing · check record' : 'Requested amount · not credited'}</p>
    <p className={`text-xl font-semibold ${posted ? 'text-gold-300' : ''}`}>{usd(posted ? p.creditCents! : p.amountCents)}</p>
    <p className="muted text-xs">{p.currency} · {p.network}</p>
    {posted && p.amountCents !== p.creditCents && <p className="muted text-xs">Original request: {usd(p.amountCents)}</p>}
    {p.correctionCents !== 0 && <p className="muted text-xs">Includes linked corrections: {usd(p.correctionCents)}</p>}
    {!posted && <p className="text-xs text-gold-300">No credit posted to the member’s account.</p>}
  </div>;
}
