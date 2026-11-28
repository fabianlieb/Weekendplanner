// Official SLF avalanche bulletin: danger level per warning region (pure functions).
// The data layer loads the bulletin and the region polygons; here a place gets its region and level.

import type { Candidate, DangerLevel, IsoDate } from './types';

export type Subdivision = 'minus' | 'neutral' | 'plus';
export type Aspect = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/** One warning region as polygons of [lon, lat] rings (GeoJSON order). */
export interface SlfRegion {
  id: string;
  name: string;
  polygons: [number, number][][][];
}

export interface SlfProblem {
  type: string;
  aspects: Aspect[];
  /** Elevation band of the problem, m (open ends undefined). */
  lower?: number;
  upper?: number;
}

/** A bulletin part for some regions, slimmed down for storage. */
export interface SlfBulletinPart {
  regions: string[];
  level: DangerLevel;
  subdivision?: Subdivision;
  validFrom: string;
  validTo: string;
  problems: SlfProblem[];
}

export interface SlfBulletin {
  fetchedAt: string;
  nextUpdate?: string;
  parts: SlfBulletinPart[];
}

/** Danger level for one place (display and, later, own calculation). */
export interface SlfDanger {
  level: DangerLevel;
  subdivision?: Subdivision;
  region: string;
  regionName: string;
  validFrom: string;
  validTo: string;
  problems: SlfProblem[];
}

export const LEVEL_FROM_CAAML: Record<string, DangerLevel | undefined> = {
  low: 1,
  moderate: 2,
  considerable: 3,
  high: 4,
  very_high: 5,
};

export const LEVEL_NAME: Record<DangerLevel, string> = {
  1: 'gering',
  2: 'mässig',
  3: 'erheblich',
  4: 'gross',
  5: 'sehr gross',
};

/** «3−», «2+», «1» */
export function levelText(level: DangerLevel, subdivision?: Subdivision): string {
  return `${level}${subdivision === 'minus' ? '−' : subdivision === 'plus' ? '+' : ''}`;
}

function inRing(lon: number, lat: number, ring: readonly [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Warning region containing the point (outer ring in, holes out). */
export function regionAt(p: { lat: number; lon: number }, regions: readonly SlfRegion[]): SlfRegion | undefined {
  return regions.find((r) => r.polygons.some(([outer, ...holes]) => !!outer && inRing(p.lon, p.lat, outer) && !holes.some((h) => inRing(p.lon, p.lat, h))));
}

/**
 * Danger for a tour or trail: region of the summit (else of the start), and the bulletin part
 * covering that region. Undefined outside the regions or without a bulletin for it.
 */
export function slfDangerFor(c: Pick<Candidate, 'summit' | 'valley'>, regions: readonly SlfRegion[], bulletin: SlfBulletin | undefined): SlfDanger | undefined {
  if (!bulletin) return undefined;
  const region = regionAt(c.summit, regions) ?? regionAt(c.valley, regions);
  if (!region) return undefined;
  const part = bulletin.parts.find((p) => p.regions.includes(region.id));
  if (!part) return undefined;
  return {
    level: part.level,
    ...(part.subdivision ? { subdivision: part.subdivision } : {}),
    region: region.id,
    regionName: region.name,
    validFrom: part.validFrom,
    validTo: part.validTo,
    problems: part.problems,
  };
}

/** True if the bulletin is valid during the day of the plan (the activity happens before 17:00). */
export function validForDate(d: Pick<SlfDanger, 'validFrom' | 'validTo'>, date: IsoDate): boolean {
  const noon = new Date(`${date}T11:00:00Z`).getTime();
  return new Date(d.validFrom).getTime() <= noon && noon < new Date(d.validTo).getTime();
}
