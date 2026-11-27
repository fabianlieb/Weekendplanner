// Glue between storage, weather and the engine. The screens call these functions.

import { eveningCheck, type CheckResult } from '../engine/eveningCheck';
import { suggest } from '../engine/suggest';
import type { IsoDate, Suggestion, WeekendInput } from '../engine/types';
import { addDays, upcomingWeekend, zurichToday } from '../engine/util';
import type { PlannerDB, WeekendPlan } from './db';
import { ManualRiskProvider } from './manualRiskProvider';
import { addEveningCheck, getProfile, getWeekendPlan, listCandidates, listFeedback, saveLastInput, saveWeekendPlan } from './repositories';
import { loadWeather, type WeatherLoadOptions, type WeatherLoadResult } from './weatherService';

export interface PlannerOptions extends WeatherLoadOptions {
  now?: Date;
}

export function weekendKey(today: IsoDate): IsoDate {
  const w = upcomingWeekend(today);
  return (w.sat ?? w.sun) as IsoDate;
}

export interface ComputeResult {
  plan: WeekendPlan;
  weather: Omit<WeatherLoadResult, 'weather'>;
}

/** Thursday: compute 3 suggestions + Plan B and store them for the weekend. */
export async function computeSuggestions(db: PlannerDB, input: WeekendInput, opts: PlannerOptions = {}): Promise<ComputeResult> {
  const now = opts.now ?? new Date();
  const today = zurichToday(now);
  const [profile, candidates, feedback] = await Promise.all([getProfile(db), listCandidates(db), listFeedback(db)]);
  const riskEntries = await new ManualRiskProvider(db).getEntries(candidates.map((c) => c.id));
  const { weather, ...weatherMeta } = await loadWeather(db, candidates, { ...opts, now });

  const result = suggest({ profile, input, candidates, riskEntries, weather, today, feedback });
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
    ...(previous?.chosenId && [...result.suggestions, result.planB].some((s) => s?.id === previous.chosenId) ? { chosenId: previous.chosenId } : {}),
    checks: previous?.checks ?? [],
  };
  await saveWeekendPlan(db, plan);
  await saveLastInput(db, input);
  return { plan, weather: weatherMeta };
}

export function chosenSuggestion(plan: WeekendPlan): Suggestion | undefined {
  if (!plan.chosenId) return undefined;
  return [...plan.suggestions, ...(plan.planB ? [plan.planB] : [])].find((s) => s.id === plan.chosenId);
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

  const [profile, candidates, feedback] = await Promise.all([getProfile(db), listCandidates(db), listFeedback(db)]);
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
