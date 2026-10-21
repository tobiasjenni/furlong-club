export const textParam = (value: unknown, max = 80) => typeof value === "string" ? value.trim().slice(0, max) : "";
export const pageParam = (value: unknown) => Math.max(1, Math.min(100000, Number.parseInt(textParam(value, 8), 10) || 1));
export function utcDay(value: unknown) {
  const day = textParam(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const start = new Date(day + "T00:00:00Z");
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== day) return null;
  return { day, start, end: new Date(start.getTime() + 86400000) };
}
