// Glue between storage, weather and the engine. The screens call these functions.

import { eveningCheck, type CheckResult } from '../engine/eveningCheck';
import { evaluateOptions, suggest, type ScoredOption } from '../engine/suggest';
import { selectPool } from '../engine/pool';
import { getCandidate, getCatalog } from './catalog';
import { spotRadar } from '../engine/radar';
import type { Candidate, Exclusion, ExclusionReason, Feedback, IsoDate, PlanB, Profile, StartPoint, Suggestion, WeekendInput } from '../engine/types';
import { PLAN_B_REASON } from '../engine/texts';
import { THRESHOLDS } from '../engine/thresholds';
import { addDays, haversineKm, upcomingWeekend, weekday, zurichMinutes, zurichToday } from '../engine/util';
import type { PlannerDB, WeekendPlan } from './db';
import { ManualRiskProvider } from './manualRiskProvider';
import { addEveningCheck, getProfile, getWeekendPlan, listCandidates, listFeedback, listWeekendPlans, saveWeekendPlan } from './repositories';
import { learnPreferences, type Preferences } from '../engine/preferences';
import { loadWeather, type WeatherLoadOptions, type WeatherLoadResult } from './weatherService';
import { attachRoutedTravel, type RoutingFetch } from './routing';
import { travelFor, type TravelTime } from '../engine/travel';

