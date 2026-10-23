export function fundingCents(value: string | null | undefined) {
  if (!value || !/^\d{1,7}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function allocationCapacity(availableCents: number, committedCents: number) {
  return Math.max(0, Math.min(availableCents, 1000000 - committedCents));
}

export function defaultAllocationAmount(availableCents: number, committedCents: number, requested?: string) {
  const cap = allocationCapacity(availableCents, committedCents);
  const desired = fundingCents(requested);
  const cents = cap >= 50000 ? Math.min(cap, Math.max(50000, desired ?? 50000)) : 50000;
  return (cents / 100).toFixed(cents % 100 ? 2 : 0);
}

export function allocationRequestHref(cents: number, currency?: string, network?: string) {
  const params = new URLSearchParams({ amount: (Math.max(50000, Math.min(1000000, cents)) / 100).toFixed(2) });
  if (currency && network) { params.set("currency", currency); params.set("network", network); }
  return `/allocations?${params}#request`;
}
