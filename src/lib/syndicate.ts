export const syndicateLockDays = 28;
export type SyndicateEntry = { id: string; phase: "FULL" | "NEW"; startsAt: string; endsAt: string };
export const moonPhaseName = (phase: string) => phase === "FULL" ? "Full moon" : "New moon";
export const entryDate = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
export function nextSyndicateEntry(entries: SyndicateEntry[], now: number) {
  return entries.find(entry => Date.parse(entry.startsAt) > now) ?? null;
}
export function countdownParts(startsAt: string, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(startsAt) - now) / 1000));
  return { days: Math.floor(seconds / 86400), hours: Math.floor(seconds % 86400 / 3600), minutes: Math.floor(seconds % 3600 / 60), seconds: seconds % 60 };
}