export interface PlannerOptions extends WeatherLoadOptions {
  now?: Date;
  /** Catalogue entries (tests inject them; default: routes.json + built-in ski areas). */
  catalog?: readonly Candidate[];
  /** Ad-hoc start point (current location) used for this computation and stored with the plan. */
  extraStartPoint?: StartPoint;
  /** Routing services (OSRM, transport.opendata.ch); tests inject a fake. */
  routingFetch?: RoutingFetch;
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

/** The weekend's start point with its travel mode (weekend choice, else the start point's default, else car). */
function withTravelMode(profile: Profile, input: WeekendInput): { profile: Profile; startPoint?: StartPoint } {
  const sp0 = profile.startPoints.find((s) => s.id === input.startPointId);
  if (!sp0) return { profile };
  const sp: StartPoint = { ...sp0, mode: input.travelMode ?? sp0.mode ?? 'car' };
  const startPoints = profile.startPoints.map((s) => (s.id === sp.id ? sp : s));
  // No trains before the first departures: public transport never starts earlier.
  const earliestStart = sp.mode === 'transit' ? Math.max(profile.earliestStart, THRESHOLDS.routing.transitFirstDeparture) : profile.earliestStart;
  return { profile: { ...profile, startPoints, earliestStart }, startPoint: sp };
}

interface RoutingRun {
  now: Date;
  date: IsoDate;
  routingFetch?: RoutingFetch;
}

/**
 * Candidate pool with routed travel times. Car: cached times for all places (cheap) so the
 * pre-selection uses them, then one request for the pool's missing times. Public transport:
 * cached times only; `withTransit` looks up the likely suggestions afterwards.
 */
async function routedPool(
  db: PlannerDB,
  args: Omit<Parameters<typeof selectPool>[0], 'startPoint'>,
  startPoint: StartPoint | undefined,
  run: RoutingRun,
): Promise<Candidate[]> {
  if (!startPoint) return selectPool(args);
  const ro = { now: run.now, ...(run.routingFetch ? { fetchFn: run.routingFetch } : {}) };
  const isCar = (startPoint.mode ?? 'car') === 'car';
  const own = isCar ? await attachRoutedTravel(db, args.own, startPoint, ro) : args.own;
  const catalog = isCar ? await attachRoutedTravel(db, args.catalog, startPoint, ro) : args.catalog;
  const pool = selectPool({ ...args, own, catalog, startPoint });
  return attachRoutedTravel(db, pool, startPoint, { ...ro, fetchMissing: isCar, date: run.date });
}

/** Learned preferences: ratings from feedback and the plans chosen on earlier weekends. */
export async function loadPreferences(db: PlannerDB, feedback: readonly Feedback[], currentWeekend: IsoDate): Promise<Preferences> {
  const plans = await listWeekendPlans(db);
  const choices = plans
    .filter((p) => p.weekend !== currentWeekend)
    .map((p) => p.chosen ?? (p.chosenId ? findSuggestion(p, p.chosenId) : undefined))
    .filter((s): s is Suggestion => !!s)
    .map((s) => ({ candidateId: s.candidateId, activity: s.activity }));
  return learnPreferences(feedback, choices);
}

/** Public transport: timetable lookups for the given candidates first (cached afterwards). */
async function withTransit(db: PlannerDB, pool: Candidate[], startPoint: StartPoint | undefined, priority: readonly string[], run: RoutingRun): Promise<Candidate[]> {
  if (!startPoint || startPoint.mode !== 'transit') return pool;
  return attachRoutedTravel(db, pool, startPoint, {
    now: run.now,
    date: run.date,
    fetchMissing: true,
    priority,
    ...(run.routingFetch ? { fetchFn: run.routingFetch } : {}),
  });
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

/** How many tours at most the app asks colours for (the best-fitting first). */
export const MAX_AWAITING_COLOUR = 5;

/**
 * Tours that would have a valid option if only today's Skitourenguru colour were entered,
 * best potential first, at most MAX_AWAITING_COLOUR.
 */
export function awaitingColour(excluded: readonly Exclusion[], max = MAX_AWAITING_COLOUR): string[] {
  const riskOnly = (r: ExclusionReason) => r === 'risk_unknown' || r === 'risk_stale';
  const best = new Map<string, number>();
  for (const e of excluded) {
    if (e.reasons.length === 0 || !e.reasons.every(riskOnly)) continue;
    best.set(e.candidateId, Math.max(best.get(e.candidateId) ?? -1, e.potential ?? 0));
  }
  return [...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([id]) => id);
}

export interface ComputeResult {
  plan: WeekendPlan;
  weather: Omit<WeatherLoadResult, 'weather'>;
}

/** Thursday: compute 3 suggestions + Plan B and store them for the weekend. */
export async function computeSuggestions(db: PlannerDB, input: WeekendInput, opts: PlannerOptions = {}): Promise<ComputeResult> {
  const now = opts.now ?? new Date();
  const today = zurichToday(now);
  const [savedProfile, own, feedback, catalog] = await Promise.all([getProfile(db), listCandidates(db), listFeedback(db), getCatalog(db, opts.catalog)]);
  const { profile, startPoint } = withTravelMode(withStartPoint(savedProfile, opts.extraStartPoint), input);
  const previousPlan = await getWeekendPlan(db, weekendKey(today));
  const run: RoutingRun = { now, date: weekendKey(today), ...(opts.routingFetch ? { routingFetch: opts.routingFetch } : {}) };
  const pool = await routedPool(
    db,
    {
      own,
      catalog,
      profile,
      maxTravelHours: input.maxTravelHours,
      dayForm: input.dayForm,
      feedback,
      include: new Set(previousPlan?.chosen ? [previousPlan.chosen.candidateId] : []),
    },
    startPoint,
    run,
  );
  const riskEntries = await new ManualRiskProvider(db).getEntries(pool.map((c) => c.id));
  const { weather, ...weatherMeta } = await loadWeather(db, pool, { ...opts, now });

  // Public transport: first evaluate with estimates, then look up real connections for the
  // places that can be suggested (best first) and evaluate again.
  const preferences = await loadPreferences(db, feedback, weekendKey(today));
  const likely =
    startPoint?.mode === 'transit'
      ? evaluateOptions({ profile, input, candidates: pool, riskEntries, weather, today, feedback, preferences })
          .valid.sort((a, b) => b.total - a.total)
          .map((o) => o.option.candidate.id)
      : [];
  const candidates = await withTransit(db, pool, startPoint, [...new Set(likely)], run);

  const ctx = { profile, input, candidates, riskEntries, weather, today, feedback, preferences };
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
    // Plans chosen before snapshots existed: take the snapshot from the previous suggestions.
    ...(previous?.chosenId
      ? (() => {
          const snapshot = previous.chosen ?? findSuggestion(previous, previous.chosenId);
          return { chosenId: previous.chosenId, ...(snapshot ? { chosen: snapshot } : {}) };
        })()
      : {}),
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

  const [savedProfile, own, feedback, catalog] = await Promise.all([getProfile(db), listCandidates(db), listFeedback(db), getCatalog(db, opts.catalog)]);
  const { profile, startPoint } = withTravelMode(withStartPoint(savedProfile, plan.startPoint), plan.input);
  const run: RoutingRun = { now, date: weekendKey(today), ...(opts.routingFetch ? { routingFetch: opts.routingFetch } : {}) };
  const pool = await routedPool(
    db,
    {
      own,
      catalog,
      profile,
      maxTravelHours: plan.input.maxTravelHours,
      dayForm: plan.input.dayForm,
      feedback,
      // The chosen plan and its Plan B must be re-evaluated even if the pool changed.
      include: new Set([chosen.candidateId, ...(plan.planB ? [plan.planB.candidateId] : [])]),
    },
    startPoint,
    run,
  );
  const candidates = await withTransit(db, pool, startPoint, [chosen.candidateId, ...(plan.planB ? [plan.planB.candidateId] : [])], run);
  const riskEntries = await new ManualRiskProvider(db).getEntries(candidates.map((c) => c.id));
  const { weather, ...weatherMeta } = await loadWeather(db, candidates, { forceRefresh: true, ...opts, now });
  const preferences = await loadPreferences(db, feedback, plan.weekend);
  const ctx = { profile, input: plan.input, candidates, riskEntries, weather, today, feedback, preferences };
  const planB = plan.planB && plan.planB.id !== chosen.id ? plan.planB : undefined;
  // On the day itself (morning check) an alternative must still be reachable from now on.
  const result = eveningCheck(ctx, chosen, planB, chosen.date === today ? { notBefore: zurichMinutes(now, today) } : {});

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

// ---------------------------------------------------------------------------
// «Warum nicht …?»: why a place is not among this weekend's suggestions

export type WhyNot =
  | { status: 'no_plan' }
  | { status: 'not_found' }
  | { status: 'suggested'; suggestion: Suggestion; planB: boolean }
  | {
      status: 'evaluated';
      candidate: Candidate;
      /** False if the pre-selection (nearest places per sport) left the place out. */
      inPool: boolean;
      valid: ScoredOption[];
      excluded: Exclusion[];
      travel?: TravelTime;
      /** Lowest score among the suggestions (a valid option must beat it). */
      bar?: number;
    };

/**
 * Evaluates one place with the current weekend settings (weather from the cache or fetched now).
 * Same rules as the suggestions, so the reasons match the engine.
 */
export async function explainCandidate(db: PlannerDB, candidateId: string, opts: PlannerOptions = {}): Promise<WhyNot> {
  const now = opts.now ?? new Date();
  const today = zurichToday(now);
  const plan = await currentWeekendPlan(db, now);
  if (!plan) return { status: 'no_plan' };
  const hit = plan.suggestions.find((s) => s.candidateId === candidateId) ?? (plan.planB?.candidateId === candidateId ? plan.planB : undefined);
  if (hit) return { status: 'suggested', suggestion: hit, planB: plan.planB?.id === hit.id };

  const c0 = await getCandidate(db, candidateId, opts.catalog);
  if (!c0) return { status: 'not_found' };
  const [savedProfile, own, feedback, catalog] = await Promise.all([getProfile(db), listCandidates(db), listFeedback(db), getCatalog(db, opts.catalog)]);
  const { profile, startPoint } = withTravelMode(withStartPoint(savedProfile, plan.startPoint), plan.input);
  const run: RoutingRun = { now, date: weekendKey(today), ...(opts.routingFetch ? { routingFetch: opts.routingFetch } : {}) };
  const [c] = startPoint
    ? await attachRoutedTravel(db, [c0], startPoint, {
        now,
        date: run.date,
        fetchMissing: true,
        priority: [c0.id],
        ...(run.routingFetch ? { fetchFn: run.routingFetch } : {}),
      })
    : [c0];
  const candidate = c ?? c0;
  const pool = await routedPool(
    db,
    { own, catalog, profile, maxTravelHours: plan.input.maxTravelHours, dayForm: plan.input.dayForm, feedback },
    startPoint,
    run,
  );
  const riskEntries = await new ManualRiskProvider(db).getEntries([candidate.id]);
  const { weather } = await loadWeather(db, [candidate], { ...opts, now });
  const preferences = await loadPreferences(db, feedback, plan.weekend);
  const ev = evaluateOptions({ profile, input: plan.input, candidates: [candidate], riskEntries, weather, today, feedback, preferences });
  const scores = [...plan.suggestions].map((s) => s.score);
  return {
    status: 'evaluated',
    candidate,
    inPool: pool.some((p) => p.id === candidate.id),
    valid: ev.valid.sort((a, b) => b.total - a.total),
    excluded: ev.excluded,
    ...(startPoint ? { travel: travelFor(candidate, startPoint) } : {}),
    ...(scores.length ? { bar: Math.min(...scores) } : {}),
  };
}
