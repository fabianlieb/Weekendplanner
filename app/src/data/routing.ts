// Routed travel times without keys: OSRM (car) and transport.opendata.ch (public transport).
// Sent to the services: the start point rounded to ~1 km and the (public) destinations.
// Results are cached in IndexedDB; on any failure the engine falls back to its estimate.

import { THRESHOLDS } from '../engine/thresholds';
import { startKey, travelDestination } from '../engine/travel';
import type { Candidate, IsoDate, RoutedTravel, StartPoint, StationRef, TravelMode } from '../engine/types';
import { haversineKm } from '../engine/util';
import type { PlannerDB } from './db';

export type RoutingFetch = (url: string) => Promise<{ ok: boolean; status?: number; json(): Promise<unknown> }>;
const defaultFetch: RoutingFetch = (u) => fetch(u, { signal: AbortSignal.timeout(10_000) });

export const OSRM = 'https://router.project-osrm.org';
export const TRANSPORT = 'https://transport.opendata.ch/v1';
export const ROUTING_ATTRIBUTION = 'Fahrzeiten: OSRM, Kartendaten © OpenStreetMap-Mitwirkende · ÖV: transport.opendata.ch';

export interface Station extends StationRef {
  lat: number;
  lon: number;
}

/** Cache row: a car time, a stop near a point, or a connection time between two stops. */
export interface TravelCacheRow {
  id: string;
  fetchedAt: string;
  minutes?: number;
  station?: Station;
}

