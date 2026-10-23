import { fundingCents } from "./member-funding";

// An illustration only; no account, trading request or ledger state is changed.
export function allocationScenario(amount: string, assumedReturn: string) {
  const principalCents = fundingCents(amount);
  const percent = assumedReturn.trim() === "" ? NaN : Number(assumedReturn);
  if (principalCents === null || principalCents < 50000 || principalCents > 1000000 || !Number.isFinite(percent) || percent < -100) return null;
  const profitCents = Math.round(principalCents * (percent / 100));
  const totalCents = principalCents + profitCents;
  if (!Number.isSafeInteger(profitCents) || !Number.isSafeInteger(totalCents)) return null;
  return { principalCents, percent, profitCents, totalCents };
}
