"use server";
import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { parseReturnBps } from '@/lib/daily-results';
import { rateLimit } from '@/lib/rate-limit';
import { utcDay } from '@/lib/portal-filters';

export type DailyResultState = { day: string; error?: string; ok?: string } | null;
export async function saveDailyResult(_: DailyResultState, form: FormData): Promise<DailyResultState> {
  const admin = await requireSuperAdmin();
  const day = String(form.get('day') ?? '');
  const fail = (error: string) => ({ day, error });
  if (!await rateLimit(`daily-result:${admin.id}`, 30, 60000)) return fail('Please wait a minute before trying again.');
  const validDay = utcDay(day), bps = parseReturnBps(form.get('returnPercent'));
  const revision = Number(form.get('revision')), note = String(form.get('sourceNote') ?? '').trim();
  const operation = String(form.get('operation'));
  if (!validDay || validDay.day !== day || day < '2000-01-01' || day > new Date().toISOString().slice(0, 10)) return fail('Choose a valid UTC date on or before today. Future daily results cannot be published.');
  if (bps === null || !Number.isInteger(revision) || revision < 0 || !['publish', 'retract'].includes(operation)) return fail('Enter a daily result from −100% to +1,000%, with up to two decimal places.');
  if (note.length < 10 || note.length > 1000 || form.get('verified') !== 'on') return fail('Add a supporting record / correction reason of 10–1,000 characters and confirm you checked this result.');
  let result: string;
  try {
    result = (await db.$queryRaw<{ result: string }[]>`SELECT club_save_daily_result(${admin.id},${day},${bps}::integer,${note},${revision}::integer,${operation === 'publish'},${crypto.randomUUID()}) AS result`)[0].result;
  } catch { return fail('The result was not saved. Reload this date and check the saved record before retrying.'); }
  if (result !== 'saved') return fail(({ stale: 'This date changed since you opened it. Open the date again before saving.', forbidden: 'Only the active Super Admin can publish club results.', invalid_day: 'Choose a valid UTC date on or before today.', missing: 'There is no saved result to retract.' } as Record<string, string>)[result] ?? 'Check the date, percentage and supporting record.');
  revalidatePath('/admin/results');
  revalidatePath('/admin/users', 'layout');
  revalidatePath('/(member)', 'layout');
  return { day, ok: operation === 'publish' ? 'Daily percentage published to every member’s calendar. The change is recorded in the audit log.' : 'Result retracted from member calendars. Its audit history is retained.' };
}

export async function saveCycleSummary(_: DailyResultState, form: FormData): Promise<DailyResultState> {
  const admin = await requireSuperAdmin(), day = String(form.get('endDay') ?? '');
  const fail = (error: string) => ({ day, error });
  if (!await rateLimit(`cycle-summary:${admin.id}`, 10, 60000)) return fail('Please wait a minute before trying again.');
  const parsed = utcDay(day), bps = parseReturnBps(form.get('profitPercent'));
  const revision = Number(form.get('revision')), note = String(form.get('sourceNote') ?? '').trim();
  if (!parsed || parsed.day !== day || bps === null || !Number.isInteger(revision) || revision < 0) return fail('Enter a valid cycle end date and net profit percentage from −100% to +1,000%.');
  if (note.length < 10 || note.length > 1000 || form.get('verified') !== 'on') return fail('Add the source / correction reason and confirm the summary is an owner-reported figure.');
  let result: string;
  try {
    result = (await db.$queryRaw<{ result: string }[]>`SELECT club_save_cycle_summary(${admin.id},${day},${bps}::integer,${note},${revision}::integer,${form.get('published') === 'on'},${crypto.randomUUID()}) AS result`)[0].result;
  } catch { return fail('The cycle summary was not saved. Reload before retrying.'); }
  if (result !== 'saved') return fail(result === 'stale' ? 'The cycle summary changed. Reload before saving.' : 'Check your permissions, source and end date. The end date may be up to one year ahead.');
  revalidatePath('/admin/results');revalidatePath('/admin/users', 'layout');revalidatePath('/(member)', 'layout');
  return { day, ok: 'Owner-reported cycle summary saved. Daily history and personal payouts remain separate.' };
}
