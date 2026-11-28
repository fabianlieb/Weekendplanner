import { describe, expect, it } from 'vitest';
import { parseBulletin, parseRegions } from '../data/slf';
import { buildRiskInfo } from './risk';
import { levelText, regionAt, slfDangerFor, validForDate, type SlfRegion } from './slf';
import type { Candidate } from './types';

const square = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0],
];
const regions: SlfRegion[] = [
  { id: 'CH-1', name: 'West', polygons: [[square(7, 46, 8, 47)]] },
  { id: 'CH-2', name: 'Ost', polygons: [[square(8, 46, 9, 47), square(8.4, 46.4, 8.6, 46.6)]] },
];

const caaml = {
  bulletins: [
    {
      regions: [{ regionID: 'CH-1' }],
      dangerRatings: [{ mainValue: 'moderate', customData: { CH: { subdivision: 'plus' } } }],
      validTime: { startTime: '2026-12-04T16:00:00Z', endTime: '2026-12-05T16:00:00Z' },
      nextUpdate: '2026-12-05T07:00:00Z',
      avalancheProblems: [{ problemType: 'wind_slab', aspects: ['N', 'NE'], elevation: { lowerBound: '2200' } }],
    },
    {
      regions: [{ regionID: 'CH-2' }],
      dangerRatings: [
        { mainValue: 'moderate', validTimePeriod: 'earlier' },
        { mainValue: 'considerable', customData: { CH: { subdivision: 'minus' } }, validTimePeriod: 'later' },
      ],
      validTime: { startTime: '2026-12-04T16:00:00Z', endTime: '2026-12-05T16:00:00Z' },
    },
    { regions: [{ regionID: 'CH-3' }], dangerRatings: [{ mainValue: 'no_rating' }], validTime: { startTime: 'a', endTime: 'b' } },
  ],
};

const tour = (lon: number, lat: number): Pick<Candidate, 'summit' | 'valley'> => ({
  summit: { lat, lon, elevation: 2500 },
  valley: { lat: lat - 0.01, lon, elevation: 1500 },
});

describe('SLF avalanche bulletin', () => {
  const bulletin = parseBulletin(caaml, new Date('2026-12-04T17:00:00Z'));

  it('reads levels (highest of the day), subdivisions, problems and next update', () => {
    expect(bulletin.parts).toHaveLength(2);
    expect(bulletin.parts[0]).toMatchObject({ regions: ['CH-1'], level: 2, subdivision: 'plus', problems: [{ type: 'wind_slab', aspects: ['N', 'NE'], lower: 2200 }] });
    expect(bulletin.parts[1]).toMatchObject({ regions: ['CH-2'], level: 3, subdivision: 'minus' });
    expect(bulletin.nextUpdate).toBe('2026-12-05T07:00:00Z');
    expect(levelText(3, 'minus')).toBe('3−');
  });

  it('finds the warning region of a place (holes excluded)', () => {
    expect(regionAt({ lat: 46.5, lon: 7.5 }, regions)?.id).toBe('CH-1');
    expect(regionAt({ lat: 46.2, lon: 8.2 }, regions)?.id).toBe('CH-2');
    expect(regionAt({ lat: 46.5, lon: 8.5 }, regions)).toBeUndefined();
    expect(regionAt({ lat: 45, lon: 7.5 }, regions)).toBeUndefined();
  });

  it('danger per place, and whether it covers the day of the plan', () => {
    const d = slfDangerFor(tour(7.5, 46.5), regions, bulletin)!;
    expect(d).toMatchObject({ level: 2, subdivision: 'plus', region: 'CH-1', regionName: 'West' });
    expect(validForDate(d, '2026-12-05')).toBe(true);
    expect(validForDate(d, '2026-12-06')).toBe(false);
    expect(slfDangerFor(tour(10, 46.5), regions, bulletin)).toBeUndefined();
    expect(slfDangerFor(tour(7.5, 46.5), regions, undefined)).toBeUndefined();
  });

  it('reads warning region GeoJSON', () => {
    const r = parseRegions({
      features: [
        { properties: { sector_id: '1111', sector_names: { de: 'Waadtländer Voralpen' } }, geometry: { type: 'Polygon', coordinates: [square(6.9, 46.4, 7, 46.5)] } },
        { properties: { sector_id: '2222', sector_name: 'Multi' }, geometry: { type: 'MultiPolygon', coordinates: [[square(7, 46, 7.1, 46.1)], [square(7.2, 46, 7.3, 46.1)]] } },
      ],
    });
    expect(r.map((x) => [x.id, x.name, x.polygons.length])).toEqual([
      ['CH-1111', 'Waadtländer Voralpen', 1],
      ['CH-2222', 'Multi', 2],
    ]);
  });

  it('the risk block shows the official level, marked when not yet for the plan day', () => {
    const c = { id: 't', name: 'T', kind: 'ski_tour', ...tour(7.5, 46.5), durationHours: 5, travelMinutes: {}, done: false, active: true } as Candidate;
    const d = slfDangerFor(c, regions, bulletin)!;
    const now = buildRiskInfo(c, { kind: 'unknown', reason: 'missing' }, '2026-12-05', d);
    expect(now.dangerLabel).toBe('Gefahrenstufe 2+ (mässig) laut SLF-Bulletin, Region West');
    expect(now.slf?.validForPlan).toBe(true);
    // the colour still comes from the entry: unknown stays unknown
    expect(now.color).toBeUndefined();
    const later = buildRiskInfo(c, { kind: 'unknown', reason: 'missing' }, '2026-12-06', d);
    expect(later.dangerLabel).toContain('am Vorabend neu prüfen');
  });
});
