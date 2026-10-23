"use client";
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveDailyResult, saveCycleSummary } from '@/app/actions/daily-results';
import { SubmitButton } from '@/components/SubmitButton';

export type DailyResultRecord = { day: string; returnBps: number; revision: number; published: boolean; sourceNote: string; updatedAt: string };
function Controls({ published, future }: { published: boolean; future: boolean }) {
  const { pending } = useFormStatus();
  return <div className="flex flex-wrap gap-3"><button name="operation" value="publish" className="btn-gold workspace-action-positive" disabled={pending || future} aria-busy={pending}>{pending ? 'Saving daily result…' : 'Publish daily result'}</button>{published && <button name="operation" value="retract" className="btn-danger" disabled={pending}>Retract this result</button>}</div>;
}
export function DailyResultForm({ day, today, record }: { day: string; today: string; record?: DailyResultRecord }) {
  const [state, action] = useActionState(saveDailyResult, null);
  return <section className="card space-y-4">
    <h2 className="text-xl">{record ? 'Review / correct' : 'Add'} daily result · {day}</h2>
    <p className="muted text-sm">Published percentages appear in every member’s dashboard, account profile and results page. Gains are green, losses are red and a recorded 0% is break-even. Use actual daily figures backed by your records.</p>
    <form action={action} key={`${day}:${record?.revision ?? 0}`} className="space-y-4">
      <input type="hidden" name="day" value={day} /><input type="hidden" name="revision" value={record?.revision ?? 0} />
      <label className="label">Daily profit / loss (%)<input name="returnPercent" type="number" min={-100} max={1000} step="0.01" required defaultValue={record ? record.returnBps / 100 : ''} className="input" placeholder="2.50 for a gain, −1.25 for a loss" /></label>
      <label className="label">Supporting record / reason for correction<textarea name="sourceNote" required minLength={10} maxLength={1000} rows={3} className="input" placeholder="Reference the actual trading statement or explain this correction" /></label>
      {record && <p className="muted break-words text-sm">Previous reference: {record.sourceNote}<br />Revision {record.revision} · {record.published ? 'Published' : 'Retracted'}</p>}
      <label className="flex items-start gap-3 text-sm"><input name="verified" type="checkbox" required className="mt-1 shrink-0" /><span>I checked this daily result against the supporting records. This publishes club performance without posting a member payout.</span></label>
      <Controls published={Boolean(record?.published)} future={day > today} />
    </form>
    {state?.day === day && (state.error ? <p role="alert" className="text-sm text-red-300">{state.error}</p> : <p role="status" className="text-sm text-emerald-300">{state.ok}</p>)}
  </section>;
}

export type CycleSummaryRecord = { endDay: string; profitBps: number; published: boolean; revision: number; sourceNote: string; lockDays: number };
export function CycleSummaryForm({ record }: { record?: CycleSummaryRecord }) {
  const [state, action] = useActionState(saveCycleSummary, null);
  return <section className="card space-y-4"><h2 className="text-xl">Owner-reported cycle summary</h2><p className="muted text-sm">This separate summary can show a cycle figure before its daily breakdown has been supplied. A future end date is marked in progress. It never creates a member balance or confirms a payout.</p>
    <form action={action} key={record?.revision ?? 0} className="space-y-4"><input type="hidden" name="revision" value={record?.revision ?? 0} />
      <label className="label">Reported period<select name="lockDays" className="input" defaultValue={record?.lockDays ?? 28}><option value="28">28 days · current syndicate</option><option value="33">33 days · historical cycle</option></select></label>
      <label className="label">Cycle end date (UTC)<input name="endDay" type="date" required defaultValue={record?.endDay} className="input" /></label>
      <label className="label">Reported net cycle profit (%)<input name="profitPercent" type="number" step="0.01" min={-100} max={1000} required defaultValue={record ? record.profitBps / 100 : ''} className="input" /></label>
      <label className="label">Summary source / correction reason<textarea name="sourceNote" required minLength={10} maxLength={1000} rows={3} className="input" /></label>
      {record && <p className="muted break-words text-xs">Previous reference: {record.sourceNote}</p>}
      <label className="flex items-start gap-3 text-sm"><input name="published" type="checkbox" defaultChecked={record?.published ?? true} className="mt-1" /><span>Show this owner-reported summary on member calendars</span></label>
      <label className="flex items-start gap-3 text-sm"><input name="verified" type="checkbox" required className="mt-1" /><span>I confirm this is the owner-reported net profit, separate from verified personal payouts and the daily breakdown.</span></label>
      <SubmitButton pendingLabel="Saving cycle summary…">Save cycle summary</SubmitButton>
    </form>{state && (state.error ? <p role="alert" className="text-sm text-red-300">{state.error}</p> : <p role="status" className="text-sm text-emerald-300">{state.ok}</p>)}
  </section>;
}
