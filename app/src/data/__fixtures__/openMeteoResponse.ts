// Synthetic Open-Meteo responses in the real multi-model format
// (`<variable>_<model>` keys, `null` where a model has no data).

import { FALLBACK_MODEL, PRIMARY_MODEL, type LocationResponse } from '../openMeteo';

const VARS = [
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

export interface FakeOptions {
  /** First local date of the series. */
  start: string;
  days: number;
  /** Hours (from start) after which MeteoSwiss has no data. */
  primaryHours: number;
  /** Value per variable for the primary model; global model gets value + 1 (to tell them apart). */
  values?: Partial<Record<(typeof VARS)[number], number>>;
  /** Snowfall per hour in cm (both models). */
  snowPerHour?: (index: number) => number;
}

const DEFAULTS: Record<(typeof VARS)[number], number> = {
  temperature_2m: -5,
  cloud_cover: 20,
  cloud_cover_low: 10,
  cloud_cover_mid: 10,
  cloud_cover_high: 20,
  wind_speed_10m: 10,
  wind_gusts_10m: 25,
  visibility: 20000,
  sunshine_duration: 3000,
  precipitation: 0,
  snowfall: 0,
};

export function fakeLocation(lat: number, lon: number, elevation: number, o: FakeOptions): LocationResponse {
  const time: string[] = [];
  const [y, m, d] = o.start.split('-').map(Number) as [number, number, number];
  for (let day = 0; day < o.days; day++) {
    const date = new Date(Date.UTC(y, m - 1, d + day)).toISOString().slice(0, 10);
    for (let h = 0; h < 24; h++) time.push(`${date}T${String(h).padStart(2, '0')}:00`);
  }
  const hourly: Record<string, (number | null)[] | string[]> = { time };
  for (const v of VARS) {
    const base = o.values?.[v] ?? DEFAULTS[v];
    hourly[`${v}_${PRIMARY_MODEL}`] = time.map((_, i) => {
      if (v === 'visibility') return null; // MeteoSwiss has no visibility
      if (i >= o.primaryHours) return null;
      return v === 'snowfall' ? (o.snowPerHour?.(i) ?? 0) : base;
    });
    hourly[`${v}_${FALLBACK_MODEL}`] = time.map((_, i) => (v === 'snowfall' ? (o.snowPerHour?.(i) ?? 0) : base + 1));
  }
  return { latitude: lat, longitude: lon, elevation, hourly: hourly as LocationResponse['hourly'] };
}

export interface FakeFetchCall {
  url: string;
}

/** A fetch replacement that answers with fake data for each requested location. */
export function fakeFetch(o: FakeOptions, calls: FakeFetchCall[] = []) {
  return async (url: string) => {
    calls.push({ url });
    const q = new URL(url).searchParams;
    const lats = (q.get('latitude') ?? '').split(',').map(Number);
    const lons = (q.get('longitude') ?? '').split(',').map(Number);
    const els = (q.get('elevation') ?? '').split(',').map(Number);
    const list = lats.map((lat, i) => fakeLocation(lat, lons[i] ?? 0, els[i] ?? 0, o));
    return { ok: true, status: 200, json: async () => (list.length === 1 ? list[0] : list) };
  };
}
