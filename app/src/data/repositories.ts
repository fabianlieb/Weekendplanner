// Read/write helpers on top of the Dexie tables.

import type { Candidate, Feedback, IsoDate, Profile, RiskColor, DangerLevel, WeekendInput } from '../engine/types';
import { normalizeProfile } from '../engine/profile';
import { MANUAL_SOURCE } from '../engine/risk';
import type { EveningCheckRecord, PlannerDB, StoredRiskEntry, WeekendPlan } from './db';

export const DEFAULT_PROFILE: Profile = {
  equipment: [],
  // All sports on, most conservative level until the user sets it.
  activities: {
    ski_tour: { enabled: true, level: 1 },
    snowshoe: { enabled: true, level: 1 },
    ski: { enabled: true, level: 1 },
    photo: { enabled: true, level: 1 },
  },
  fitness: { maxElevationGain: 1200, maxHours: 6 },
  earliestStart: 5 * 60,
  startPoints: [],
};

export const DEFAULT_INPUT: Omit<WeekendInput, 'startPointId'> = {
  budget: { sat: 'full', sun: 'full' },
  maxTravelHours: 2,
  dayForm: 'normal',
  trainedGroupConfirmed: false,
};

const PROFILE_KEY = 'profile';
const LAST_INPUT_KEY = 'lastInput';

// ---------------------------------------------------------------------------
// Profile and settings

export async function getProfile(db: PlannerDB): Promise<Profile> {
  const row = await db.settings.get(PROFILE_KEY);
  // Older stored profiles (one global risk level) are migrated on read.
  return row ? normalizeProfile(row.value as Profile) : DEFAULT_PROFILE;
}

export async function hasProfile(db: PlannerDB): Promise<boolean> {
  return (await db.settings.get(PROFILE_KEY)) !== undefined;
}

export async function saveProfile(db: PlannerDB, profile: Profile): Promise<void> {
  await db.settings.put({ key: PROFILE_KEY, value: profile });
}

export async function getLastInput(db: PlannerDB): Promise<WeekendInput | undefined> {
  const row = await db.settings.get(LAST_INPUT_KEY);
  return row?.value as WeekendInput | undefined;
}

export async function saveLastInput(db: PlannerDB, input: WeekendInput): Promise<void> {
  // The red-tour confirmation is asked every time and never stored.
  await db.settings.put({ key: LAST_INPUT_KEY, value: { ...input, trainedGroupConfirmed: false } });
}

// ---------------------------------------------------------------------------
// Candidates

export async function listCandidates(db: PlannerDB): Promise<Candidate[]> {
  const all = await db.candidates.toArray();
  return all.sort((a, b) => a.name.localeCompare(b.name, 'de-CH'));
}

export async function saveCandidate(db: PlannerDB, c: Candidate): Promise<void> {
  await db.candidates.put(c);
}

export async function deleteCandidate(db: PlannerDB, id: string): Promise<void> {
  await db.transaction('rw', db.candidates, db.riskEntries, async () => {
    await db.candidates.delete(id);
    await db.riskEntries.where('candidateId').equals(id).delete();
  });
}

export async function setDone(db: PlannerDB, id: string, done: boolean): Promise<void> {
  await db.candidates.update(id, { done });
}

export function newId(prefix = 'c'): string {
  const rnd = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${rnd}`;
}

// ---------------------------------------------------------------------------
// Risk entries (manual Skitourenguru colours)

export const riskKey = (candidateId: string, date: IsoDate) => `${candidateId}|${date}`;

/** One entry per tour and day: a new tap on the same day replaces the earlier one. */
export async function setRisk(
  db: PlannerDB,
  candidateId: string,
  date: IsoDate,
  color: RiskColor,
  dangerLevel?: DangerLevel,
  now: Date = new Date(),
): Promise<void> {
  const entry: StoredRiskEntry = {
    key: riskKey(candidateId, date),
    candidateId,
    color,
    ...(dangerLevel ? { dangerLevel } : {}),
    date,
    source: MANUAL_SOURCE,
    enteredAt: now.toISOString(),
  };
  await db.riskEntries.put(entry);
}

export async function clearRisk(db: PlannerDB, candidateId: string, date: IsoDate): Promise<void> {
  await db.riskEntries.delete(riskKey(candidateId, date));
}

export async function riskEntriesOn(db: PlannerDB, date: IsoDate): Promise<StoredRiskEntry[]> {
  return db.riskEntries.where('date').equals(date).toArray();
}

export async function listRiskEntries(db: PlannerDB): Promise<StoredRiskEntry[]> {
  return db.riskEntries.toArray();
}

/** Keep the table small: entries older than `keepDays` are of no use (they are invalid anyway). */
export async function pruneRiskEntries(db: PlannerDB, olderThan: IsoDate): Promise<number> {
  return db.riskEntries.where('date').below(olderThan).delete();
}

// ---------------------------------------------------------------------------
// Feedback and weekend plans

export async function saveFeedback(db: PlannerDB, f: Feedback): Promise<void> {
  await db.feedback.put(f);
}

export async function listFeedback(db: PlannerDB): Promise<Feedback[]> {
  return (await db.feedback.toArray()).sort((a, b) => a.weekend.localeCompare(b.weekend));
}

export async function saveWeekendPlan(db: PlannerDB, plan: WeekendPlan): Promise<void> {
  await db.weekendPlans.put(plan);
}

export async function getWeekendPlan(db: PlannerDB, weekend: IsoDate): Promise<WeekendPlan | undefined> {
  return db.weekendPlans.get(weekend);
}

export async function latestWeekendPlan(db: PlannerDB): Promise<WeekendPlan | undefined> {
  return db.weekendPlans.orderBy('weekend').last();
}

export async function choosePlan(db: PlannerDB, weekend: IsoDate, suggestionId: string): Promise<void> {
  const plan = await db.weekendPlans.get(weekend);
  if (!plan) return;
  const chosen = [...plan.suggestions, ...(plan.planB ? [plan.planB] : []), ...(plan.chosen ? [plan.chosen] : [])].find((s) => s.id === suggestionId);
  await db.weekendPlans.put({ ...plan, chosenId: suggestionId, ...(chosen ? { chosen } : {}) });
}

export async function addEveningCheck(db: PlannerDB, weekend: IsoDate, check: EveningCheckRecord): Promise<void> {
  const plan = await db.weekendPlans.get(weekend);
  if (!plan) return;
  await db.weekendPlans.put({ ...plan, checks: [...plan.checks, check] });
}
