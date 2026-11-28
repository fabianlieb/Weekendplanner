import { describe, expect, it } from 'vitest';
import { fetchPlaceImage, nameKeys, normalize, pickPage } from './placeImages';
import { buildGpx, fetchCatalogTrack, hasTrack, parseGpx, thin } from './tracks';

describe('place pictures', () => {
  it('derives name keys without generic words', () => {
    expect(normalize('Säntis (Berg)')).toBe('santis');
    expect(nameKeys('Pizol – Ab Skigebiet Pizol')).toEqual(['pizol']);
    expect(nameKeys('Trail Flumserberg')).toEqual(['trail flumserberg', 'flumserberg']);
    expect(nameKeys('Davos Klosters – Parsenn')).toEqual(['davos klosters']);
  });

  it('only accepts a page whose title matches the place, with a photo', () => {
    const pages = [
      { title: 'Flums', pageimage: 'Flums_Osten.jpg', thumbnail: { source: 'a' }, index: 1 },
      { title: 'Flumserberg', pageimage: 'Churfirsten_vom_Maschgenkamm.jpg', thumbnail: { source: 'b' }, index: 3 },
      { title: 'Walenstadt', pageimage: 'Walenstadt.jpg', thumbnail: { source: 'c' }, index: 2 },
    ];
    expect(pickPage(pages, 'Trail Flumserberg')?.title).toBe('Flumserberg');
    expect(pickPage(pages, 'Fronalpstock')).toBeUndefined();
    // maps and drawings are not used
    expect(pickPage([{ title: 'Appenzeller Alpen', pageimage: 'Appenzeller_Alpen.png', thumbnail: { source: 'x' } }], 'Appenzeller Alpen')).toBeUndefined();
    // «Altmann (Berg)» matches «Altmann»
    expect(pickPage([{ title: 'Altmann (Berg)', pageimage: 'A.JPG', thumbnail: { source: 'x' } }], 'Altmann')?.title).toBe('Altmann (Berg)');
  });

  it('fetches picture with author and licence; nothing if no match', async () => {
    const calls: string[] = [];
    const fake = async (url: string) => {
      calls.push(url);
      const body = url.includes('generator=geosearch')
        ? { query: { pages: { 1: { title: 'Säntis', pageimage: 'Saentis.jpg', thumbnail: { source: 'https://upload.example/s.jpg' }, index: 0 } } } }
        : { query: { pages: { 2: { imageinfo: [{ descriptionurl: 'https://commons.example/File:S.jpg', extmetadata: { Artist: { value: '<a href="x">Jane Doe</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } } }] } } } };
      return { ok: true, json: async () => body };
    };
    const img = await fetchPlaceImage({ name: 'Säntis', summit: { lat: 47.2494, lon: 9.3433, elevation: 2502 } }, fake);
    expect(img).toMatchObject({ url: 'https://upload.example/s.jpg', title: 'Säntis', artist: 'Jane Doe', license: 'CC BY-SA 4.0' });
    expect(calls[0]).toContain('ggscoord=47.2494%7C9.3433');
    expect(await fetchPlaceImage({ name: 'Unbekannt', summit: { lat: 47, lon: 9, elevation: 0 } }, fake)).toBeUndefined();
  });
});

describe('GPS tracks', () => {
  const gpx = `<?xml version="1.0"?><gpx><trk><name>T</name><trkseg>
    <trkpt lat="46.9" lon="9.4"><ele>1500</ele></trkpt>
    <trkpt lat='46.91' lon='9.41'/>
    <trkpt lat="46.92" lon="9.42"></trkpt>
  </trkseg></trk></gpx>`;

  it('reads and writes GPX', () => {
    const lines = parseGpx(gpx);
    expect(lines).toEqual([[[46.9, 9.4], [46.91, 9.41], [46.92, 9.42]]]);
    const out = buildGpx('Pizol & Co', { lines, source: 'swisstopo/SAC' });
    expect(out).toContain('<name>Pizol &amp; Co</name>');
    expect(out).toContain('copyright author="swisstopo/SAC"');
    expect(parseGpx(out)).toEqual(lines.map((l) => l.map(([a, b]) => [Number(a.toFixed(6)), Number(b.toFixed(6))])));
    expect(parseGpx('<gpx/>')).toEqual([]);
  });

  it('thins long tracks but keeps the ends', () => {
    const long = [Array.from({ length: 2000 }, (_, i) => [46 + i / 1e4, 9] as [number, number])];
    const t = thin(long, 500);
    expect(t[0]!.length).toBeLessThanOrEqual(501);
    expect(t[0]![0]).toEqual(long[0]![0]);
    expect(t[0]!.at(-1)).toEqual(long[0]!.at(-1));
  });

  it('loads a catalogue route line from geo.admin (LV95 → WGS84)', async () => {
    let asked = '';
    const fake = async (url: string) => {
      asked = url;
      return { ok: true, json: async () => ({ feature: { geometry: { type: 'MultiLineString', coordinates: [[[2600000, 1200000], [2601000, 1201000]]] } } }) };
    };
    const t = await fetchCatalogTrack({ layer: 'ch.swisstopo-karto.skitouren', featureId: '{abc}' }, 'swisstopo/SAC', fake);
    expect(asked).toContain('/MapServer/ch.swisstopo-karto.skitouren/%7Babc%7D?geometryFormat=geojson&sr=2056');
    expect(t?.lines[0]?.[0]?.[0]).toBeCloseTo(46.951, 3);
    expect(t?.source).toBe('swisstopo/SAC');
    expect(hasTrack({ gpx: undefined, track: undefined })).toBe(false);
  });
});
