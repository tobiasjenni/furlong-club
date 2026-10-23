export type DailyResultPoint = { day: string; returnBps: number };
export type CycleSummary = { endDay: string; profitBps: number; updatedAt: string };

export function parseReturnBps(input: unknown): number | null {
  if (typeof input !== 'string' || !/^[+-]?\d{1,4}(\.\d{1,2})?$/.test(input.trim())) return null;
  const text = input.trim(), [whole, fraction = ''] = text.replace(/^[+-]/, '').split('.');
  const value = (Number(whole) * 100 + Number(fraction.padEnd(2, '0'))) * (text.startsWith('-') ? -1 : 1);
  return value >= -10000 && value <= 100000 ? value : null;
}

export function compoundedPercent(points: DailyResultPoint[]): number | null {
  if (!points.length) return null;
  if (!points.every(p => Number.isInteger(p.returnBps) && p.returnBps >= -10000 && p.returnBps <= 100000)) throw new Error('Invalid daily return');
  return (points.reduce((value, point) => value * (1 + point.returnBps / 10000), 1) - 1) * 100;
}

export function signedPercent(percent: number | null, digits = 2): string {
  if (percent === null) return '—';
  const rounded = Number(percent.toFixed(digits));
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(digits)}%`;
}

export function cycleWindow(end: string, days = 33) {
  const date = new Date(end + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() - days + 1);
  return { start: date.toISOString().slice(0, 10), end };
}
