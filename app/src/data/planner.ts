// Glue between storage, weather and the engine. The screens call these functions.

import { eveningCheck, type CheckResult } from '../engine/eveningCheck';
import { evaluateOptions, suggest } from '../engine/suggest';
import { spotRadar } from '../engine/radar';
import type { Exclusion, ExclusionReason, IsoDate, PlanB, Profile, StartPoint, Suggestion, WeekendInput } from '../engine/types';
import { PLAN_B_REASON } from '../engine/texts';
import { addDays, haversineKm, upcomingWeekend, weekday, zurichToday } from '../engine/util';
import type { PlannerDB, WeekendPlan } from './db';
import { ManualRiskProvider } from './manualRiskProvider';
import { addEveningCheck, getProfile, getWeekendPlan, listCandidates, listFeedback, saveWeekendPlan } from './repositories';
import { loadWeather, type WeatherLoadOptions, type WeatherLoadResult } from './weatherService';

export interface PlannerOptions extends WeatherLoadOptions {
  now?: Date;
  /** Ad-hoc start point (current location) used for this computation and stored with the plan. */
  extraStartPoint?: StartPoint;
}

/** Start point id meaning «current location». */
export const HERE = 'here';
/** A saved start point closer than this (km) to the current location is used instead. */
export const SNAP_TO_SAVED_KM = 10;

/**
 * Resolves the start point choice: a saved start point, or the current location
 * (snapped to a nearby saved start point so its manual travel times apply).
 * Without a location, falls back to `fallbackId` or the first saved start point.
 */
export function resolveStartPoint(
  choice: string,
  saved: readonly StartPoint[],
  position: { lat: number; lon: number } | undefined,
  fallbackId?: string,
): { startPoint: StartPoint | undefined; adhoc: boolean; usedLocation: boolean } {
  if (choice !== HERE) {
    const sp = saved.find((s) => s.id === choice) ?? saved[0];
    return { startPoint: sp, adhoc: false, usedLocation: false };
  }
  if (position) {
    let nearest: StartPoint | undefined;
    let best = Infinity;
    for (const s of saved) {
      const d = haversineKm(s, position);
      if (d < best) {
        best = d;
        nearest = s;
      }
    }
    if (nearest && best <= SNAP_TO_SAVED_KM) return { startPoint: nearest, adhoc: false, usedLocation: true };
    return { startPoint: { id: HERE, name: 'Standort', lat: position.lat, lon: position.lon }, adhoc: true, usedLocation: true };
  }
  return { startPoint: saved.find((s) => s.id === fallbackId) ?? saved[0], adhoc: false, usedLocation: false };
}

function withStartPoint(profile: Profile, sp: StartPoint | undefined): Profile {
  if (!sp || profile.startPoints.some((s) => s.id === sp.id)) return profile;
  return { ...profile, startPoints: [...profile.startPoints, sp] };
}

/** Saturday of the current/upcoming weekend (on Sunday: the day before), the key of a weekend plan. */
export function weekendKey(today: IsoDate): IsoDate {
  const w = upcomingWeekend(today);
  return w.sat ?? addDays(w.sun as IsoDate, -1);
}

/** The weekend screen updates automatically once per day, from this hour on. */
export const AUTO_UPDATE_FROM_HOUR = 5;

/** Saturday of the weekend that feedback refers to (the current one on Sat/Sun, else the last one). */
export function feedbackWeekend(today: IsoDate): IsoDate {
  const wd = weekday(today);
  return addDays(today, wd === 6 ? 0 : -((wd + 1) % 7));
}

/** Per reason: how many candidates were not suggested at all (no valid option on any day). */
export function summariseExclusions(excluded: readonly Exclusion[], suggestedOrValid: ReadonlySet<string>): Partial<Record<ExclusionReason, number>> {
  const perCandidate = new Map<string, Set<ExclusionReason>>();
  for (const e of excluded) {
    if (suggestedOrValid.has(e.candidateId)) continue;
    const set = perCandidate.get(e.candidateId) ?? new Set<ExclusionReason>();
    e.reasons.forEach((r) => set.add(r));
    perCandidate.set(e.candidateId, set);
  }
  const out: Partial<Record<ExclusionReason, number>> = {};
  for (const reasons of perCandidate.values()) {
    for (const r of reasons) {
      if (r === 'day_free' || r === 'inactive') continue;
      out[r] = (out[r] ?? 0) + 1;
    }
  }
  return out;
}

/** Candidates that would have at least one valid option if only today's Skitourenguru colour were entered. */
export function awaitingColour(excluded: readonly Exclusion[]): string[] {
  const riskOnly = (r: ExclusionReason) => r === 'risk_unknown' || r === 'risk_stale';
  return [...new Set(excluded.filter((e) => e.reasons.length > 0 && e.reasons.every(riskOnly)).map((e) => e.candidateId))];
}

export interface ComputeResult {
  plan: WeekendPlan;
  weather: Omit<WeatherLoadResult, 'weather'>;
}

