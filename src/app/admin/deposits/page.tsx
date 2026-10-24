import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { dateTimeUtc, usd } from '@/lib/format';
import { pageParam, textParam } from '@/lib/portal-filters';
import { adminDepositsQuery, adminDepositStatus, depositHistoryStatuses, type DepositHistoryStatus, type AdminDepositPage } from '@/lib/admin-deposits';
import { transactionUrl } from '@/lib/manual-deposits';
import { AutoRefresh } from '@/app/checkout/pay/[id]/AutoRefresh';

export const metadata = { title: 'Deposits' };

export default async function Deposits({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; status?: string; page?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const view = params.view === 'history' ? 'history' : 'review';
  const q = textParam(params.q, 200), page = pageParam(params.page);
  const status: DepositHistoryStatus = Object.hasOwn(depositHistoryStatuses, params.status ?? '') ? params.status as DepositHistoryStatus : 'all';
  const { rows, total, reviewCount, historyCount } = (await db.$queryRaw<{ data: AdminDepositPage }[]>(adminDepositsQuery(view, q, status, page)))[0].data;
  const href = (next: number) => '/admin/deposits?' + new URLSearchParams({ view, ...(view === 'history' ? { q, status } : {}), page: String(next) }).toString();
  const empty = view === 'review' ? 'No deposits awaiting approval. Open Deposit history to view previous requests.' : 'No deposits match these filters.';
  return <div className="space-y-5">
    <AutoRefresh seconds={30} />
    <div><h2 className="text-3xl">Deposits</h2><p className="muted mt-2 text-sm">Review incoming transfers and find every member’s deposit record.</p></div>
    <nav aria-label="Deposit views" className="flex flex-wrap gap-2">
      <Link href="/admin/deposits" aria-current={view === 'review' ? 'page' : undefined} className={view === 'review' ? 'btn-gold' : 'btn-ghost'}>Awaiting review · {reviewCount}</Link>
      <Link href="/admin/deposits?view=history" aria-current={view === 'history' ? 'page' : undefined} className={view === 'history' ? 'btn-gold' : 'btn-ghost'}>Deposit history · {historyCount}</Link>
    </nav>
    {view === 'history' ? <section className="card space-y-4" aria-labelledby="deposit-history-title">
      <h3 id="deposit-history-title" className="text-xl">Deposit history</h3>
      <form className="flex flex-col gap-3 lg:flex-row">
        <input type="hidden" name="view" value="history" />
        <input name="q" aria-label="Search deposits" defaultValue={q} maxLength={200} className="input min-w-0 flex-1" placeholder="Member name, email, deposit or transaction ID" />
        <select name="status" aria-label="Deposit status" defaultValue={status} className="input lg:max-w-64">{Object.entries(depositHistoryStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <button className="btn-gold">Search history</button>
        {(q || status !== 'all') && <Link href="/admin/deposits?view=history" className="btn-ghost">Clear filters</Link>}
      </form>
      <p className="muted text-xs">{total} matching request{total === 1 ? '' : 's'} · newest first · all times UTC. Pending, cancelled and rejected requests are not proof of received funds. Posted credit comes from the ledger, including any linked corrections; general wallet corrections are in the member’s profile.</p>
    </section> : <p className="muted text-sm">{reviewCount} reported transfer{reviewCount === 1 ? '' : 's'} awaiting review. Verify receipt and sender before adding credit. Oldest reports appear first.</p>}
    <ul className="space-y-3 md:hidden" aria-label={view === 'history' ? 'Deposit history records' : 'Deposits awaiting review'}>{rows.map(p => <li key={p.id} className="card space-y-3">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link href={`/admin/users/${p.userId}`} className="break-words font-semibold text-gold-300 underline">{p.name || p.email}</Link><p className="muted mt-1 break-all text-xs">{p.email}</p></div><span className={`portal-pill shrink-0 ${p.status === 'CONFIRMED' ? 'green' : p.status === 'FAILED' || p.status === 'EXPIRED' ? 'red' : 'gold'}`}>{adminDepositStatus(p)}</span></div>
      <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="muted text-xs">Requested credit</dt><dd>{usd(p.amountCents)}</dd><dd className="muted text-xs">{p.currency} · {p.network}</dd></div><div><dt className="muted text-xs">Posted credit</dt><dd>{p.creditCents === null ? '—' : usd(p.creditCents)}</dd>{p.correctionCents !== 0 && <dd className="muted text-xs">Corrections: {usd(p.correctionCents)}</dd>}</div></dl>
      <p className="muted text-xs">{view === 'review' ? 'Reported' : 'Created'} {dateTimeUtc(view === 'review' ? p.submittedAt : p.createdAt)} UTC{p.confirmedAt && <><br />Confirmed {dateTimeUtc(p.confirmedAt)} UTC</>}</p>
      <p className="muted break-all text-xs">Reference: {p.id}</p>
      <div className="flex flex-wrap gap-2"><Link href={`/admin/payments/${p.id}`} className="btn-gold">{view === 'review' ? 'Review deposit' : 'Deposit record'}</Link><Link href={`/admin/users/${p.userId}`} className="btn-ghost">Member profile →</Link></div>
    </li>)}</ul>
    <div className="card hidden overflow-x-auto md:block">{rows.length ? <table className="table"><thead><tr><th>{view === 'review' ? 'Reported' : 'Created'} · UTC</th><th>Member</th><th>Requested credit</th><th>Posted credit</th><th>Status</th><th>Reference / transaction</th><th>Record</th></tr></thead>
      <tbody>{rows.map(p => <tr key={p.id}>
        <td>{dateTimeUtc(view === 'review' ? p.submittedAt : p.createdAt)}{p.confirmedAt && <p className="muted mt-1 text-xs">Confirmed {dateTimeUtc(p.confirmedAt)}</p>}</td>
        <td><Link href={`/admin/users/${p.userId}`} className="text-gold-300 underline">{p.name || p.email}</Link><p className="muted break-all text-xs">{p.email}</p><Link href={`/admin/users/${p.userId}`} className="mt-2 text-xs text-gold-300 underline">Member profile →</Link></td>
        <td>{usd(p.amountCents)}<p className="muted text-xs">{p.currency} · {p.network}</p></td>
        <td>{p.creditCents === null ? '—' : usd(p.creditCents)}{p.correctionCents !== 0 && <p className="muted text-xs">Corrections: {usd(p.correctionCents)}</p>}</td>
        <td><span className={`portal-pill ${p.status === 'CONFIRMED' ? 'green' : p.status === 'FAILED' || p.status === 'EXPIRED' ? 'red' : 'gold'}`}>{adminDepositStatus(p)}</span></td>
        <td className="max-w-44 break-all text-xs"><Link href={`/admin/payments/${p.id}`} className="text-gold-300 underline">{p.id}</Link>{transactionUrl(p.network,p.transactionHash) && <a href={transactionUrl(p.network,p.transactionHash)!} target="_blank" rel="noreferrer" className="mt-2 block text-gold-300 underline">View transaction ↗</a>}</td>
        <td><Link href={`/admin/payments/${p.id}`} className={view === 'review' ? 'btn-gold' : 'btn-ghost'}>{view === 'review' ? 'Review' : 'Open record'}</Link></td>
      </tr>)}</tbody></table> : <p className="muted text-sm">{empty}</p>}</div>
    {!rows.length && <p className="card muted text-sm md:hidden">{empty}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span className="muted">{total} request{total === 1 ? '' : 's'} · Page {page}</span><div className="flex gap-2">{page > 1 && <Link href={href(page-1)} className="btn-ghost">← Previous</Link>}{page*25 < total && <Link href={href(page+1)} className="btn-ghost">Next →</Link>}</div></div>
  </div>;
}
