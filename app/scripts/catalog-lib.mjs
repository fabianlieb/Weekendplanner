// Pure helpers for the route catalogue (used by build-catalog.mjs and tested with Vitest).
// Sources (open data, source reference mandatory):
//  - ch.swisstopo-karto.skitouren         Skirouten, © swisstopo / SAC
//  - ch.swisstopo-karto.schneeschuhrouten Schneeschuhrouten, © swisstopo / SAC
//  - ch.astra.schneeschuhwanderwege       signalisierte Schneeschuhwanderwege, ASTRA / SchweizMobil

export const LAYERS = {
  skiTours: 'ch.swisstopo-karto.skitouren',
  sacSnowshoe: 'ch.swisstopo-karto.schneeschuhrouten',
  astraSnowshoe: 'ch.astra.schneeschuhwanderwege',
};

/** swisstopo approximate formulas, LV95 → WGS84 (accuracy ~1 m). */
export function lv95ToWgs84(e, n) {
  const y = (e - 2600000) / 1e6;
  const x = (n - 1200000) / 1e6;
  const lon = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y * y * y;
  const lat = 16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.014 * x * x * x;
  return { lat: round((lat * 100) / 36, 5), lon: round((lon * 100) / 36, 5) };
}

export function round(v, digits) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/** All lines of a GeoJSON LineString / MultiLineString as arrays of [e, n]. */
export function lines(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  return [];
}

export function endpoints(geometry) {
  const ls = lines(geometry).filter((l) => l.length > 0);
  if (!ls.length) return undefined;
  const first = ls[0][0];
  const lastLine = ls[ls.length - 1];
  return { first, last: lastLine[lastLine.length - 1] };
}

/** Vertex farthest from a point (for loop trails: the turning point). */
export function farthestVertex(geometry, from) {
  let best = from;
  let bestD = -1;
  for (const l of lines(geometry))
    for (const p of l) {
      const d = (p[0] - from[0]) ** 2 + (p[1] - from[1]) ** 2;
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
  return best;
}

/** «04:30 h» → 4.5 */
export function parseHours(label) {
  const m = String(label ?? '').match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) + Number(m[2]) / 60 : undefined;
}

const NO_INFO = /keine routeninfo/i;

/** Total duration of a tour: ascent plus descent (ski fast, snowshoe slower), rounded to 0.5 h. */
export function totalHours(ascentHours, gain, kind) {
  const descent = kind === 'ski_tour' ? Math.max(0.5, gain / 1200) : Math.max(0.5, gain / 600);
  return Math.max(1, Math.round((ascentHours + descent) * 2) / 2);
}

const clean = (id) => String(id).replace(/[{}]/g, '');

/**
 * SAC route (ski tour or snowshoe) → catalogue entry, or undefined without route info.
 * `firstHeight` = measured height of the first geometry point (orientation start/summit).
 */
export function sacRouteToEntry(feature, kind, firstHeight) {
  const a = feature.properties ?? feature.attributes ?? {};
  if (!a.target_name) return undefined;
  const ep = endpoints(feature.geometry);
  if (!ep) return undefined;
  const summitAlt = Number(a.target_altitude) || undefined;
  const gain = Number(a.ascent_altitude) || undefined;
  if (!summitAlt || !gain) return undefined;
  const startAlt = summitAlt - gain;
  // Which end is the start? The one whose measured height is closer to (summit − gain).
  const firstIsStart = firstHeight === undefined ? true : Math.abs(firstHeight - startAlt) <= Math.abs(firstHeight - summitAlt);
  const startLv = firstIsStart ? ep.first : ep.last;
  // There-and-back geometries end where they start: then the summit is the farthest point.
  const closed = Math.hypot(ep.first[0] - ep.last[0], ep.first[1] - ep.last[1]) < 300;
  const summitLv = closed ? farthestVertex(feature.geometry, startLv) : firstIsStart ? ep.last : ep.first;
  const ascent = parseHours(a.ascent_time_label) ?? gain / (kind === 'ski_tour' ? 400 : 350);
  const routeName = a.name_de && !NO_INFO.test(a.name_de) ? a.name_de : undefined;
  return {
    id: `${kind === 'ski_tour' ? 'sac-ski' : 'sac-wt'}-${clean(feature.id ?? feature.featureId)}`,
    name: routeName ? `${a.target_name} – ${routeName}` : a.target_name,
    kind: kind === 'ski_tour' ? 'ski_tour' : 'snowshoe_trail',
    valley: { ...lv95ToWgs84(startLv[0], startLv[1]), elevation: Math.round(firstIsStart && firstHeight !== undefined ? firstHeight : startAlt) },
    summit: { ...lv95ToWgs84(summitLv[0], summitLv[1]), elevation: Math.round(summitAlt) },
    elevationGain: Math.round(gain),
    durationHours: totalHours(ascent, gain, kind === 'ski_tour' ? 'ski_tour' : 'snowshoe'),
    difficulty: a.difficulty_de ?? undefined,
    ...(kind === 'snowshoe' ? { signposted: false } : {}),
    link: a.url_sac_de || undefined,
    source: 'swisstopo/SAC',
    // Route line on demand: api3.geo.admin.ch/rest/services/api/MapServer/<layer>/<featureId>
    track: { layer: kind === 'ski_tour' ? LAYERS.skiTours : LAYERS.sacSnowshoe, featureId: String(feature.id ?? feature.featureId) },
  };
}

