// Open-Meteo client. Weather data by Open-Meteo.com (CC BY 4.0), non-commercial use.
//
// One request asks for two models at once:
//  - `meteoswiss_icon_seamless` (ICON-CH1 for ~33 h, then ICON-CH2 up to ~120 h)
//  - `best_match` (global), used hour by hour where MeteoSwiss has no data (beyond ~5 days)
//    and always for visibility, which the MeteoSwiss models do not provide.
// Verified against the live API on 2026-11-27.

import type { GeoPoint, HourWeather, IsoDate, PointDayWeather } from '../engine/types';

export const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
export const PRIMARY_MODEL = 'meteoswiss_icon_seamless';
export const FALLBACK_MODEL = 'best_match';
export const ATTRIBUTION = 'Weather data by Open-Meteo.com';
export const ATTRIBUTION_LICENSE = 'CC BY 4.0';

export const MODEL_LABEL = {
  primary: 'ICON-CH (MeteoSchweiz)',
  fallback: 'Globales Modell (Best Match)',
  mixed: 'ICON-CH + globales Modell',
} as const;

const HOURLY = [
  'temperature_2m',
  'cloud_cover',
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
  'wind_speed_10m',
  'wind_gusts_10m',
  'visibility',
  'sunshine_duration',
  'precipitation',
  'snowfall',
] as const;
type HourlyVar = (typeof HOURLY)[number];

/** Locations per request (keeps URLs short and requests light). */
export const MAX_LOCATIONS_PER_REQUEST = 50;
export const PAST_DAYS = 3;
export const FORECAST_DAYS = 8;

/** Minimum number of usable hours for a day to count as covered. */
const MIN_HOURS_PER_DAY = 20;

export function buildForecastUrl(points: readonly GeoPoint[]): string {
  const p = new URLSearchParams({
    latitude: points.map((x) => x.lat.toFixed(4)).join(','),
    longitude: points.map((x) => x.lon.toFixed(4)).join(','),
    elevation: points.map((x) => Math.round(x.elevation)).join(','),
    hourly: HOURLY.join(','),
    models: `${PRIMARY_MODEL},${FALLBACK_MODEL}`,
    timezone: 'Europe/Zurich',
    wind_speed_unit: 'kmh',
    past_days: String(PAST_DAYS),
    forecast_days: String(FORECAST_DAYS),
  });
  return `${OPEN_METEO_URL}?${p.toString()}`;
}

export interface LocationResponse {
  latitude: number;
  longitude: number;
  elevation: number;
  hourly: { time: string[] } & Record<string, (number | null)[] | string[]>;
}

export class OpenMeteoError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'OpenMeteoError';
  }
}

function series(h: LocationResponse['hourly'], v: HourlyVar, model: string): (number | null)[] | undefined {
  const s = h[`${v}_${model}`];
  return Array.isArray(s) ? (s as (number | null)[]) : undefined;
}

/** Hour-by-hour merge: MeteoSwiss value if present, else global value. */
function merged(h: LocationResponse['hourly'], v: HourlyVar, i: number): { value: number | null; primary: boolean } {
  const a = series(h, v, PRIMARY_MODEL)?.[i];
  if (a !== null && a !== undefined) return { value: a, primary: true };
  const b = series(h, v, FALLBACK_MODEL)?.[i];
  return { value: b ?? null, primary: false };
}

/** Converts one location of the response into days in the engine format. */
export function parseLocation(loc: LocationResponse): Record<IsoDate, PointDayWeather> {
  const h = loc.hourly;
  const times = h.time;
  const snow: number[] = times.map((_, i) => merged(h, 'snowfall', i).value ?? 0);

  const byDate = new Map<IsoDate, { hours: HourWeather[]; primary: number; total: number; startIndex: number }>();
  times.forEach((t, i) => {
    const date = t.slice(0, 10);
    const hour = Number(t.slice(11, 13));
    const val = (v: HourlyVar) => merged(h, v, i);
    const temp = val('temperature_2m');
    const cloud = val('cloud_cover');
    const gust = val('wind_gusts_10m');
    let entry = byDate.get(date);
    if (!entry) {
      entry = { hours: [], primary: 0, total: 0, startIndex: i };
      byDate.set(date, entry);
    }
    if (temp.value === null || cloud.value === null || gust.value === null) return;
    const sunshine = val('sunshine_duration').value;
    const visibility = val('visibility').value;
    entry.total += 1;
    if (temp.primary) entry.primary += 1;
    entry.hours.push({
      hour,
      temperature: temp.value,
      cloudCover: cloud.value,
      cloudLow: val('cloud_cover_low').value ?? cloud.value,
      cloudMid: val('cloud_cover_mid').value ?? 0,
      cloudHigh: val('cloud_cover_high').value ?? 0,
      windSpeed: val('wind_speed_10m').value ?? 0,
      windGusts: gust.value,
      ...(visibility !== null ? { visibility } : {}),
      ...(sunshine !== null ? { sunshineMinutes: Math.min(60, sunshine / 60) } : {}),
      precipitation: val('precipitation').value ?? 0,
      snowfall: snow[i] ?? 0,
    });
  });

  const out: Record<IsoDate, PointDayWeather> = {};
  for (const [date, e] of byDate) {
    if (e.total < MIN_HOURS_PER_DAY) continue; // incomplete day → treated as missing (fail closed)
    // New snow: 72 h before 08:00 of this day.
    const eight = times.indexOf(`${date}T08:00`);
    const end = eight >= 0 ? eight : e.startIndex + 8;
    const newSnow72h = snow.slice(Math.max(0, end - 72), end).reduce((a, b) => a + b, 0);
    out[date] = {
      date,
      hours: e.hours,
      newSnow72h: Math.round(newSnow72h * 10) / 10,
      model: e.primary === e.total ? MODEL_LABEL.primary : e.primary === 0 ? MODEL_LABEL.fallback : MODEL_LABEL.mixed,
    };
  }
  return out;
}

export type FetchFn = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Fetches the forecast for all points (in chunks). Result is in the same order as `points`. */
export async function fetchForecast(points: readonly GeoPoint[], fetchFn: FetchFn = (u) => fetch(u)): Promise<Record<IsoDate, PointDayWeather>[]> {
  const result: Record<IsoDate, PointDayWeather>[] = [];
  for (let i = 0; i < points.length; i += MAX_LOCATIONS_PER_REQUEST) {
    const chunk = points.slice(i, i + MAX_LOCATIONS_PER_REQUEST);
    let res: Awaited<ReturnType<FetchFn>>;
    try {
      res = await fetchFn(buildForecastUrl(chunk));
    } catch (e) {
      throw new OpenMeteoError(`Keine Verbindung zu Open-Meteo (${e instanceof Error ? e.message : String(e)})`);
    }
    const body = (await res.json().catch(() => undefined)) as unknown;
    if (!res.ok) {
      const reason = body && typeof body === 'object' && 'reason' in body ? String((body as { reason: unknown }).reason) : `HTTP ${res.status}`;
      throw new OpenMeteoError(`Open-Meteo: ${reason}`, res.status);
    }
    const list = (Array.isArray(body) ? body : [body]) as LocationResponse[];
    if (list.length !== chunk.length || list.some((l) => !l || !l.hourly || !Array.isArray(l.hourly.time))) {
      throw new OpenMeteoError('Open-Meteo: unerwartetes Antwortformat');
    }
    for (const loc of list) result.push(parseLocation(loc));
  }
  return result;
}
