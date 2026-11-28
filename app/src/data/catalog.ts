// Route catalogue (swisstopo/SAC, ASTRA/SchweizMobil) and built-in ski areas, plus the user's
// markings per catalogue entry (favourite, done, hidden) stored in IndexedDB.

import type { Candidate } from '../engine/types';
import type { CatalogStateRow, PlannerDB } from './db';
import { CATALOG_RESORTS } from './resorts';

export const CATALOG_ATTRIBUTION = 'Routen: © swisstopo / SAC · Schneeschuhwanderwege: ASTRA / SchweizMobil';

interface RouteEntry {
  id: string;
  name: string;
  kind: Candidate['kind'];
  valley: Candidate['valley'];
  summit: Candidate['summit'];
  elevationGain?: number;
  durationHours: number;
  difficulty?: string;
  signposted?: boolean;
  note?: string;
  link?: string;
  source: string;
  track?: { layer: string; featureId: string };
}

let cached: Promise<Candidate[]> | undefined;

/** Loads routes.json (precached by the service worker). On failure only the built-in ski areas. */
export function loadCatalogEntries(fetchFn: typeof fetch = (u) => fetch(u)): Promise<Candidate[]> {
  cached ??= (async () => {
    try {
      const base = (import.meta.env?.BASE_URL as string | undefined) ?? '/';
      const r = await fetchFn(`${base}catalog/routes.json`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as { entries?: RouteEntry[] };
      const routes = (j.entries ?? []).map<Candidate>((e) => ({
        ...e,
        travelMinutes: {},
        done: false,
        active: true,
      }));
      return [...routes, ...CATALOG_RESORTS];
    } catch {
      cached = undefined; // try again next time
      return [...CATALOG_RESORTS];
    }
  })();
  return cached;
}

export function applyState(entries: readonly Candidate[], states: readonly CatalogStateRow[]): Candidate[] {
  const byId = new Map(states.map((s) => [s.id, s]));
  return entries.map((c) => {
    const s = byId.get(c.id);
    if (!s) return c;
    return { ...c, done: s.done ?? c.done, favorite: s.favorite ?? c.favorite, active: !s.hidden };
  });
}

/** Catalogue with the user's markings. `entries` can be injected (tests). */
export async function getCatalog(db: PlannerDB, entries?: readonly Candidate[]): Promise<Candidate[]> {
  const [list, states] = await Promise.all([entries ? Promise.resolve([...entries]) : loadCatalogEntries(), db.catalogState.toArray()]);
  return applyState(list, states);
}

export async function setCatalogState(db: PlannerDB, id: string, patch: Partial<Omit<CatalogStateRow, 'id'>>): Promise<void> {
  const current = (await db.catalogState.get(id)) ?? { id };
  await db.catalogState.put({ ...current, ...patch });
}

/** An own entry or a catalogue entry by id. */
export async function getCandidate(db: PlannerDB, id: string, entries?: readonly Candidate[]): Promise<Candidate | undefined> {
  const own = await db.candidates.get(id);
  if (own) return own;
  return (await getCatalog(db, entries)).find((c) => c.id === id);
}

/** Own list entry copied from a catalogue entry (to add travel times, parking, packing …). */
export function copyToOwn(c: Candidate, newId: string): Candidate {
  const { source: _source, ...rest } = c;
  return { ...rest, id: newId, active: true, note: [c.note, c.source ? `Übernommen aus: ${c.source}` : undefined].filter(Boolean).join(' · ') };
}
