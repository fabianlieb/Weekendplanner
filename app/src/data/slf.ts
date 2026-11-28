// SLF avalanche bulletin (CAAML JSON) and warning regions (GeoJSON), both open data with CORS.
// Bulletin cached until its next update, regions for 30 days; offline the last copies are used.
// Source reference: «Lawinenbulletin: SLF» with link (SLF Data Service).

import { LEVEL_FROM_CAAML, slfDangerFor, type Aspect, type SlfBulletin, type SlfBulletinPart, type SlfDanger, type SlfProblem, type SlfRegion, type Subdivision } from '../engine/slf';
import type { Candidate } from '../engine/types';
import type { PlannerDB } from './db';

export const SLF_BULLETIN_URL = 'https://aws.slf.ch/api/bulletin/caaml/de/json';
export const SLF_REGIONS_URL = 'https://aws.slf.ch/api/warningregion/warnregionDefinition/current/geojson';
export const BULLETIN_ATTRIBUTION = 'Lawinenbulletin: SLF';

export type SlfFetch = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
const defaultFetch: SlfFetch = (u) => fetch(u, { signal: AbortSignal.timeout(15_000) });

const REGIONS_KEY = 'slfRegions';
const BULLETIN_KEY = 'slfBulletin';
const REGIONS_DAYS = 30;
/** Without a «nextUpdate» the bulletin is asked again after this many hours. */
const BULLETIN_HOURS = 6;

const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return v !== undefined && v !== null && v !== '' && Number.isFinite(n) ? n : undefined;
};

/** CAAML JSON → slim parts. Several ratings in one part (time of day, elevation): the highest counts. */
export function parseBulletin(j: unknown, now: Date): SlfBulletin {
  const list = (j as { bulletins?: unknown[] })?.bulletins ?? [];
  const parts: SlfBulletinPart[] = [];
  let nextUpdate: string | undefined;
  for (const raw of list) {
    const b = raw as {
      regions?: { regionID?: string }[];
      dangerRatings?: { mainValue?: string; customData?: { CH?: { subdivision?: string } } }[];
      avalancheProblems?: { problemType?: string; aspects?: string[]; elevation?: { lowerBound?: string; upperBound?: string } }[];
      validTime?: { startTime?: string; endTime?: string };
      nextUpdate?: string;
    };
    const regions = (b.regions ?? []).map((r) => r.regionID).filter((r): r is string => !!r);
    let best: { level: NonNullable<ReturnType<typeof levelOf>>; sub?: Subdivision } | undefined;
    for (const d of b.dangerRatings ?? []) {
      const level = levelOf(d.mainValue);
      if (!level) continue;
      const sub = d.customData?.CH?.subdivision as Subdivision | undefined;
      const rank = level * 3 + (sub === 'minus' ? 0 : sub === 'plus' ? 2 : 1);
      const bestRank = best ? best.level * 3 + (best.sub === 'minus' ? 0 : best.sub === 'plus' ? 2 : 1) : -1;
      if (rank > bestRank) best = { level, ...(sub && sub !== 'neutral' ? { sub } : {}) };
    }
    if (!regions.length || !best || !b.validTime?.startTime || !b.validTime.endTime) continue;
    const problems: SlfProblem[] = (b.avalancheProblems ?? []).map((p) => {
      const lower = num(p.elevation?.lowerBound);
      const upper = num(p.elevation?.upperBound);
      return {
        type: p.problemType ?? 'unknown',
        aspects: (p.aspects ?? []) as Aspect[],
        ...(lower !== undefined ? { lower } : {}),
        ...(upper !== undefined ? { upper } : {}),
      };
    });
    parts.push({
      regions,
      level: best.level,
      ...(best.sub ? { subdivision: best.sub } : {}),
      validFrom: b.validTime.startTime,
      validTo: b.validTime.endTime,
      problems,
    });
    if (b.nextUpdate && (!nextUpdate || b.nextUpdate < nextUpdate)) nextUpdate = b.nextUpdate;
  }
  return { fetchedAt: now.toISOString(), ...(nextUpdate ? { nextUpdate } : {}), parts };
}

