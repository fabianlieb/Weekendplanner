import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { THRESHOLDS } from '../engine/thresholds';
import { startKey, travelFor } from '../engine/travel';
import type { Candidate, StartPoint } from '../engine/types';
import { PlannerDB } from './db';
import { attachRoutedTravel, fetchCarMinutes, fetchConnections, fetchNearestStation, parseDuration, walkMinutes, type RoutingFetch } from './routing';

const home: StartPoint = { id: 'home', name: 'Zuhause', lat: 47.37812, lon: 8.54034, mode: 'car' };
const place = (id: string, lat: number, lon: number, extra: Partial<Candidate> = {}): Candidate => ({
  id,
  name: id,
  kind: 'ski_tour',
  valley: { lat, lon, elevation: 1200 },
  summit: { lat: lat + 0.02, lon, elevation: 2400 },
  durationHours: 5,
  travelMinutes: {},
  done: false,
  active: true,
  ...extra,
});

/** Fake services; records the URLs asked. */
function services(log: string[], opts: { osrmFails?: boolean } = {}): RoutingFetch {
  return async (url) => {
    log.push(url);
    let body: unknown = {};
    if (url.includes('/table/v1/driving/')) {
      if (opts.osrmFails) return { ok: false, status: 503, json: async () => ({}) };
      const n = url.split('?')[0]!.split(';').length - 1;
      body = { code: 'Ok', durations: [[0, ...Array.from({ length: n }, (_, i) => 3600 + i * 600)]] };
    } else if (url.includes('/locations')) {
      const x = Number(new URL(url).searchParams.get('x'));
      body =
        x > 47
          ? {
              stations: [
                { id: '8503006', name: 'Zürich Oerlikon', coordinate: { x: 47.4115, y: 8.5444 } },
                { id: '8503000', name: 'Zürich HB', coordinate: { x: 47.37818, y: 8.54021 } },
              ],
            }
          : x > 46.5
            ? { stations: [{ id: '8509253', name: 'Arosa', coordinate: { x: 46.7787, y: 9.6762 } }] }
            : { stations: [{ id: '999', name: 'Fern', coordinate: { x: 46.0, y: 7.0 } }] };
    } else if (url.includes('/connections')) {
      body = {
        connections: [
          { from: { departure: '2026-12-05T06:07:00+0100' }, to: { arrival: '2026-12-05T08:41:00+0100' }, duration: '00d02:34:00', transfers: 1, products: ['IC 3', 'RE 13'] },
        ],
      };
    }
    return { ok: true, json: async () => body };
  };
}

describe('travel time sources', () => {
  it('prefers manual (car only), then routed for the same start and mode, then the estimate', () => {
    const c = place('a', 46.78, 9.67, { travelMinutes: { home: 120 } });
    expect(travelFor(c, home)).toMatchObject({ minutes: 120, source: 'manual', mode: 'car' });
    const transit = { ...home, mode: 'transit' as const };
    expect(travelFor(c, transit)).toMatchObject({ source: 'estimate', mode: 'transit', estimated: true });
    const routed = { ...c, travelMinutes: {}, routedTravel: { startKey: startKey(home, 'car'), mode: 'car' as const, minutes: 140 } };
    expect(travelFor(routed, home)).toMatchObject({ minutes: 140, source: 'routed', estimated: false });
    // a routed value of another start point or mode is ignored
    expect(travelFor(routed, { ...home, lat: 46.2 })).toMatchObject({ source: 'estimate' });
    expect(travelFor(routed, transit)).toMatchObject({ source: 'estimate' });
    // the public transport estimate is slower than the car estimate
    expect(travelFor(place('b', 46.78, 9.67), transit).minutes).toBeGreaterThan(travelFor(place('b', 46.78, 9.67), home).minutes);
  });

  it('parses timetable durations and walking times', () => {
    expect(parseDuration('00d03:05:00')).toBe(185);
    expect(parseDuration('01d00:10:00')).toBe(1450);
    expect(parseDuration(undefined)).toBeUndefined();
    expect(walkMinutes(1)).toBe(Math.round((1.3 / THRESHOLDS.routing.walkKmh) * 60));
  });
});

