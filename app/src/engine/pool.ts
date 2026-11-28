// Candidate pool: own list + catalogue (routes, ski areas), pre-filtered before weather is loaded.
// The catalogue has thousands of routes; only the most reachable ones that fit the profile get
// weather (Open-Meteo stays fast and within its limits). Own entries always count and win over
// catalogue duplicates.

import { capacity, exceedsCapacity } from './fit';
import { tooDifficult } from './profile';
import { travelFor } from './travel';
import type { Activity, Candidate, CandidateKind, DayForm, Feedback, Profile, StartPoint } from './types';
import { haversineKm } from './util';

/** Catalogue entries per kind that get weather and are evaluated. */
export const POOL_CAP: Record<CandidateKind, number> = { ski_tour: 40, snowshoe_trail: 30, ski_resort: 15, photo_spot: 20 };
/** A catalogue entry with the same kind and a summit closer than this to an own entry is a duplicate. */
export const DUPLICATE_KM = 1;
/** Travel slack (minutes) for the estimate-based pre-filter (the engine checks exactly later). */
const TRAVEL_SLACK = 20;

const KIND_ACTIVITY: Record<CandidateKind, Activity> = { ski_resort: 'ski', ski_tour: 'ski_tour', snowshoe_trail: 'snowshoe', photo_spot: 'photo' };

export function isDuplicate(a: Candidate, b: Candidate): boolean {
  return a.kind === b.kind && haversineKm(a.summit, b.summit) < DUPLICATE_KM;
}

export interface PoolInput {
  own: readonly Candidate[];
  catalog: readonly Candidate[];
  profile: Profile;
  startPoint?: StartPoint;
  maxTravelHours: number;
  dayForm: DayForm;
  feedback?: readonly Feedback[];
  /** Always include these ids (e.g. the chosen plan), if present. */
  include?: ReadonlySet<string>;
}

export function selectPool(input: PoolInput): Candidate[] {
  const { own, catalog, profile, startPoint } = input;
  const cap = capacity(profile, input.dayForm, input.feedback ?? []);
  const maxTravel = input.maxTravelHours * 60 + TRAVEL_SLACK;
  const byKind = new Map<CandidateKind, { c: Candidate; travel: number }[]>();
  const forced: Candidate[] = [];

  for (const c of catalog) {
    if (!c.active) continue;
    if (own.some((o) => isDuplicate(o, c))) continue;
    if (c.favorite || input.include?.has(c.id)) {
      forced.push(c);
      continue;
    }
    if (!profile.activities[KIND_ACTIVITY[c.kind]].enabled) continue;
    if (tooDifficult(profile, c.kind, c.difficulty)) continue;
    if (exceedsCapacity(c, cap)) continue;
    const travel = startPoint ? travelFor(c, startPoint).minutes : 0;
    if (travel > maxTravel) continue;
    const list = byKind.get(c.kind) ?? [];
    list.push({ c, travel });
    byKind.set(c.kind, list);
  }

  const picked: Candidate[] = [];
  for (const [kind, list] of byKind) {
    // «schon gemacht» first (proven), then closest.
    list.sort((a, b) => Number(b.c.done) - Number(a.c.done) || a.travel - b.travel);
    picked.push(...list.slice(0, POOL_CAP[kind]).map((x) => x.c));
  }
  return [...own, ...forced, ...picked];
}
