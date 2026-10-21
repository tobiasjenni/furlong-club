export type PortalPoint = { day: string; valueCents: number; profitCents: number; dailyProfitCents: number; resultCount: number };
export type PortalSnapshot = {
  availableCents: number; activePrincipalCents: number; committedCents: number; payoutDueCents: number;
  valueCents: number; recordedProfitCents: number; resultPrincipalCents: number; paidOutCents: number;
  resultCount: number; activeCount: number; pendingCount: number; pendingDepositCount: number; pendingDepositCents: number;
  series: PortalPoint[]; asOf: string;
};
export function snapshotIsReconciled(snapshot: PortalSnapshot) {
  const last = snapshot.series.at(-1);
  return last ? last.valueCents === snapshot.valueCents && last.profitCents === snapshot.recordedProfitCents : snapshot.valueCents === 0 && snapshot.recordedProfitCents === 0;
}
export function safeSnapshot(snapshot: PortalSnapshot) {
  const numbers = Object.values(snapshot).filter(v => typeof v === "number");
  for (const point of snapshot.series) numbers.push(point.valueCents, point.profitCents, point.dailyProfitCents, point.resultCount);
  if (!numbers.every(Number.isSafeInteger)) throw new Error("Account metrics are outside the supported range");
  return snapshot;
}
