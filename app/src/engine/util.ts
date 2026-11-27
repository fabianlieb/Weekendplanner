import type { DayKey, IsoDate, Minutes } from './types';
import type { Ramp } from './thresholds';

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** Linear ramp: `bad` → 0, `good` → 100. Works for both directions. */
export function ramp(value: number, r: Ramp): number {
  if (r.bad === r.good) return value === r.good ? 100 : 0;
  return clamp(((value - r.bad) / (r.good - r.bad)) * 100, 0, 100);
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Weighted average over the keys present in `scores`; missing keys are ignored. */
export function weighted(
  scores: Readonly<Partial<Record<string, number>>>,
  weights: Readonly<Partial<Record<string, number>>>,
): number {
  let total = 0;
  let weightSum = 0;
  for (const [key, w] of Object.entries(weights)) {
    const s = scores[key];
    if (s === undefined || w === undefined) continue;
    total += s * w;
    weightSum += w;
  }
  return weightSum === 0 ? 0 : total / weightSum;
}

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---------------------------------------------------------------------------
// Time and dates (Europe/Zurich)

export const TIME_ZONE = 'Europe/Zurich';

export function formatTime(m: Minutes): string {
  const total = ((Math.round(m) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const min = total % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function parseTime(s: string): Minutes {
  const [h, m] = s.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function parseIsoDate(d: IsoDate): { y: number; m: number; day: number } {
  const [y, m, day] = d.split('-').map(Number);
  return { y: y ?? 1970, m: m ?? 1, day: day ?? 1 };
}

/** Adds days to a calendar date (no time zone involved). */
export function addDays(d: IsoDate, days: number): IsoDate {
  const { y, m, day } = parseIsoDate(d);
  const date = new Date(Date.UTC(y, m - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(d: IsoDate): number {
  const { y, m, day } = parseIsoDate(d);
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay();
}

/** Offset of Europe/Zurich from UTC in minutes for the given instant (60 in winter, 120 in summer). */
const ZURICH_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
const ZURICH_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE });

export function zurichOffsetMinutes(instant: Date): number {
  const parts = ZURICH_PARTS.formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((asUtc - Math.floor(instant.getTime() / 60000) * 60000) / 60000);
}

/** Local noon of a Zurich calendar date as an instant. */
export function zurichNoon(d: IsoDate): Date {
  const { y, m, day } = parseIsoDate(d);
  const guess = new Date(Date.UTC(y, m - 1, day, 12));
  return new Date(guess.getTime() - zurichOffsetMinutes(guess) * 60000);
}

/** Minutes since Zurich midnight of `d` for an instant (may be < 0 or ≥ 1440 for other days). */
export function zurichMinutes(instant: Date, d: IsoDate): Minutes {
  const { y, m, day } = parseIsoDate(d);
  const midnightGuess = new Date(Date.UTC(y, m - 1, day));
  const midnight = midnightGuess.getTime() - zurichOffsetMinutes(midnightGuess) * 60000;
  return Math.round((instant.getTime() - midnight) / 60000);
}

const ZURICH_HOUR = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', hourCycle: 'h23' });

/** Current hour 0–23 in Zurich. */
export function zurichHour(now: Date = new Date()): number {
  return Number(ZURICH_HOUR.format(now));
}

/** Today's date in Zurich. */
export function zurichToday(now: Date = new Date()): IsoDate {
  return ZURICH_DATE.format(now);
}

/**
 * The weekend the planner looks at: the coming Saturday and Sunday.
 * On Saturday it is today + tomorrow, on Sunday only today.
 */
export function upcomingWeekend(today: IsoDate): Partial<Record<DayKey, IsoDate>> {
  const wd = weekday(today);
  if (wd === 0) return { sun: today };
  const sat = addDays(today, 6 - wd);
  return { sat, sun: addDays(sat, 1) };
}
