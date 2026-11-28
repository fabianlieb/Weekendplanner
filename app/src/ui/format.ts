import { DAY_LABEL } from '../engine/texts';
import type { Activity, DayKey, ExclusionReason, IsoDate, Slot, WeatherSummary } from '../engine/types';

export function formatDuration(minutes: number): string {
  const m = Math.round(minutes / 5) * 5;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

export function dayWithDate(day: DayKey, date: IsoDate): string {
  const [, m, d] = date.split('-');
  return `${DAY_LABEL[day]}, ${Number(d)}.${Number(m)}.`;
}

export function formatClock(iso: string): string {
  return new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export const EXCLUSION_LABEL: Partial<Record<ExclusionReason, string>> = {
  risk_unknown: 'ohne Skitourenguru-Farbe von heute',
  risk_stale: 'ohne Skitourenguru-Farbe von heute',
  risk_above_level: 'Risiko über deiner Stufe',
  risk_red_unconfirmed: 'rot ohne Bestätigung',
  equipment_missing: 'Material fehlt',
  travel_too_long: 'Anreise zu lang',
  travel_unknown: 'Startpunkt fehlt',
  time_budget: 'passt nicht ins Zeitbudget',
  start_too_early: 'Start vor deiner frühesten Abfahrt',
  daylight: 'zu lang fürs Tageslicht',
  fitness: 'über deiner Kondition und Tagesform',
  weather_missing: 'keine Wetterdaten',
  weather_knockout: 'Sturm',
  conditions_poor: 'Bedingungen zu schlecht',
  snow_low: 'zu wenig Schnee (SLF-Messstation)',
};

/** «4 × ohne Skitourenguru-Farbe von heute, 2 × Anreise zu lang» (merges risk_unknown/stale). */
export function summaryText(summary: Partial<Record<ExclusionReason, number>> | undefined, max = 4): string | undefined {
  if (!summary) return undefined;
  const merged = new Map<string, number>();
  for (const [reason, n] of Object.entries(summary) as [ExclusionReason, number][]) {
    const label = EXCLUSION_LABEL[reason];
    if (!label || !n) continue;
    merged.set(label, Math.max(merged.get(label) ?? 0, n));
  }
  const parts = [...merged.entries()].sort((a, b) => b[1] - a[1]).slice(0, max);
  return parts.length ? parts.map(([l, n]) => `${n} × ${l}`).join(', ') : undefined;
}

const signed = (n: number) => (n < 0 ? `−${Math.abs(n)}` : String(n));

/** «−5 °C · Böen 25 km/h · 6 h Sonne · 12 cm Neuschnee · Nebelmeer wahrscheinlich» */
export function weatherLine(w: WeatherSummary, activity: Activity, slot: Slot): string {
  const parts = [`${signed(w.temperature)} °C`, `Böen ${w.maxGust} km/h`];
  if (slot === 'day' && activity !== 'photo' && w.sunshineHours !== undefined) {
    const h = Math.round(w.sunshineHours);
    parts.push(h === 0 ? 'kaum Sonne' : `${h} h Sonne`);
  } else {
    parts.push(`Bewölkung ${w.cloudCover} %`);
  }
  if (activity !== 'photo' && w.newSnowCm >= 1) parts.push(`${w.newSnowCm} cm Neuschnee`);
  if (w.moonIllumination !== undefined) parts.push(`Mond ${Math.round(w.moonIllumination * 100)} %`);
  if (w.precipitationMm >= 1) parts.push(`${String(w.precipitationMm).replace('.', ',')} mm Niederschlag`);
  if (w.fogSeaLikely) parts.push('Nebelmeer wahrscheinlich');
  return parts.join(' · ');
}

export function signedTemp(n: number): string {
  return `${signed(n)}°`;
}
