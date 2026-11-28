// Measured snow depth (SLF IMIS) near a place: the nearest flat-field station in the height band
// of the activity. Only used where such a station exists; otherwise nothing changes.

import { THRESHOLDS } from './thresholds';
import type { Candidate, IsoDate } from './types';
import { addDays, haversineKm } from './util';

export interface SnowStation {
  /** Station code, e.g. «DAV2». */
  c: string;
  /** Station name. */
  n: string;
  lat: number;
  lon: number;
  /** Elevation, m. */
  e: number;
  /** Measurement date. */
  d: IsoDate;
  /** Snow depth, cm. */
  hs: number;
  /** New snow of the last 3 days, cm. */
  hn3: number;
}

export interface SnowObservation {
  station: string;
  elevation: number;
  distanceKm: number;
  date: IsoDate;
  depthCm: number;
  newSnow3dCm: number;
}

/**
 * Nearest station within reach whose elevation lies between the start (minus a margin) and the
 * summit (plus a margin), with a measurement not older than a few days. Distance counts with
 * height difference (100 m ≈ 1 km).
 */
export function snowFor(c: Pick<Candidate, 'valley' | 'summit'>, stations: readonly SnowStation[], today: IsoDate): SnowObservation | undefined {
  const t = THRESHOLDS.snow;
  const lo = Math.min(c.valley.elevation, c.summit.elevation) - t.belowStartM;
  const hi = Math.max(c.valley.elevation, c.summit.elevation) + t.aboveSummitM;
  const mid = { lat: (c.valley.lat + c.summit.lat) / 2, lon: (c.valley.lon + c.summit.lon) / 2 };
  const oldest = addDays(today, -t.maxAgeDays);
  let best: { s: SnowStation; km: number; cost: number } | undefined;
  for (const s of stations) {
    if (s.e < lo || s.e > hi || s.d < oldest) continue;
    const km = haversineKm(mid, s);
    if (km > t.maxKm) continue;
    const cost = km + Math.abs(s.e - c.summit.elevation) / 100;
    if (!best || cost < best.cost) best = { s, km, cost };
  }
  if (!best) return undefined;
  return {
    station: best.s.n,
    elevation: best.s.e,
    distanceKm: Math.round(best.km),
    date: best.s.d,
    depthCm: best.s.hs,
    newSnow3dCm: best.s.hn3,
  };
}

/** Too little measured snow for a tour or trail (never for pistes and photo spots). */
export function snowTooLow(activity: string, obs: SnowObservation | undefined): boolean {
  if (!obs) return false;
  const min = THRESHOLDS.snow.minDepthCm[activity as keyof typeof THRESHOLDS.snow.minDepthCm];
  return min !== undefined && obs.depthCm < min;
}
