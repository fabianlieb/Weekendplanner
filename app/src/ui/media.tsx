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

/** Route as a small line drawing: start (dot), destination (triangle). */
export function TrackMap({ track, summit, height = 170 }: { track: Track; summit?: GeoPoint; height?: number }) {
  const pts = track.lines.flat();
  if (pts.length < 2) return null;
  const lat0 = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = pts.map((p) => p[1] * k);
  const ys = pts.map((p) => -p[0]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = 320;
  const pad = 12;
  const scale = Math.min((w - 2 * pad) / Math.max(maxX - minX, 1e-6), (height - 2 * pad) / Math.max(maxY - minY, 1e-6));
  const proj = (lat: number, lon: number): [number, number] => [pad + (lon * k - minX) * scale, pad + (-lat - minY) * scale];
  const start = track.lines[0]?.[0];
  const top = summit ? proj(summit.lat, summit.lon) : undefined;
  return (
    <svg className="track-map" viewBox={`0 0 ${w} ${height}`} role="img" aria-label="Routenverlauf">
      {track.lines.map((l, i) => (
        <polyline key={i} points={l.map(([lat, lon]) => proj(lat, lon).join(',')).join(' ')} fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {start && <circle cx={proj(start[0], start[1])[0]} cy={proj(start[0], start[1])[1]} r="4.5" fill="var(--bg)" stroke="var(--ink)" strokeWidth="2" />}
      {top && top[0] >= 0 && top[0] <= w && top[1] >= 0 && top[1] <= height && (
        <path d={`M${top[0]} ${top[1] - 7} l6 10 h-12 z`} fill="var(--accent)" />
      )}
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
