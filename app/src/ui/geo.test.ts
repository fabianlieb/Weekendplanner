import { describe, expect, it } from 'vitest';
import { formatCoordinates, googleMapsUrl, lv95ToWgs84, navigationTarget, parseCoordinates, parseCoordinatesOrLink, parseSwisstopoLink, swisstopoUrl, wgs84ToLv95 } from './geo';
import { candidates } from '../engine/__fixtures__/scenario';

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
    expect(swisstopoUrl({ lat: 46.95108, lon: 7.43864 })).toMatch(/^https:\/\/map\.geo\.admin\.ch\/#\/map\?lang=de&center=26000\d\d,12000\d\d&z=7&crosshair=marker&/);
  });

  it('reads coordinates from swisstopo links (new viewer, legacy, swisssearch)', () => {
    const fresh = parseSwisstopoLink('https://map.geo.admin.ch/#/map?lang=de&center=2683000,1248000&z=8&bgLayer=ch.swisstopo.pixelkarte-farbe');
    expect(fresh?.lat).toBeCloseTo(47.374, 2);
    expect(fresh?.lon).toBeCloseTo(8.539, 2);
    expect(parseSwisstopoLink('https://map.geo.admin.ch/?lang=de&E=2683000&N=1248000&zoom=10')).toEqual(fresh);
    expect(parseSwisstopoLink('https://map.geo.admin.ch/?swisssearch=46.95,7.44')).toEqual({ lat: 46.95, lon: 7.44 });
    expect(parseSwisstopoLink('https://www.google.com/maps/@47.1,9.2,12z')).toBeUndefined();
    expect(parseCoordinatesOrLink('47.3769, 8.5417')).toEqual({ lat: 47.3769, lon: 8.5417 });
  });

  it('navigates to parking, else start or photo position', () => {
    const tour = candidates.find((c) => c.kind === 'ski_tour')!;
    expect(navigationTarget(tour)).toEqual({ point: tour.valley, label: 'Startpunkt' });
    expect(navigationTarget({ ...tour, parking: { lat: 46.7, lon: 9.9 } })).toEqual({ point: { lat: 46.7, lon: 9.9 }, label: 'Parkplatz' });
    const spot = candidates.find((c) => c.kind === 'photo_spot')!;
    expect(navigationTarget(spot).point).toEqual(spot.summit);
    expect(googleMapsUrl({ lat: 46.7, lon: 9.9 })).toBe('https://www.google.com/maps/dir/?api=1&destination=46.70000,9.90000&travelmode=driving');
  });
});

describe('maps links', () => {
  it('reads Google Maps and Apple Maps links', async () => {
    const { parseMapsLink, parseCoordinatesOrLink } = await import('./geo');
    expect(parseMapsLink('https://www.google.com/maps/place/S%C3%A4ntis/@47.2494,9.3433,14z/data=!3m1!4b1')).toEqual({ lat: 47.2494, lon: 9.3433 });
    expect(parseMapsLink('https://www.google.com/maps/place/X/data=!4m6!3m5!1s0x0:0x0!8m2!3d47.2494!4d9.3433')).toEqual({ lat: 47.2494, lon: 9.3433 });
    expect(parseMapsLink('https://maps.google.com/?q=46.95,7.44')).toEqual({ lat: 46.95, lon: 7.44 });
    expect(parseMapsLink('https://maps.apple.com/?ll=47.0567,8.485&q=Rigi')).toEqual({ lat: 47.0567, lon: 8.485 });
    expect(parseMapsLink('https://maps.app.goo.gl/AbC123')).toBeUndefined();
    expect(parseCoordinatesOrLink('https://maps.app.goo.gl/AbC123')).toBeUndefined();
    expect(parseCoordinatesOrLink('https://example.com/47/8')).toBeUndefined();
  });
});
