// GPS track of a route: own GPX (uploaded in the editor) or the route line of the catalogue
// (swisstopo/SAC, ASTRA/SchweizMobil), loaded on demand from api3.geo.admin.ch and cached.
// Without a track nothing is shown.

import type { Candidate } from '../engine/types';
import { lv95ToWgs84 } from '../ui/geo';
import type { PlannerDB } from './db';

export type LatLonPoint = [lat: number, lon: number];

export interface Track {
  lines: LatLonPoint[][];
  source: 'gpx' | 'swisstopo/SAC' | 'ASTRA/SchweizMobil' | string;
}

export interface TrackCacheRow {
  id: string;
  fetchedAt: string;
  track?: Track;
}

const MAX_POINTS = 600;
const TTL_DAYS = 60;

export function hasTrack(c: Pick<Candidate, 'gpx' | 'track'> | undefined): boolean {
  return !!c && (!!c.gpx || !!c.track);
}

/** Points of trk/rte elements of a GPX file (no DOM needed). */
export function parseGpx(xml: string): LatLonPoint[][] {
  const lines: LatLonPoint[][] = [];
  const segRe = /<(trkseg|rte)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const ptRe = /<(?:trkpt|rtept)\b([^>]*)>/gi;
  const num = (attrs: string, n: string) => Number(attrs.match(new RegExp(`${n}\\s*=\\s*["']([-\\d.]+)["']`))?.[1]);
  for (const seg of xml.matchAll(segRe)) {
    const pts: LatLonPoint[] = [];
    for (const p of (seg[2] ?? '').matchAll(ptRe)) {
      const lat = num(p[1] ?? '', 'lat');
      const lon = num(p[1] ?? '', 'lon');
      if (Number.isFinite(lat) && Number.isFinite(lon)) pts.push([lat, lon]);
    }
    if (pts.length > 1) lines.push(pts);
  }
  return lines;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildGpx(name: string, track: Track): string {
  const segs = track.lines
    .map((l) => `    <trkseg>\n${l.map(([lat, lon]) => `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"/>`).join('\n')}\n    </trkseg>`)
    .join('\n');
  const credit = track.source === 'gpx' ? '' : `\n  <metadata><copyright author="${esc(track.source)}"/></metadata>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Wochenend-Planer" xmlns="http://www.topografix.com/GPX/1/1">${credit}\n  <trk>\n    <name>${esc(name)}</name>\n${segs}\n  </trk>\n</gpx>\n`;
}

/** Thin out long lines (keeps first and last point). */
export function thin(lines: LatLonPoint[][], max = MAX_POINTS): LatLonPoint[][] {
  const total = lines.reduce((a, l) => a + l.length, 0);
  if (total <= max) return lines;
  const step = Math.ceil(total / max);
  return lines.map((l) => l.filter((_, i) => i % step === 0 || i === l.length - 1));
}

type Fetch = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export async function fetchCatalogTrack(ref: NonNullable<Candidate['track']>, source: string, fetchFn: Fetch = (u) => fetch(u)): Promise<Track | undefined> {
  const url = `https://api3.geo.admin.ch/rest/services/api/MapServer/${ref.layer}/${encodeURIComponent(ref.featureId)}?geometryFormat=geojson&sr=2056`;
  const r = await fetchFn(url);
  if (!r.ok) return undefined;
  const j = (await r.json()) as { feature?: { geometry?: { type: string; coordinates: unknown } } };
  const g = j.feature?.geometry;
  if (!g) return undefined;
  const raw = (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []) as [number, number][][];
  const lines = raw
    .map((l) =>
      l.map(([e, n]) => {
        const p = lv95ToWgs84(e, n);
        return [Math.round(p.lat * 1e6) / 1e6, Math.round(p.lon * 1e6) / 1e6] as LatLonPoint;
      }),
    )
    .filter((l) => l.length > 1);
  return lines.length ? { lines: thin(lines), source } : undefined;
}

/** Track of a place: own GPX first, else the catalogue route line (cached). Undefined = none. */
export async function loadTrack(db: PlannerDB, c: Candidate, now: Date = new Date(), fetchFn?: Fetch): Promise<Track | undefined> {
  if (c.gpx) {
    const lines = parseGpx(c.gpx);
    return lines.length ? { lines: thin(lines), source: 'gpx' } : undefined;
  }
  if (!c.track) return undefined;
  const hit = await db.trackCache.get(c.id);
  if (hit && now.getTime() - Date.parse(hit.fetchedAt) < TTL_DAYS * 86400000) return hit.track;
  try {
    const track = await fetchCatalogTrack(c.track, c.source ?? 'swisstopo', fetchFn);
    await db.trackCache.put({ id: c.id, fetchedAt: now.toISOString(), ...(track ? { track } : {}) });
    return track;
  } catch {
    return hit?.track;
  }
}

// ---------- Open the route in a map app ----------
// Both apps load the GPX from a public URL. The GPX files of all catalogue routes are published
// with the app (scripts/build-gpx.mjs → catalog/gpx/). Own GPX files have no public URL.

/** File name of the published GPX. Same rule as gpxFileName in scripts/catalog-lib.mjs. */
export function gpxFileName(track: NonNullable<Candidate['track']>): string {
  return `${track.layer.split('.').pop() ?? 'route'}-${track.featureId.replace(/[^A-Za-z0-9-]/g, '')}.gpx`;
}

function appBase(): string {
  const base = (import.meta.env?.BASE_URL as string | undefined) ?? '/';
  return new URL(base, typeof location === 'undefined' ? 'https://localhost/' : location.origin).href;
}

/** Public URL of the route's GPX, only for catalogue route lines (not for an own GPX). */
export function publicGpxUrl(c: Pick<Candidate, 'gpx' | 'track'> | undefined, base: string = appBase()): string | undefined {
  if (!c?.track || c.gpx) return undefined;
  return new URL(`catalog/gpx/${gpxFileName(c.track)}`, base).href;
}

/**
 * Route link of the swisstopo app (opens the app on the iPhone, else its web page):
 * https://swisstopo.app/u/<GPX URL, Base64 without padding>. A URL without «?», «>» or «~»
 * gives Base64 without «+» and «/», so the link needs no further escaping.
 */
export function swisstopoAppUrl(gpxUrl: string): string {
  return `https://swisstopo.app/u/${btoa(gpxUrl).replace(/=+$/, '')}`;
}

/** Guru Maps imports a file from a URL: guru://open?url=… */
export function guruMapsUrl(gpxUrl: string): string {
  return `guru://open?url=${gpxUrl}`;
}
