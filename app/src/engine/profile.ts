// Profile helpers: level per activity and migration of older profiles (one global risk level).

import type { Activity, ActivitySetting, Equipment, Profile, RiskLevel, SkiTourGrade, SnowshoeGrade } from './types';

export const ACTIVITIES: Activity[] = ['ski_tour', 'snowshoe', 'ski', 'photo'];

/** Activities where the level limits the Skitourenguru colours. */
export const AVALANCHE_ACTIVITIES: Activity[] = ['ski_tour', 'snowshoe'];

export function levelFor(profile: Profile, activity: Activity): RiskLevel {
  return profile.activities[activity].level;
}

/** The «Du bist in einer geschulten Gruppe?» question is only relevant at level 3. */
export function asksTrainedGroup(profile: Profile): boolean {
  return AVALANCHE_ACTIVITIES.some((a) => profile.activities[a].enabled && profile.activities[a].level === 3);
}

const isLevel = (v: unknown): v is RiskLevel => v === 1 || v === 2 || v === 3;

/**
 * Accepts current and older stored profiles. Older profiles had one `riskLevel` and no activity
 * list: all activities are enabled and the old level applies to ski tours and snowshoe tours.
 */
export function normalizeProfile(raw: Partial<Profile> & { riskLevel?: unknown }): Profile {
  const oldLevel: RiskLevel = isLevel(raw.riskLevel) ? raw.riskLevel : 1;
  const acts = (raw.activities ?? {}) as Partial<Record<Activity, Partial<ActivitySetting>>>;
  const activities = Object.fromEntries(
    ACTIVITIES.map((a) => {
      const s = acts[a];
      return [a, { enabled: s?.enabled ?? true, level: isLevel(s?.level) ? s.level : oldLevel }];
    }),
  ) as Record<Activity, ActivitySetting>;
  return {
    equipment: (raw.equipment ?? []) as Equipment[],
    activities,
    maxDifficulty: {
      ski_tour: SKI_TOUR_GRADES.includes(raw.maxDifficulty?.ski_tour as SkiTourGrade) ? (raw.maxDifficulty?.ski_tour as SkiTourGrade) : DEFAULT_MAX_DIFFICULTY.ski_tour,
      snowshoe: SNOWSHOE_GRADES.includes(raw.maxDifficulty?.snowshoe as SnowshoeGrade) ? (raw.maxDifficulty?.snowshoe as SnowshoeGrade) : DEFAULT_MAX_DIFFICULTY.snowshoe,
    },
    fitness: raw.fitness ?? { maxElevationGain: 1200, maxHours: 6 },
    earliestStart: raw.earliestStart ?? 5 * 60,
    startPoints: raw.startPoints ?? [],
  };
}

/** Equipment each sport needs at minimum (unsignposted snowshoe tours additionally need the avalanche kit). */
export const ACTIVITY_EQUIPMENT: Record<Activity, Equipment[]> = {
  ski_tour: ['touring_ski', 'skins', 'avalanche_kit'],
  snowshoe: ['snowshoes'],
  ski: ['alpine_ski'],
  photo: ['camera'],
};

export function missingEquipment(profile: Profile, activity: Activity): Equipment[] {
  return ACTIVITY_EQUIPMENT[activity].filter((e) => !profile.equipment.includes(e));
}

export const DEFAULT_MAX_DIFFICULTY: Profile['maxDifficulty'] = { ski_tour: 'WS', snowshoe: 'mittel' };

export const SKI_TOUR_GRADES: SkiTourGrade[] = ['L', 'WS', 'ZS', 'S'];
export const SNOWSHOE_GRADES: SnowshoeGrade[] = ['leicht', 'mittel', 'schwer'];

/** SAC ski scale class 0 = L, 1 = WS, 2 = ZS, 3 = S, 4 = SS, 5 = AS, 6 = EX (+/- ignored). */
export function skiGradeRank(grade: string): number | undefined {
  const m = grade.trim().toUpperCase().match(/^(EX|AS|SS|ZS|WS|S|L)/);
  return m ? ['L', 'WS', 'ZS', 'S', 'SS', 'AS', 'EX'].indexOf(m[1] as string) : undefined;
}

/** Snowshoe: 0 = leicht (blau, WT1), 1 = mittel (rot, WT2), 2 = schwer (schwarz, WT3 and above). */
export function snowshoeGradeRank(grade: string): number | undefined {
  const g = grade.trim().toLowerCase();
  if (g === 'blau') return 0;
  if (g === 'rot') return 1;
  if (g === 'schwarz') return 2;
  const m = g.match(/^wt(\d)/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return n <= 1 ? 0 : n === 2 ? 1 : 2;
}

/** True if a candidate's difficulty is above the profile limit. Unknown difficulty passes. */
export function tooDifficult(profile: Profile, kind: 'ski_tour' | 'snowshoe_trail' | 'ski_resort' | 'photo_spot', difficulty: string | undefined): boolean {
  if (!difficulty) return false;
  if (kind === 'ski_tour') {
    const r = skiGradeRank(difficulty);
    return r !== undefined && r > SKI_TOUR_GRADES.indexOf(profile.maxDifficulty.ski_tour);
  }
  if (kind === 'snowshoe_trail') {
    const r = snowshoeGradeRank(difficulty);
    return r !== undefined && r > SNOWSHOE_GRADES.indexOf(profile.maxDifficulty.snowshoe);
  }
  return false;
}
