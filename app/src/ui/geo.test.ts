import { describe, expect, it } from 'vitest';
import { formatCoordinates, lv95ToWgs84, parseCoordinates, swisstopoUrl, wgs84ToLv95 } from './geo';

describe('coordinates', () => {
  it('converts the LV95 origin (Bern, old observatory)', () => {
    const p = lv95ToWgs84(2600000, 1200000);
    expect(p.lat).toBeCloseTo(46.95108, 3);
    expect(p.lon).toBeCloseTo(7.43864, 3);
  });

  it('round-trips WGS84 → LV95 → WGS84 within a few metres', () => {
    const zurich = { lat: 47.3769, lon: 8.5417 };
    const { e, n } = wgs84ToLv95(zurich);
    const back = lv95ToWgs84(e, n);
    expect(back.lat).toBeCloseTo(zurich.lat, 4);
    expect(back.lon).toBeCloseTo(zurich.lon, 4);
  });

  it.each([
    ['47.3769, 8.5417', 47.3769, 8.5417],
    ['47.3769 8.5417', 47.3769, 8.5417],
    ['47,3769; 8,5417', 47.3769, 8.5417],
  ])('parses WGS84 «%s»', (text, lat, lon) => {
    expect(parseCoordinates(text)).toEqual({ lat, lon });
  });

  it('parses LV95 with apostrophes in either order', () => {
    const a = parseCoordinates("2'683'000, 1'248'000");
    const b = parseCoordinates('1248000 2683000');
    expect(a?.lat).toBeCloseTo(47.374, 2);
    expect(a?.lon).toBeCloseTo(8.539, 2);
    expect(b).toEqual(a);
  });

  it('rejects nonsense', () => {
    expect(parseCoordinates('Zuhause')).toBeUndefined();
    expect(parseCoordinates('47.1')).toBeUndefined();
    expect(parseCoordinates('500, 900')).toBeUndefined();
  });

  it('formats and links', () => {
    expect(formatCoordinates({ lat: 47.37691, lon: 8.54167 })).toBe('47.3769, 8.5417');
    expect(swisstopoUrl({ lat: 46.95108, lon: 7.43864 })).toMatch(/^https:\/\/map\.geo\.admin\.ch\/\?lang=de&E=26000\d\d&N=12000\d\d&zoom=10&crosshair=marker$/);
  });
});
