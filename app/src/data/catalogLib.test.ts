import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS module shared with the catalogue build script
import { astraTrailToEntry, lv95ToWgs84, parseHours, sacRouteToEntry, totalHours } from '../../scripts/catalog-lib.mjs';

const skiFeature = {
  id: '{008e0435-2eab-4612-bcea-db20103b6f10}',
  properties: {
    target_name: 'Furggelenstock',
    target_altitude: 1655,
    name_de: 'Von Oberiberg',
    difficulty_de: 'L',
    ascent_time_label: '02:00 h',
    ascent_altitude: '660',
    url_sac_de: 'https://www.sac-cas.ch/de/huetten-und-touren/sac-tourenportal/8005/skitouren/3744',
  },
  geometry: { type: 'LineString', coordinates: [[2700000, 1210000], [2701000, 1211000], [2702000, 1212000]] },
};

describe('catalogue conversion', () => {
  it('converts LV95 like the app', () => {
    const p = lv95ToWgs84(2600000, 1200000);
    expect(p.lat).toBeCloseTo(46.95108, 3);
    expect(p.lon).toBeCloseTo(7.43864, 3);
  });

  it('reads ascent times and estimates the total duration', () => {
    expect(parseHours('04:30 h')).toBe(4.5);
    expect(parseHours(null)).toBeUndefined();
    expect(totalHours(2, 660, 'ski_tour')).toBe(2.5);
    expect(totalHours(2, 660, 'snowshoe')).toBe(3);
  });

  it('SAC ski route: start is the end whose height fits summit − gain', () => {
    const asIs = sacRouteToEntry(skiFeature, 'ski_tour', 1000); // first point ≈ 1655 − 660 = 995 → first is start
    expect(asIs).toMatchObject({
      id: 'sac-ski-008e0435-2eab-4612-bcea-db20103b6f10',
      name: 'Furggelenstock – Von Oberiberg',
      kind: 'ski_tour',
      elevationGain: 660,
      difficulty: 'L',
      source: 'swisstopo/SAC',
      track: { layer: 'ch.swisstopo-karto.skitouren', featureId: '{008e0435-2eab-4612-bcea-db20103b6f10}' },
    });
    expect(asIs.valley.elevation).toBe(1000);
    expect(asIs.summit.elevation).toBe(1655);
    const reversed = sacRouteToEntry(skiFeature, 'ski_tour', 1640); // first point is near the summit
    expect(reversed.valley).toEqual({ ...lv95ToWgs84(2702000, 1212000), elevation: 995 });
  });

  it('skips segments without route information', () => {
    expect(sacRouteToEntry({ ...skiFeature, properties: { name_de: 'Keine Routeninfo verfügbar' } }, 'ski_tour', 1000)).toBeUndefined();
  });

  it('SAC snowshoe routes are not signposted; ASTRA trails are', () => {
    expect(sacRouteToEntry(skiFeature, 'snowshoe', 1000)).toMatchObject({ kind: 'snowshoe_trail', signposted: false, id: expect.stringMatching(/^sac-wt-/) });
    const astra = astraTrailToEntry(
      {
        id: 42,
        properties: { namer: 'Alpenrösli Trail', nrr: '619', laenger: 4.1, hoeheaufr: '310', zeitstzir: '135', technikr_de: 'rot', chmurl_de: 'https://schweizmobil.ch/de/schneeschuhwandern/route-619' },
        geometry: { type: 'MultiLineString', coordinates: [[[2786117, 1194284], [2787000, 1195000], [2786120, 1194290]]] },
      },
      1200,
    );
    expect(astra).toMatchObject({ id: 'astra-wt-619', kind: 'snowshoe_trail', signposted: true, elevationGain: 310, durationHours: 2.5, difficulty: 'rot' });
    expect(astra.summit.elevation).toBe(1510);
  });
});

describe('there-and-back routes', () => {
  it('use the farthest point as summit when the line ends at its start', async () => {
    // @ts-expect-error plain JS module
    const { sacRouteToEntry: conv } = await import('../../scripts/catalog-lib.mjs');
    const loop = { ...skiFeature, geometry: { type: 'LineString', coordinates: [[2700000, 1210000], [2703000, 1213000], [2700050, 1210050]] } };
    const e = conv(loop, 'ski_tour', 1000);
    expect(e.summit.lat).not.toBeCloseTo(e.valley.lat, 3);
  });
});
