// Place picture and route track for the UI. Everything is optional: no data → nothing is rendered.
import { useState } from 'react';
import { getCandidate } from '../data/catalog';
import { getDb } from '../data/db';
import { placeImage, type PlaceImage } from '../data/placeImages';
import { hasTrack, loadTrack, type Track } from '../data/tracks';
import type { Candidate, GeoPoint } from '../engine/types';
import { useAsync } from './components';

/** Candidate + picture (loaded lazily, cached). */
export function usePlaceMedia(candidateId: string): { candidate?: Candidate; image?: PlaceImage } {
  const db = getDb();
  const { data } = useAsync(async () => {
    const candidate = await getCandidate(db, candidateId);
    const image = candidate ? await placeImage(db, candidate) : undefined;
    return { ...(candidate ? { candidate } : {}), ...(image ? { image } : {}) };
  }, [candidateId]);
  return data ?? {};
}

export function useTrack(candidate: Candidate | undefined): Track | undefined {
  const db = getDb();
  const { data } = useAsync(async () => (candidate && hasTrack(candidate) ? loadTrack(db, candidate) : undefined), [candidate?.id]);
  return data;
}

/** Small square picture; disappears if it cannot be loaded (e.g. offline). */
export function Thumb({ image, size = 64 }: { image: PlaceImage | undefined; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!image || failed) return null;
  return <img className="thumb" src={image.url} alt={image.title} width={size} height={size} loading="lazy" onError={() => setFailed(true)} />;
}

export function ImageCredit({ image }: { image: PlaceImage }) {
  return (
    <span className="tiny muted">
      Bild: {image.artist ? `${image.artist} · ` : ''}
      {image.license ? `${image.license} · ` : ''}
      <a href={image.descriptionUrl ?? image.pageUrl} target="_blank" rel="noreferrer">
        Wikimedia Commons
      </a>{' '}
      ·{' '}
      <a href={image.pageUrl} target="_blank" rel="noreferrer">
        Wikipedia «{image.title}»
      </a>
    </span>
  );
}

/** Grey swisstopo national map (Web Mercator tiles) as a quiet background. */
const GREY_TILE = (z: number, x: number, y: number) => `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/${z}/${x}/${y}.jpeg`;
const TILE = 256;
const MAX_ZOOM = 16;

/** World pixel position at zoom z (Web Mercator). */
export function worldPx(lat: number, lon: number, z: number): [number, number] {
  const n = TILE * 2 ** z;
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return [((lon + 180) / 360) * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
}

/**
 * Frame for a set of points: tiles one zoom level finer than the largest level at which the points
 * fit into w × h (minus padding), shown scaled down (0.5–1) so labels stay small and sharp.
 */
export function trackFrame(pts: readonly (readonly [number, number])[], w: number, h: number, pad: number) {
  const fitW = w - 2 * pad;
  const fitH = h - 2 * pad;
  let z = MAX_ZOOM;
  const box = (zz: number) => {
    const px = pts.map(([lat, lon]) => worldPx(lat, lon, zz));
    const xs = px.map((p) => p[0]);
    const ys = px.map((p) => p[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  };
  let b = box(z);
  while (z > 5 && (b.x1 - b.x0 > fitW || b.y1 - b.y0 > fitH)) b = box(--z);
  if (z < MAX_ZOOM) b = box(++z);
  const k = Math.min(2, fitW / Math.max(b.x1 - b.x0, 1), fitH / Math.max(b.y1 - b.y0, 1));
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  // view → world: world = c + (view − centre) / k
  const left = cx - w / 2 / k;
  const top = cy - h / 2 / k;
  const proj = (lat: number, lon: number): [number, number] => {
    const [x, y] = worldPx(lat, lon, z);
    return [(x - left) * k, (y - top) * k];
  };
  const tiles: { x: number; y: number; vx: number; vy: number; size: number }[] = [];
  const maxTile = 2 ** z - 1;
  for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + w / k) / TILE); tx++)
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + h / k) / TILE); ty++)
      if (tx >= 0 && ty >= 0 && tx <= maxTile && ty <= maxTile) tiles.push({ x: tx, y: ty, vx: (tx * TILE - left) * k, vy: (ty * TILE - top) * k, size: TILE * k });
  return { z, k, proj, tiles };
}

/** Route on a grey map: start (dot), destination (triangle). Without internet only the line. */
export function TrackMap({ track, summit, height = 190 }: { track: Track; summit?: GeoPoint; height?: number }) {
  const pts = track.lines.flat();
  if (pts.length < 2) return null;
  const w = 320;
  const { z, proj, tiles } = trackFrame(pts, w, height, 16);
  const start = track.lines[0]?.[0];
  const top = summit ? proj(summit.lat, summit.lon) : undefined;
  return (
    <svg className="track-map" viewBox={`0 0 ${w} ${height}`} role="img" aria-label="Routenverlauf auf der Landeskarte">
      <g className="track-tiles">
        {tiles.map((t) => (
          <image key={`${t.x}-${t.y}`} href={GREY_TILE(z, t.x, t.y)} x={t.vx} y={t.vy} width={t.size + 0.5} height={t.size + 0.5} preserveAspectRatio="none" />
        ))}
      </g>
      {track.lines.map((l, i) => (
        <polyline key={`h${i}`} points={l.map(([lat, lon]) => proj(lat, lon).join(',')).join(' ')} fill="none" stroke="var(--bg)" strokeWidth="5.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
      ))}
      {track.lines.map((l, i) => (
        <polyline key={i} points={l.map(([lat, lon]) => proj(lat, lon).join(',')).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {start && <circle cx={proj(start[0], start[1])[0]} cy={proj(start[0], start[1])[1]} r="5" fill="var(--bg)" stroke="var(--ink)" strokeWidth="2.2" />}
      {top && top[0] >= 0 && top[0] <= w && top[1] >= 0 && top[1] <= height && (
        <path d={`M${top[0]} ${top[1] - 8} l7 11 h-14 z`} fill="var(--ink)" stroke="var(--bg)" strokeWidth="1.5" />
      )}
      <text x={w - 4} y={height - 4} textAnchor="end" className="track-credit">
        © swisstopo
      </text>
    </svg>
  );
}

/** Larger picture with credits (detail plan). Nothing if there is no picture. */
export function PlacePicture({ candidateId }: { candidateId: string }) {
  const { image } = usePlaceMedia(candidateId);
  const [failed, setFailed] = useState(false);
  if (!image || failed) return null;
  return (
    <figure className="place-picture">
      <img src={image.url} alt={image.title} loading="lazy" onError={() => setFailed(true)} />
      <figcaption>
        <ImageCredit image={image} />
      </figcaption>
    </figure>
  );
}
