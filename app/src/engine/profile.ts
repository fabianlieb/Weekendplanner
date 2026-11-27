// Profile helpers: level per activity and migration of older profiles (one global risk level).

import type { Activity, ActivitySetting, Equipment, Profile, RiskLevel } from './types';

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
