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

/** Link to map.geo.admin.ch with a marker at the point. */
export function swisstopoUrl(p: LatLon, zoom = 10): string {
  const { e, n } = wgs84ToLv95(p);
  return `https://map.geo.admin.ch/?lang=de&E=${e}&N=${n}&zoom=${zoom}&crosshair=marker`;
}
