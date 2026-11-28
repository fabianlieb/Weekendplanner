import type { Candidate } from '../engine/types';

// Coordinates: parse user input (WGS84 or Swiss LV95) and build swisstopo links.
// LV95 conversion uses swisstopo's published approximate formulas (accuracy ~1 m).

export interface LatLon {
  lat: number;
  lon: number;
}

export function lv95ToWgs84(e: number, n: number): LatLon {
  const y = (e - 2600000) / 1e6;
  const x = (n - 1200000) / 1e6;
  const lon = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y * y * y;
  const lat = 16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.014 * x * x * x;
  return { lat: (lat * 100) / 36, lon: (lon * 100) / 36 };
}

export function wgs84ToLv95(p: LatLon): { e: number; n: number } {
  const phi = (p.lat * 3600 - 169028.66) / 10000;
  const lam = (p.lon * 3600 - 26782.5) / 10000;
  const e = 2600072.37 + 211455.93 * lam - 10938.51 * lam * phi - 0.36 * lam * phi * phi - 44.54 * lam ** 3;
  const n = 1200147.07 + 308807.95 * phi + 3745.25 * lam * lam + 76.63 * phi * phi - 194.56 * lam * lam * phi + 119.79 * phi ** 3;
  return { e: Math.round(e), n: Math.round(n) };
}

/**
 * Accepts «47.3769, 8.5417», «47.3769 8.5417», LV95 «2'683'000, 1'248'000» or «2683000.5 1248000».
 * Returns undefined if nothing sensible could be read.
 */
export function parseCoordinates(text: string): LatLon | undefined {
  const cleaned = text.replace(/[’'`]/g, '').replace(/[;/]/g, ',').trim();
  const nums = cleaned.match(/-?\d+(?:[.,]\d+)?/g);
  if (!nums || nums.length !== 2) {
    // «47.3769, 8.5417» with comma as separator is matched above; «47,3769 8,5417» too.
    return undefined;
  }
  const [a, b] = nums.map((s) => Number(s.replace(',', '.'))) as [number, number];
  if (a > 2_400_000 && b > 1_000_000) return lv95ToWgs84(a, b);
  if (b > 2_400_000 && a > 1_000_000) return lv95ToWgs84(b, a);
  if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return { lat: a, lon: b };
  return undefined;
}

export function formatCoordinates(p: LatLon): string {
  return `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`;
}

/** Link to map.geo.admin.ch (viewer format verified 2026-11-27) with a marker at the point. z=7 ≈ 500 m scale bar. */
export function swisstopoUrl(p: LatLon, zoom = 7): string {
  const { e, n } = wgs84ToLv95(p);
  return `https://map.geo.admin.ch/#/map?lang=de&center=${e},${n}&z=${zoom}&crosshair=marker&bgLayer=ch.swisstopo.pixelkarte-farbe&topic=ech`;
}

/** Google Maps directions to a point (by car or public transport); opens the Google Maps app if installed. */
export function googleMapsUrl(p: LatLon, mode: 'car' | 'transit' = 'car'): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat.toFixed(5)},${p.lon.toFixed(5)}&travelmode=${mode === 'transit' ? 'transit' : 'driving'}`;
}

/** Where to drive to: parking if stored, else the start (tours, trails, resorts) or the photo position. */
export function navigationTarget(c: Candidate): { point: LatLon; label: string } {
  if (c.parking) return { point: c.parking, label: 'Parkplatz' };
  if (c.kind === 'photo_spot') return { point: c.summit, label: 'Fotostandort' };
  return { point: c.valley, label: c.kind === 'ski_resort' ? 'Talstation' : 'Startpunkt' };
}

/**
 * Coordinates from a swisstopo map link (map.geo.admin.ch): new viewer `#/map?…center=E,N…`,
 * legacy `?E=…&N=…` or `?swisssearch=lat,lon`. Undefined if the text is no such link.
 */
export function parseSwisstopoLink(text: string): LatLon | undefined {
  const t = text.trim();
  if (!/geo\.admin\.ch/.test(t)) return undefined;
  const center = t.match(/[?&#]center=([\d.]+)(?:,|%2C)([\d.]+)/i);
  if (center) return parseCoordinates(`${center[1]} ${center[2]}`);
  const e = t.match(/[?&#]E=([\d.]+)/);
  const n = t.match(/[?&#]N=([\d.]+)/);
  if (e && n) return parseCoordinates(`${e[1]} ${n[1]}`);
  const search = t.match(/swisssearch=([^&#]+)/i);
  if (search?.[1]) return parseCoordinates(decodeURIComponent(search[1]));
  return undefined;
}

/**
 * Coordinates from a Google Maps or Apple Maps link (e.g. an Instagram location opened in Maps):
 * `@lat,lon`, `!3dlat!4dlon`, `?q=lat,lon`, `ll=`, `destination=`, `daddr=`.
 * Short links (maps.app.goo.gl) cannot be resolved without a server → undefined.
 */
export function parseMapsLink(text: string): LatLon | undefined {
  const t = decodeURIComponent(text.trim());
  if (!/(google\.[a-z.]+\/maps|maps\.google\.|maps\.apple\.com|goo\.gl\/maps)/i.test(t)) return undefined;
  const patterns = [
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|ll|sll|destination|daddr|center)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lon = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
    }
  }
  return undefined;
}

/** Accepts coordinates, a swisstopo link or a Google/Apple Maps link. */
export function parseCoordinatesOrLink(text: string): LatLon | undefined {
  const link = parseSwisstopoLink(text) ?? parseMapsLink(text);
  if (link) return link;
  // Some other URL: do not guess numbers out of it.
  if (/^\s*https?:\/\//i.test(text)) return undefined;
  return parseCoordinates(text);
}
