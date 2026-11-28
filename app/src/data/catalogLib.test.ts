import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS module shared with the catalogue build script
import { astraTrailToEntry, decodePolyline, encodePolyline, gpxDocument, lv95ToWgs84, parseHours, routeLinesFrom, sacRouteToEntry, totalHours } from '../../scripts/catalog-lib.mjs';
import { parseGpx } from './tracks';

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

describe('published GPX files', () => {
  it('stores lines compactly without losing more than ~1 m', () => {
    const pts = [
      [46.12345, 9.54321],
      [46.12399, 9.54001],
      [45.99999, 10.00001],
    ];
    expect(encodePolyline([[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]])).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(decodePolyline(encodePolyline(pts))).toEqual(pts);
  });

  it('lets the route run away from the start point', () => {
    const geometry = { type: 'LineString', coordinates: [[2601000, 1201000], [2600500, 1200500], [2600000, 1200000]] };
    const start = lv95ToWgs84(2600000, 1200000);
    const ls = routeLinesFrom(geometry, start);
    expect(ls[0][0]).toEqual([start.lat, start.lon]);
    const multi = { type: 'MultiLineString', coordinates: [[[2600000, 1200000], [2600500, 1200500]], [[2600500, 1200500], [2601000, 1201000]]] };
    expect(routeLinesFrom(multi, start)[0][0]).toEqual([start.lat, start.lon]);
  });

  it('writes a GPX the app can read back, with credit and escaped name', () => {
    const xml = gpxDocument('Piz & Co', '© swisstopo / SAC', [[[46.1, 9.1], [46.2, 9.2]]]);
    expect(xml).toContain('<name>Piz &amp; Co</name>');
    expect(xml).toContain('copyright author="© swisstopo / SAC"');
    expect(parseGpx(xml)).toEqual([[[46.1, 9.1], [46.2, 9.2]]]);
  });
});