const R = THRESHOLDS.routing;
type LatLon = { lat: number; lon: number };
const coordKey = (p: LatLon) => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`;
const roundStart = (p: LatLon): LatLon => ({ lat: Number(p.lat.toFixed(R.startDecimals)), lon: Number(p.lon.toFixed(R.startDecimals)) });
const fresh = (row: TravelCacheRow | undefined, days: number, now: Date): row is TravelCacheRow =>
  !!row && (now.getTime() - new Date(row.fetchedAt).getTime()) / 86_400_000 < days;

/** Walking time for an air distance (path ≈ 1.3 × air distance). */
export function walkMinutes(km: number): number {
  return Math.round(((km * 1.3) / R.walkKmh) * 60);
}

/** «00d03:05:00» → 185 */
export function parseDuration(d: unknown): number | undefined {
  const m = String(d ?? '').match(/(\d+)d(\d+):(\d+):(\d+)/);
  return m ? Number(m[1]) * 1440 + Number(m[2]) * 60 + Number(m[3]) : undefined;
}

// ---------------------------------------------------------------------------
// Services

/** Car minutes from a start (rounded) to many destinations: one OSRM table request per 80 destinations. */
export async function fetchCarMinutes(start: LatLon, dests: readonly LatLon[], fetchFn: RoutingFetch = defaultFetch): Promise<(number | undefined)[]> {
  const out: (number | undefined)[] = [];
  const s = roundStart(start);
  for (let i = 0; i < dests.length; i += 80) {
    const chunk = dests.slice(i, i + 80);
    const coords = [`${s.lon},${s.lat}`, ...chunk.map((d) => `${d.lon.toFixed(5)},${d.lat.toFixed(5)}`)].join(';');
    const r = await fetchFn(`${OSRM}/table/v1/driving/${coords}?sources=0&annotations=duration`);
    if (!r.ok) throw new Error(`OSRM HTTP ${r.status ?? ''}`);
    const j = (await r.json()) as { code?: string; durations?: (number | null)[][] };
    const row = j.code === 'Ok' ? j.durations?.[0] : undefined;
    chunk.forEach((_, k) => {
      const sec = row?.[k + 1];
      out.push(typeof sec === 'number' ? Math.round((sec / 60) * R.carFactor + R.carExtraMinutes) : undefined);
    });
  }
  return out;
}

/**
 * Stop nearest to a point. For a private start point only the rounded position is sent;
 * the nearest of the returned stops is then picked here with the exact position.
 */
export async function fetchNearestStation(p: LatLon, isPrivate: boolean, fetchFn: RoutingFetch = defaultFetch): Promise<Station | undefined> {
  const q = isPrivate ? roundStart(p) : { lat: Number(p.lat.toFixed(5)), lon: Number(p.lon.toFixed(5)) };
  const r = await fetchFn(`${TRANSPORT}/locations?x=${q.lat}&y=${q.lon}&type=station`);
  if (!r.ok) throw new Error(`transport HTTP ${r.status ?? ''}`);
  const j = (await r.json()) as { stations?: { id?: string | null; name?: string; coordinate?: { x?: number | null; y?: number | null } }[] };
  const list: Station[] = [];
  for (const s of j.stations ?? []) {
    const lat = s.coordinate?.x;
    const lon = s.coordinate?.y;
    if (s.id && s.name && typeof lat === 'number' && typeof lon === 'number') list.push({ id: String(s.id), name: s.name, lat, lon });
  }
  return list.sort((a, b) => haversineKm(a, p) - haversineKm(b, p))[0];
}

export interface Connection {
  departure: string;
  arrival: string;
  minutes: number;
  transfers: number;
  products: string[];
}

/** Connections between two stops on a date from (or arriving by) a time. */
export async function fetchConnections(
  from: StationRef,
  to: StationRef,
  date: IsoDate,
  time: string,
  opts: { arrival?: boolean; limit?: number; fetchFn?: RoutingFetch } = {},
): Promise<Connection[]> {
  const q = new URLSearchParams({ from: from.id, to: to.id, date, time, limit: String(opts.limit ?? 4) });
  if (opts.arrival) q.set('isArrivalTime', '1');
  const r = await (opts.fetchFn ?? defaultFetch)(`${TRANSPORT}/connections?${q}`);
  if (!r.ok) throw new Error(`transport HTTP ${r.status ?? ''}`);
  const j = (await r.json()) as {
    connections?: { from?: { departure?: string }; to?: { arrival?: string }; duration?: string; transfers?: number; products?: string[] }[];
  };
  const out: Connection[] = [];
  for (const c of j.connections ?? []) {
    const minutes = parseDuration(c.duration);
    if (!c.from?.departure || !c.to?.arrival || minutes === undefined) continue;
    out.push({ departure: c.from.departure, arrival: c.to.arrival, minutes, transfers: c.transfers ?? 0, products: (c.products ?? []).filter(Boolean) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Attach routed times to candidates (cache first, then optionally the services)

export interface AttachOptions {
  now?: Date;
  fetchFn?: RoutingFetch;
  /** Ask the services for missing values (otherwise cache only). */
  fetchMissing?: boolean;
  /** Date for timetable queries (the coming Saturday). */
  date?: IsoDate;
  /** Public transport: look these candidate ids up first (likely suggestions). */
  priority?: readonly string[];
}

/**
 * Candidates with `routedTravel` for this start point and mode where known.
 * Car: OSRM time to the parking (or start). Public transport: walk to the nearest stop, fastest
 * morning connection, walk to the start; a stop beyond walking distance means «not reachable».
 */
export async function attachRoutedTravel(db: PlannerDB, candidates: readonly Candidate[], sp: StartPoint, opts: AttachOptions = {}): Promise<Candidate[]> {
  const mode: TravelMode = sp.mode ?? 'car';
  try {
    return mode === 'car' ? await attachCar(db, candidates, sp, opts) : await attachTransit(db, candidates, sp, opts);
  } catch {
    return [...candidates]; // offline or blocked: estimates
  }
}

async function attachCar(db: PlannerDB, candidates: readonly Candidate[], sp: StartPoint, opts: AttachOptions): Promise<Candidate[]> {
  const now = opts.now ?? new Date();
  const key = startKey(sp, 'car');
  const ids = candidates.map((c) => `${key}>${coordKey(travelDestination(c, 'car'))}`);
  const rows = await db.travelCache.bulkGet(ids);
  const known = new Map<string, number>();
  rows.forEach((r, i) => {
    if (fresh(r, R.carCacheDays, now) && r.minutes !== undefined) known.set(ids[i]!, r.minutes);
  });
  if (opts.fetchMissing) {
    const missing = [...new Set(ids.filter((id) => !known.has(id)))];
    if (missing.length) {
      try {
        const dests = missing.map((id) => {
          const [lat, lon] = id.split('>')[1]!.split(',').map(Number);
          return { lat: lat!, lon: lon! };
        });
        const minutes = await fetchCarMinutes(sp, dests, opts.fetchFn);
        const put: TravelCacheRow[] = [];
        missing.forEach((id, i) => {
          const m = minutes[i];
          if (m !== undefined) {
            known.set(id, m);
            put.push({ id, fetchedAt: now.toISOString(), minutes: m });
          }
        });
        await db.travelCache.bulkPut(put);
      } catch {
        // keep the estimates
      }
    }
  }
  return candidates.map((c, i) => {
    const m = known.get(ids[i]!);
    return m === undefined ? c : { ...c, routedTravel: { startKey: key, mode: 'car', minutes: m } };
  });
}

async function attachTransit(db: PlannerDB, candidates: readonly Candidate[], sp: StartPoint, opts: AttachOptions): Promise<Candidate[]> {
  const now = opts.now ?? new Date();
  const fetchFn = opts.fetchFn ?? defaultFetch;
  let budget = opts.fetchMissing ? R.transitLookupsPerRun : 0;

  const station = async (p: LatLon, isPrivate: boolean): Promise<Station | null | undefined> => {
    const id = `stop>${isPrivate ? coordKey(roundStart(p)) : coordKey(p)}`;
    const row = await db.travelCache.get(id);
    if (fresh(row, R.stationCacheDays, now)) return row.station ?? null;
    if (budget <= 0) return undefined;
    budget--;
    const s = await fetchNearestStation(p, isPrivate, fetchFn);
    await db.travelCache.put({ id, fetchedAt: now.toISOString(), ...(s ? { station: s } : {}) });
    return s ?? null;
  };
  const connection = async (a: Station, b: Station): Promise<number | null | undefined> => {
    if (a.id === b.id) return 0;
    const id = `conn>${a.id}>${b.id}`;
    const row = await db.travelCache.get(id);
    if (fresh(row, R.transitCacheDays, now)) return row.minutes ?? null;
    if (budget <= 0 || !opts.date) return undefined;
    budget--;
    const list = await fetchConnections(a, b, opts.date, R.transitQueryTime, { fetchFn });
    const best = list.length ? Math.min(...list.map((c) => c.minutes)) : undefined;
    await db.travelCache.put({ id, fetchedAt: now.toISOString(), ...(best !== undefined ? { minutes: best } : {}) });
    return best ?? null;
  };

  const from = await station(sp, true);
  if (!from) return [...candidates];
  const key = startKey(sp, 'transit');
  const walkTo = walkMinutes(haversineKm(sp, from));
  // Likely suggestions first, then the closest places, so a limited number of lookups covers what matters.
  const rank = new Map((opts.priority ?? []).map((id, k) => [id, k]));
  const order = candidates
    .map((c, i) => ({ i, p: rank.get(c.id) ?? Infinity, km: haversineKm(sp, c.valley) }))
    .sort((a, b) => a.p - b.p || a.km - b.km);
  const out = [...candidates];
  let next = 0;
  const lookup = async (i: number) => {
    const c = candidates[i]!;
    try {
      const to = await station(c.valley, false);
      if (to === undefined) return;
      const walkFrom = to ? walkMinutes(haversineKm(to, c.valley)) : Infinity;
      let routed: RoutedTravel;
      if (!to || walkFrom > R.maxWalkMinutes) {
        routed = { startKey: key, mode: 'transit', minutes: Infinity };
      } else {
        const conn = await connection(from, to);
        if (conn === undefined) return;
        routed =
          conn === null
            ? { startKey: key, mode: 'transit', minutes: Infinity }
            : {
                startKey: key,
                mode: 'transit',
                minutes: walkTo + conn + walkFrom,
                transit: { from: { id: from.id, name: from.name }, to: { id: to.id, name: to.name }, walkToMinutes: walkTo, walkFromMinutes: walkFrom },
              };
      }
      out[i] = { ...c, routedTravel: routed };
    } catch {
      budget = 0; // service unreachable: estimates for the rest
    }
  };
  const worker = async () => {
    while (next < order.length) {
      const { i } = order[next++]!;
      await lookup(i);
    }
  };
  await Promise.all(Array.from({ length: R.transitConcurrency }, worker));
  return out;
}
