// Measured snow (SLF IMIS), published with the app as data/snow.json (see scripts/build-snow.mjs).
// Network first; the last copy stays in IndexedDB for offline use. Missing file → no snow data.

import { snowFor, type SnowObservation, type SnowStation } from '../engine/snow';
import type { Candidate, IsoDate } from '../engine/types';
import type { PlannerDB } from './db';

export const SNOW_ATTRIBUTION = 'Schneedaten: SLF (IMIS)';
export const SLF_URL = 'https://www.slf.ch';

export interface SnowData {
  generatedAt: string;
  date: IsoDate;
  stations: SnowStation[];
}

type Fetch = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
const KEY = 'snowData';

function valid(j: unknown): j is SnowData {
  const d = j as Partial<SnowData> | undefined;
  return !!d && typeof d.generatedAt === 'string' && typeof d.date === 'string' && Array.isArray(d.stations);
}

export async function loadSnow(db: PlannerDB, fetchFn?: Fetch): Promise<SnowData | undefined> {
  try {
    const base = (import.meta.env?.BASE_URL as string | undefined) ?? '/';
    const f: Fetch = fetchFn ?? ((u) => fetch(u, { cache: 'no-cache', signal: AbortSignal.timeout(8000) }));
    const r = await f(`${base}data/snow.json`);
    if (r.ok) {
      const j = await r.json();
      if (valid(j)) {
        await db.settings.put({ key: KEY, value: j });
        return j;
      }
    }
  } catch {
    // offline: last copy
  }
  const row = await db.settings.get(KEY);
  return valid(row?.value) ? row.value : undefined;
}

/** Snow observation per candidate id, only where a station is in reach. */
export function snowByCandidate(candidates: readonly Candidate[], data: SnowData | undefined, today: IsoDate): Record<string, SnowObservation> {
  const out: Record<string, SnowObservation> = {};
  if (!data) return out;
  for (const c of candidates) {
    const obs = snowFor(c, data.stations, today);
    if (obs) out[c.id] = obs;
  }
  return out;
}