describe('routing services', () => {
  it('sends the start point rounded to ~1 km to OSRM and converts seconds', async () => {
    const log: string[] = [];
    const m = await fetchCarMinutes(home, [{ lat: 46.7787, lon: 9.6762 }], services(log));
    expect(log[0]).toContain('/table/v1/driving/8.54,47.38;9.67620,46.77870?sources=0');
    expect(m[0]).toBe(Math.round(60 * THRESHOLDS.routing.carFactor + THRESHOLDS.routing.carExtraMinutes));
  });

  it('finds the stop nearest to the exact home without sending it', async () => {
    const log: string[] = [];
    const s = await fetchNearestStation(home, true, services(log));
    expect(log[0]).toContain('x=47.38&y=8.54');
    expect(s?.name).toBe('Zürich HB');
  });

  it('reads connections', async () => {
    const list = await fetchConnections({ id: '1', name: 'A' }, { id: '2', name: 'B' }, '2026-12-05', '06:00', { fetchFn: services([]) });
    expect(list).toEqual([{ departure: '2026-12-05T06:07:00+0100', arrival: '2026-12-05T08:41:00+0100', minutes: 154, transfers: 1, products: ['IC 3', 'RE 13'] }]);
  });
});

describe('attaching routed travel times', () => {
  let db: PlannerDB;
  beforeEach(async () => {
    db = new PlannerDB(`routing-${Math.random()}`);
    await db.open();
  });
  afterEach(async () => {
    db.close();
    await db.delete();
  });
  const now = new Date('2026-12-03T17:00:00Z');

  it('car: one request for all places, then from the cache; parking is the destination', async () => {
    const log: string[] = [];
    const list = [place('a', 46.78, 9.67), place('b', 46.5, 9.8, { parking: { lat: 46.51, lon: 9.81 } })];
    const first = await attachRoutedTravel(db, list, home, { now, fetchMissing: true, fetchFn: services(log) });
    expect(log).toHaveLength(1);
    expect(log[0]).toContain('9.81000,46.51000');
    expect(travelFor(first[0]!, home)).toMatchObject({ source: 'routed', minutes: 76 });
    const again = await attachRoutedTravel(db, list, home, { now, fetchMissing: true, fetchFn: services(log) });
    expect(log).toHaveLength(1);
    expect(again[1]!.routedTravel?.minutes).toBe(first[1]!.routedTravel?.minutes);
  });

  it('car: service down → estimates, nothing cached', async () => {
    const out = await attachRoutedTravel(db, [place('a', 46.78, 9.67)], home, { now, fetchMissing: true, fetchFn: services([], { osrmFails: true }) });
    expect(travelFor(out[0]!, home).source).toBe('estimate');
    expect(await db.travelCache.count()).toBe(0);
  });

  it('public transport: walk + fastest connection + walk; a far stop = not reachable', async () => {
    const log: string[] = [];
    const sp = { ...home, mode: 'transit' as const };
    const list = [place('arosa', 46.779, 9.677), place('remote', 46.3, 8.0)];
    const out = await attachRoutedTravel(db, list, sp, { now, fetchMissing: true, date: '2026-12-05', fetchFn: services(log) });
    const t = travelFor(out[0]!, sp);
    expect(t.source).toBe('routed');
    expect(t.transit).toMatchObject({ from: { name: 'Zürich HB' }, to: { name: 'Arosa' } });
    expect(t.minutes).toBe(154 + t.transit!.walkToMinutes + t.transit!.walkFromMinutes);
    expect(travelFor(out[1]!, sp).minutes).toBe(Infinity);
    // second run: everything from the cache
    const n = log.length;
    await attachRoutedTravel(db, list, sp, { now, fetchMissing: true, date: '2026-12-05', fetchFn: services(log) });
    expect(log.length).toBe(n);
  });

  it('public transport: without fetching, unknown places keep the estimate', async () => {
    const sp = { ...home, mode: 'transit' as const };
    const out = await attachRoutedTravel(db, [place('arosa', 46.779, 9.677)], sp, { now, fetchFn: services([]) });
    expect(travelFor(out[0]!, sp).source).toBe('estimate');
  });
});
