// Navigation hints never choose a payment recipient, price or automatic purchase.
export function membershipReturnPath(value: unknown) {
  return typeof value === "string" && /^\/membership\/[a-z0-9][a-z0-9-]{0,79}$/.test(value) ? value : null;
}

export function membershipFundingAmount(priceCents: number, availableCents: number) {
  return Math.min(10000, Math.max(20, (priceCents - availableCents) / 100));
}
