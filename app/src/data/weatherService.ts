// Loads weather for all candidates: from the IndexedDB cache if fresh, else from Open-Meteo.
// Offline or on errors, the last cached data is used and flagged.

import type { Candidate, CandidateWeather, GeoPoint, IsoDate, PointDayWeather } from '../engine/types';
import type { PlannerDB, WeatherCacheRow } from './db';
import { fetchForecast, type FetchFn } from './openMeteo';

/** Cached data younger than this is used without a new request. */
export const CACHE_MAX_AGE_MINUTES = 90;
/** Cache rows older than this are deleted. */
export const CACHE_PRUNE_DAYS = 14;

export const pointKey = (p: GeoPoint) => `${p.lat.toFixed(4)},${p.lon.toFixed(4)},${Math.round(p.elevation)}`;

export interface WeatherLoadResult {
  weather: Record<string, CandidateWeather>;
  /** Oldest fetch time of the data used. */
  fetchedAt?: string;
  /** True if at least some data comes from an old cache because the request failed. */
  fromStaleCache: boolean;
  error?: string;
}

export interface WeatherLoadOptions {
  now?: Date;
  fetchFn?: FetchFn;
  /** Ignore the cache age and request new data (e.g. evening check). */
  forceRefresh?: boolean;
}

export async function loadWeather(db: PlannerDB, candidates: readonly Candidate[], opts: WeatherLoadOptions = {}): Promise<WeatherLoadResult> {
  const now = opts.now ?? new Date();
  const points = new Map<string, GeoPoint>();
  for (const c of candidates) {
    if (!c.active) continue;
    points.set(pointKey(c.valley), c.valley);
    points.set(pointKey(c.summit), c.summit);
  }

  const keys = [...points.keys()];
  const cached = new Map<string, WeatherCacheRow>();
  for (const row of await db.weatherCache.bulkGet(keys)) if (row) cached.set(row.key, row);

  const maxAge = CACHE_MAX_AGE_MINUTES * 60000;
  const isFresh = (r: WeatherCacheRow | undefined) => !!r && now.getTime() - Date.parse(r.fetchedAt) < maxAge;
  const toFetch = opts.forceRefresh ? keys : keys.filter((k) => !isFresh(cached.get(k)));

  let error: string | undefined;
  let fromStaleCache = false;
  if (toFetch.length > 0) {
    try {
      const days = await fetchForecast(
        toFetch.map((k) => points.get(k) as GeoPoint),
        opts.fetchFn,
      );
      const fetchedAt = now.toISOString();
      const rows: WeatherCacheRow[] = toFetch.map((key, i) => ({ key, fetchedAt, days: days[i] ?? {} }));
      await db.weatherCache.bulkPut(rows);
      for (const r of rows) cached.set(r.key, r);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      fromStaleCache = toFetch.some((k) => cached.has(k));
    }
  }

  const pruneBefore = new Date(now.getTime() - CACHE_PRUNE_DAYS * 86400000).toISOString();
  await db.weatherCache.where('fetchedAt').below(pruneBefore).delete();

  const daysFor = (p: GeoPoint): Record<IsoDate, PointDayWeather> => cached.get(pointKey(p))?.days ?? {};
  const weather: Record<string, CandidateWeather> = {};
  let oldest: string | undefined;
  for (const c of candidates) {
    if (!c.active) continue;
    weather[c.id] = { valley: daysFor(c.valley), summit: daysFor(c.summit) };
    for (const p of [c.valley, c.summit]) {
      const at = cached.get(pointKey(p))?.fetchedAt;
      if (at && (!oldest || at < oldest)) oldest = at;
    }
  }
  return { weather, ...(oldest ? { fetchedAt: oldest } : {}), fromStaleCache, ...(error ? { error } : {}) };
}