function levelOf(v: string | undefined) {
  return v ? LEVEL_FROM_CAAML[v] : undefined;
}

/** GeoJSON warning regions → id «CH-1111», German name, polygons (rounded to ~1 m). */
export function parseRegions(j: unknown): SlfRegion[] {
  const out: SlfRegion[] = [];
  const r5 = (v: number) => Math.round(v * 1e5) / 1e5;
  for (const f of (j as { features?: unknown[] })?.features ?? []) {
    const ft = f as {
      properties?: { sector_id?: string; sector_name?: string; sector_names?: { de?: string } };
      geometry?: { type?: string; coordinates?: unknown };
    };
    const id = ft.properties?.sector_id;
    const g = ft.geometry;
    if (!id || !g) continue;
    const polys = (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []) as [number, number][][][];
    out.push({
      id: `CH-${id}`,
      name: ft.properties?.sector_names?.de ?? ft.properties?.sector_name ?? id,
      polygons: polys.map((rings) => rings.map((ring) => ring.map(([x, y]) => [r5(x), r5(y)] as [number, number]))),
    });
  }
  return out;
}

export interface SlfData {
  regions: SlfRegion[];
  bulletin?: SlfBulletin;
}

/** Regions and bulletin, network when due, else the stored copies. Never throws. */
export async function loadSlf(db: PlannerDB, opts: { now?: Date; fetchFn?: SlfFetch } = {}): Promise<SlfData> {
  const now = opts.now ?? new Date();
  const f = opts.fetchFn ?? defaultFetch;

  let regions = (await db.settings.get(REGIONS_KEY))?.value as { fetchedAt: string; regions: SlfRegion[] } | undefined;
  if (!regions || (now.getTime() - new Date(regions.fetchedAt).getTime()) / 86_400_000 > REGIONS_DAYS) {
    try {
      const r = await f(SLF_REGIONS_URL);
      if (r.ok) {
        const parsed = parseRegions(await r.json());
        if (parsed.length > 50) {
          regions = { fetchedAt: now.toISOString(), regions: parsed };
          await db.settings.put({ key: REGIONS_KEY, value: regions });
        }
      }
    } catch {
      // keep the stored copy
    }
  }

  let bulletin = (await db.settings.get(BULLETIN_KEY))?.value as SlfBulletin | undefined;
  const due =
    !bulletin ||
    (bulletin.nextUpdate ? now.getTime() >= new Date(bulletin.nextUpdate).getTime() : false) ||
    now.getTime() - new Date(bulletin.fetchedAt).getTime() > BULLETIN_HOURS * 3_600_000;
  if (due) {
    try {
      const r = await f(SLF_BULLETIN_URL);
      if (r.ok) {
        const parsed = parseBulletin(await r.json(), now);
        if (parsed.parts.length) {
          bulletin = parsed;
          await db.settings.put({ key: BULLETIN_KEY, value: bulletin });
        }
      }
    } catch {
      // keep the stored copy (its validity is checked per plan date)
    }
  }
  return { regions: regions?.regions ?? [], ...(bulletin ? { bulletin } : {}) };
}

/** Danger per tour or snowshoe trail (pistes and photo spots have none). */
export function slfByCandidate(candidates: readonly Candidate[], data: SlfData): Record<string, SlfDanger> {
  const out: Record<string, SlfDanger> = {};
  if (!data.bulletin || !data.regions.length) return out;
  for (const c of candidates) {
    if (c.kind !== 'ski_tour' && c.kind !== 'snowshoe_trail') continue;
    const d = slfDangerFor(c, data.regions, data.bulletin);
    if (d) out[c.id] = d;
  }
  return out;
}
