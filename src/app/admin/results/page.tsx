import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { clubResults } from '@/lib/club-results';
import { compoundedPercent, signedPercent } from '@/lib/daily-results';
import { utcDay } from '@/lib/portal-filters';
import { ResultsCalendar } from '@/components/v2/ResultsCalendar';
import { DailyResultForm, CycleSummaryForm, type CycleSummaryRecord, type DailyResultRecord } from './DailyResultForm';

export default async function AdminDailyResults({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const admin = await requireAdmin(), params = await searchParams;
  const today = new Date().toISOString().slice(0, 10), day = utcDay(params.day)?.day ?? today;
  const monthStart = day.slice(0, 7) + '-01';
  const [records, published, summaries] = await Promise.all([
    db.$queryRaw<DailyResultRecord[]>`SELECT to_char(day,'YYYY-MM-DD') AS day,"returnBps",revision,published,"sourceNote",to_char("updatedAt",'YYYY-MM-DD HH24:MI:SS') AS "updatedAt"
      FROM "ClubDailyResult" WHERE day>=${monthStart}::date AND day<${monthStart}::date+interval '1 month' ORDER BY day DESC`,
    clubResults(),
    db.$queryRaw<CycleSummaryRecord[]>`SELECT to_char("endDay",'YYYY-MM-DD') AS "endDay","profitBps","lockDays",published,revision,"sourceNote" FROM "ClubCycleSummary" WHERE id='harry'`,
  ]);
  const selected = records.find(row => row.day === day);
  const visible = records.filter(row => row.published);
  return <div className="space-y-5">
    <div><h2 className="text-2xl">Daily club performance</h2><p className="muted mt-2 text-sm">A shared percentage calendar for every member. Daily figures compound into monthly and 28-day summaries. Wallet balances, personal allocation results and payouts keep their own financial records.</p></div>
    <form className="card flex flex-wrap items-end gap-3"><label className="label">UTC result date<input name="day" type="date" min="2000-01-01" max={today} required defaultValue={day} className="input" /></label><button className="btn-ghost">Open date</button></form>
    <div className="grid items-start gap-5 xl:grid-cols-2"><div className="space-y-5">{admin.role === 'SUPER_ADMIN' ? <DailyResultForm day={day} today={today} record={selected} /> : <div className="card"><h3 className="text-lg">Read-only performance history</h3><p className="muted mt-2 text-sm">Only Super Admin can publish, correct or retract daily figures.</p></div>}<div className="card"><h3 className="text-lg">How totals are calculated</h3><p className="muted mt-2 text-sm">Compound return = (1 + day 1 return) × (1 + day 2 return) × … − 1. For example, +10% then −10% gives −1%, rather than 0%. Missing days remain unknown; enter 0% when a genuine break-even / no-trading day is confirmed.</p><p className="muted mt-2 text-sm">A 148% net cycle profit means $2,480 returned on $1,000 principal. It is different from a 148% total payout. Enter each actual daily figure; a cycle total alone cannot determine its daily history.</p><Link href="/admin/audit" className="mt-3 inline-block text-sm text-gold-300 underline">Review the audit log →</Link></div></div><ResultsCalendar {...published} /></div>
    <section className="card overflow-x-auto"><h3 className="text-xl">{day.slice(0, 7)} · {visible.length} published days · {signedPercent(compoundedPercent(visible))} compounded</h3><p className="muted mt-2 text-sm">Totals cover reported days only. Retractions remain below for review.</p><table className="table mt-4"><thead><tr><th>UTC day</th><th>Daily return</th><th>State</th><th>Supporting record / correction</th><th>Updated UTC</th><th>Review</th></tr></thead><tbody>{records.map(row => <tr key={row.day}><td>{row.day}</td><td className={row.returnBps < 0 ? 'text-red-300' : row.returnBps > 0 ? 'text-emerald-300' : ''}>{signedPercent(row.returnBps / 100)}</td><td>{row.published ? 'Published' : 'Retracted'} · v{row.revision}</td><td className="max-w-sm whitespace-pre-wrap break-words text-xs">{row.sourceNote}</td><td>{row.updatedAt}</td><td><Link href={`/admin/results?day=${row.day}`} className="text-gold-300 underline">{admin.role === 'SUPER_ADMIN' ? 'Edit' : 'View'}</Link></td></tr>)}</tbody></table>{records.length === 0 && <p className="muted mt-4 text-sm">No daily results have been entered for this month.</p>}</section>
    {admin.role === 'SUPER_ADMIN' && <CycleSummaryForm record={summaries[0]} />}
  </div>;
}