/** Signposted snowshoe trail (ASTRA / SchweizMobil) → catalogue entry. */
export function astraTrailToEntry(feature, startHeight) {
  const a = feature.properties ?? feature.attributes ?? {};
  if (!a.namer) return undefined;
  const ep = endpoints(feature.geometry);
  if (!ep) return undefined;
  const gain = Number(a.hoeheaufr) || 0;
  const far = farthestVertex(feature.geometry, ep.first);
  const startAlt = startHeight ?? 1000;
  const minutes = Number(a.zeitstzir) || (Number(a.laenger) || 4) * 25;
  return {
    id: `astra-wt-${clean(a.nrr ?? feature.id ?? feature.featureId)}`,
    name: a.namer,
    kind: 'snowshoe_trail',
    valley: { ...lv95ToWgs84(ep.first[0], ep.first[1]), elevation: Math.round(startAlt) },
    summit: { ...lv95ToWgs84(far[0], far[1]), elevation: Math.round(startAlt + Math.max(gain, 50)) },
    elevationGain: Math.round(gain),
    durationHours: Math.max(1, Math.round((minutes / 60) * 2) / 2),
    difficulty: a.technikr_de ?? undefined,
    signposted: true,
    ...(a.beschreibr ? { note: a.beschreibr } : {}),
    link: a.chmurl_de || undefined,
    source: 'ASTRA/SchweizMobil',
    track: { layer: LAYERS.astraSnowshoe, featureId: String(feature.id ?? feature.featureId) },
  };
}

// ---------- Published GPX files (opened by the swisstopo app / Guru Maps from a public URL) ----------

/** File name of the published GPX of a route line, served at catalog/gpx/<name>. Same rule in src/data/tracks.ts. */
export function gpxFileName(track) {
  return `${track.layer.split('.').pop()}-${String(track.featureId).replace(/[^A-Za-z0-9-]/g, '')}.gpx`;
}

/** Route line as WGS84 [lat, lon] lines (~1 m), running away from the start point. */
export function routeLinesFrom(geometry, start) {
  const ls = lines(geometry)
    .filter((l) => l.length > 1)
    .map((l) =>
      l.map(([e, n]) => {
        const p = lv95ToWgs84(e, n);
        return [p.lat, p.lon];
      }),
    );
  if (!ls.length || !start) return ls;
  const d = (p) => (p[0] - start.lat) ** 2 + ((p[1] - start.lon) * 0.68) ** 2;
  const first = ls[0][0];
  const lastLine = ls[ls.length - 1];
  return d(lastLine[lastLine.length - 1]) < d(first) ? ls.reverse().map((l) => [...l].reverse()) : ls;
}

/** Encoded polyline (precision 1e-5), compact storage of a line. */
export function encodePolyline(points) {
  const enc = (v) => {
    let s = v < 0 ? ~(v << 1) : v << 1;
    let r = '';
    while (s >= 0x20) {
      r += String.fromCharCode((0x20 | (s & 0x1f)) + 63);
      s >>= 5;
    }
    return r + String.fromCharCode(s + 63);
  };
  let out = '';
  let pLat = 0;
  let pLon = 0;
  for (const [lat, lon] of points) {
    const a = Math.round(lat * 1e5);
    const b = Math.round(lon * 1e5);
    out += enc(a - pLat) + enc(b - pLon);
    pLat = a;
    pLon = b;
  }
  return out;
}

export function decodePolyline(str) {
  const out = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  const next = () => {
    let shift = 0;
    let result = 0;
    let b;
    do {
      b = str.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < str.length) {
    lat += next();
    lon += next();
    out.push([lat / 1e5, lon / 1e5]);
  }
  return out;
}

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** GPX 1.1 document of a catalogue route line. */
export function gpxDocument(name, source, routeLines) {
  const segs = routeLines
    .map((l) => `    <trkseg>\n${l.map(([lat, lon]) => `      <trkpt lat="${lat.toFixed(5)}" lon="${lon.toFixed(5)}"/>`).join('\n')}\n    </trkseg>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Wochenend-Planer" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${xmlEsc(name)}</name><copyright author="${xmlEsc(source)}"/></metadata>
  <trk>
    <name>${xmlEsc(name)}</name>
${segs}
  </trk>
</gpx>
`;
}
