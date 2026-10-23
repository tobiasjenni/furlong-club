import { requireUser } from '@/lib/auth';
import { clubResults } from '@/lib/club-results';
import { ResultsCalendar } from './ResultsCalendar';

export async function ClubResultsCalendar() {
  await requireUser();
  const results = await clubResults();
  return <ResultsCalendar {...results} />;
}
