const usdFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export function usd(cents: number) {
  return usdFormatter.format(cents / 100);
}

export function date(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(d));
}

export function dateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
}

export function dateTimeUtc(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(d));
}