/** Thursday: compute 3 suggestions + Plan B and store them for the weekend. */
export async function computeSuggestions(db: PlannerDB, input: WeekendInput, opts: PlannerOptions = {}): Promise<ComputeResult> {
  const now = opts.now ?? new Date();
  const today = zurichToday(now);
  const [savedProfile, candidates, feedback] = await Promise.all([getProfile(db), listCandidates(db), listFeedback(db)]);
  const profile = withStartPoint(savedProfile, opts.extraStartPoint);
  const riskEntries = await new ManualRiskProvider(db).getEntries(candidates.map((c) => c.id));
  const { weather, ...weatherMeta } = await loadWeather(db, candidates, { ...opts, now });

  const ctx = { profile, input, candidates, riskEntries, weather, today, feedback };
  const result = suggest(ctx);
  const validIds = new Set(evaluateOptions(ctx).valid.map((o) => o.option.candidate.id));
  const weekend = weekendKey(today);
  const previous = await getWeekendPlan(db, weekend);
  const plan: WeekendPlan = {
    weekend,
    createdAt: now.toISOString(),
    computedOn: today,
    input,
    suggestions: result.suggestions,
    ...(result.planB ? { planB: result.planB } : {}),
    // Recomputing drops a chosen plan only if it no longer exists.
    // A chosen plan always survives a recomputation (as snapshot); the evening check decides if it still holds.
    ...(previous?.chosenId ? { chosenId: previous.chosenId, ...(previous.chosen ? { chosen: previous.chosen } : {}) } : {}),
    checks: previous?.checks ?? [],
    excludedSummary: summariseExclusions(result.excluded, validIds),
    awaitingColour: awaitingColour(result.excluded),
    radar: spotRadar({ candidates, weather, dates: Array.from({ length: 7 }, (_, i) => addDays(today, i)) }),
    weather: weatherMeta,
    ...(opts.extraStartPoint ? { startPoint: opts.extraStartPoint } : {}),
  };
  await saveWeekendPlan(db, plan);
  return { plan, weather: weatherMeta };
}

/**
 * Opening the weekend screen computes automatically only when there is no plan yet, or once a day
 * (first opening from AUTO_UPDATE_FROM_HOUR on). Otherwise the stored suggestions stay; updating is manual.
 */
export function needsAutoCompute(plan: WeekendPlan | undefined, today: IsoDate, hour: number): boolean {
  if (!plan) return true;
  return plan.computedOn !== today && hour >= AUTO_UPDATE_FROM_HOUR;
}

export function chosenSuggestion(plan: WeekendPlan): Suggestion | undefined {
  if (!plan.chosenId) return undefined;
  return plan.chosen ?? [...plan.suggestions, ...(plan.planB ? [plan.planB] : [])].find((s) => s.id === plan.chosenId);
}

/** The weekend plan relevant today: this weekend's (Mon–Sun). */
export async function currentWeekendPlan(db: PlannerDB, now: Date = new Date()): Promise<WeekendPlan | undefined> {
  const today = zurichToday(now);
  return (await getWeekendPlan(db, weekendKey(today))) ?? (await getWeekendPlan(db, addDays(today, -1)));
}

export type EveningCheckOutcome =
  | { status: 'no_plan' }
  | { status: 'no_choice'; plan: WeekendPlan }
  | { status: 'past'; plan: WeekendPlan; chosen: Suggestion }
  | { status: 'checked'; plan: WeekendPlan; chosen: Suggestion; result: CheckResult; weather: Omit<WeatherLoadResult, 'weather'> };

/** Evening check: fresh weather, today's risk entries, chosen plan vs. Plan B. */
export async function runEveningCheck(db: PlannerDB, opts: PlannerOptions = {}): Promise<EveningCheckOutcome> {
  const now = opts.now ?? new Date();
  const today = zurichToday(now);
  const plan = await currentWeekendPlan(db, now);
  if (!plan) return { status: 'no_plan' };
  const chosen = chosenSuggestion(plan);
  if (!chosen) return { status: 'no_choice', plan };
  if (chosen.date < today) return { status: 'past', plan, chosen };

  const [savedProfile, candidates, feedback] = await Promise.all([getProfile(db), listCandidates(db), listFeedback(db)]);
  const profile = withStartPoint(savedProfile, plan.startPoint);
  const riskEntries = await new ManualRiskProvider(db).getEntries(candidates.map((c) => c.id));
  const { weather, ...weatherMeta } = await loadWeather(db, candidates, { forceRefresh: true, ...opts, now });
  const ctx = { profile, input: plan.input, candidates, riskEntries, weather, today, feedback };
  const planB = plan.planB && plan.planB.id !== chosen.id ? plan.planB : undefined;
  const result = eveningCheck(ctx, chosen, planB);

  await addEveningCheck(db, plan.weekend, {
    checkedAt: now.toISOString(),
    date: today,
    status: result.status,
    ...(result.status === 'switch' ? { reason: result.reason, ...(result.alternative ? { alternativeId: result.alternative.id } : {}) } : {}),
  });
  return { status: 'checked', plan, chosen, result, weather: weatherMeta };
}

/** Evening check switched: take the alternative as Plan B and choose it. */
export async function adoptAlternative(db: PlannerDB, weekend: IsoDate, alternative: PlanB | Suggestion): Promise<void> {
  const plan = await getWeekendPlan(db, weekend);
  if (!plan) return;
  const known = plan.suggestions.some((s) => s.id === alternative.id);
  const planB: PlanB = 'planBReason' in alternative ? alternative : { ...alternative, planBReason: PLAN_B_REASON.generic };
  await saveWeekendPlan(db, { ...plan, ...(known ? {} : { planB }), chosenId: alternative.id, chosen: known ? alternative : planB });
}

export function findSuggestion(plan: WeekendPlan, id: string): Suggestion | PlanB | undefined {
  return [...plan.suggestions, ...(plan.planB ? [plan.planB] : []), ...(plan.chosen ? [plan.chosen] : [])].find((s) => s.id === id);
}
