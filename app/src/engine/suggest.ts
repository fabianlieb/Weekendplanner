// The four stages: exclusion → conditions → fit → selection (3 suggestions + Plan B).

import { computeAstroDay } from './astro';
import { evaluateConditions } from './conditions';
import { capacity, exceedsCapacity, fitScore } from './fit';
import { bestPhotoAddOn } from './photoAddOn';
import { buildReasons } from './reasons';
import { buildRiskInfo, needsAvalancheRating, resolveRisk, riskDecision } from './risk';
import { buildSchedule } from './schedule';
import { PLAN_B_REASON, activityLabel } from './texts';
import { THRESHOLDS } from './thresholds';
import { computeTiming } from './timing';
import { travelFor } from './travel';
import { weatherSummary } from './weatherSummary';
export { travelFor } from './travel';
import type {
  Activity,
  AstroFn,
  Candidate,
  CandidateKind,
  CandidateWeather,
  DayKey,
  Equipment,
  Exclusion,
  ExclusionReason,
  Feedback,
  IsoDate,
  Option,
  PlanB,
  Profile,
  RiskEntry,
  Slot,
  Suggestion,
  SuggestionResult,
  WeekendInput,
} from './types';
import { haversineKm, upcomingWeekend } from './util';

export interface EngineContext {
  profile: Profile;
  input: WeekendInput;
  candidates: readonly Candidate[];
  riskEntries: readonly RiskEntry[];
  /** Weather per candidate id. */
  weather: Readonly<Record<string, CandidateWeather>>;
  /** Date of the computation (Zurich). Risk entries are only valid on this date. */
  today: IsoDate;
  feedback?: readonly Feedback[];
  astro?: AstroFn;
  /** Restrict to these dates (used by the evening check). */
  onlyDates?: readonly IsoDate[];
}

// ---------------------------------------------------------------------------
// Stage 1 helpers

const KIND_ACTIVITY: Record<CandidateKind, Activity> = {
  ski_resort: 'ski',
  ski_tour: 'ski_tour',
  snowshoe_trail: 'snowshoe',
  photo_spot: 'photo',
};

export function requiredEquipment(c: Candidate): Equipment[] {
  switch (c.kind) {
    case 'ski_resort':
      return ['alpine_ski'];
    case 'ski_tour':
      return ['touring_ski', 'skins', 'avalanche_kit'];
    case 'snowshoe_trail':
      return c.signposted ? ['snowshoes'] : ['snowshoes', 'avalanche_kit'];
    case 'photo_spot':
      return ['camera'];
  }
}

export function slotsFor(c: Candidate): Slot[] {
  if (c.kind === 'photo_spot') return ['morning', 'evening'];
  if (c.kind === 'ski_resort') return ['day'];
  return c.eveningPossible ? ['day', 'evening'] : ['day'];
}


// ---------------------------------------------------------------------------
// Evaluation of all options

export interface ScoredOption {
  option: Option;
  suggestion: Suggestion;
  total: number;
}

export interface Evaluation {
  valid: ScoredOption[];
  excluded: Exclusion[];
}

export function evaluateOptions(ctx: EngineContext): Evaluation {
  const astro = ctx.astro ?? computeAstroDay;
  const { profile, input } = ctx;
  const startPoint = profile.startPoints.find((s) => s.id === input.startPointId);
  const cap = capacity(profile, input.dayForm, ctx.feedback ?? []);
  const weekend = upcomingWeekend(ctx.today);
  const days = (['sat', 'sun'] as DayKey[]).filter((d) => {
    const date = weekend[d];
    return date !== undefined && (!ctx.onlyDates || ctx.onlyDates.includes(date));
  });

  const valid: ScoredOption[] = [];
  const excluded: Exclusion[] = [];

  for (const c of ctx.candidates) {
    const activity = KIND_ACTIVITY[c.kind];
    // Reasons independent of day and slot
    const base: ExclusionReason[] = [];
    if (!c.active) base.push('inactive');
    if (!requiredEquipment(c).every((e) => profile.equipment.includes(e))) base.push('equipment_missing');

    const riskStatus = resolveRisk(c, ctx.riskEntries, ctx.today);
    const decision = riskDecision(riskStatus, profile.riskLevel, input.trainedGroupConfirmed);
    if (decision === 'unknown') base.push(riskStatus.kind === 'unknown' && riskStatus.reason === 'stale' ? 'risk_stale' : 'risk_unknown');
    if (decision === 'above_level') base.push('risk_above_level');
    if (decision === 'red_unconfirmed') base.push('risk_red_unconfirmed');

    const travel = startPoint ? travelFor(c, startPoint) : undefined;
    if (!travel) base.push('travel_unknown');
    else if (travel.minutes > input.maxTravelHours * 60) base.push('travel_too_long');
    if (exceedsCapacity(c, cap)) base.push('fitness');

    for (const day of days) {
      const date = weekend[day] as IsoDate;
      for (const slot of slotsFor(c)) {
        const option: Option = { candidate: c, activity, day, date, slot };
        const reasons = [...base];
        const budget = input.budget[day];
        if (budget === 'free') reasons.push('day_free');

        const w = ctx.weather[c.id];
        const hasWeather = !!w && !!w.summit[date] && !!w.valley[date];
        if (!hasWeather) reasons.push('weather_missing');

        const astroValley = astro(date, c.valley);
        const astroSummit = astro(date, c.summit);
        const timingResult =
          travel && budget !== 'free'
            ? computeTiming({
                option,
                travelMinutes: travel.minutes,
                budget,
                earliestStart: profile.earliestStart,
                astro: activity === 'photo' ? astroSummit : astroValley,
              })
            : undefined;
        if (timingResult && !timingResult.ok) reasons.push(timingResult.reason);

        const timing = timingResult?.ok ? timingResult.timing : undefined;
        const cond = timing && w && hasWeather ? evaluateConditions({ candidate: c, activity, slot, date, weather: w, astro: astroSummit, window: timing.window }) : undefined;
        if (timing && hasWeather) {
          if (!cond) reasons.push('weather_missing');
          else if (cond.knockout) reasons.push('weather_knockout');
          else if (cond.score < THRESHOLDS.scoring.minConditionScore) reasons.push('conditions_poor');
        }

        if (reasons.length > 0 || !timing || !cond || !travel || !startPoint || budget === 'free') {
          excluded.push({ candidateId: c.id, day, slot, reasons: [...new Set(reasons)] });
          continue;
        }

        // Photo add-on for sport options
        let back = timing.back;
        let departure = timing.departure;
        let activityStart = timing.activityStart;
        let photo: Suggestion['photo'];
        if (activity !== 'photo' && profile.equipment.includes('camera')) {
          const best = bestPhotoAddOn({
            candidate: c,
            all: ctx.candidates,
            date,
            timing,
            startPoint,
            earliestStart: profile.earliestStart,
            budgetMinutes: THRESHOLDS.time.budgetHours[budget] * 60,
            flexibleStart: activity === 'ski',
            weather: ctx.weather,
            astro,
          });
          if (best) {
            photo = best.addOn;
            back = best.back;
            departure = best.departure;
            activityStart = best.activityStart;
          }
        }

        const risk = buildRiskInfo(c, riskStatus, date);
        const ws = w ? weatherSummary({ candidate: c, weather: w, date, window: timing.window, slot, astro: astroSummit }) : undefined;
        const fit = fitScore(c, cap, input.dayForm);
        const riskPenalty = risk.color ? THRESHOLDS.scoring.riskPenalty[risk.color] : 0;
        const total = THRESHOLDS.scoring.conditionWeight * cond.score + THRESHOLDS.scoring.fitWeight * fit - riskPenalty;

        const suggestion: Suggestion = {
          id: `${c.id}:${date}:${slot}`,
          candidateId: c.id,
          candidateName: c.name,
          ...(c.region ? { region: c.region } : {}),
          activity,
          activityLabel: activityLabel(activity, slot, photo !== undefined),
          day,
          date,
          slot,
          score: Math.round(total),
          conditionScore: Math.round(cond.score),
          fitScore: Math.round(fit),
          sub: Object.fromEntries(Object.entries(cond.sub).map(([k, v]) => [k, Math.round(v)])),
          reasons: buildReasons({ sub: cond.sub, facts: cond.facts, risk, ...(photo ? { photo } : {}), isPhotoActivity: activity === 'photo' }),
          schedule: buildSchedule({ option, timing: { ...timing, departure, activityStart }, startPointName: startPoint.name, astro: activity === 'photo' ? astroSummit : astroValley, ...(photo ? { photo } : {}), back }),
          travel: { ...travel, startPointName: startPoint.name },
          ...(photo ? { photo } : {}),
          ...(c.priceChf !== undefined ? { priceChf: c.priceChf } : {}),
          risk,
          ...(ws ? { weather: ws } : {}),
          isNew: !c.done,
          avalancheDependent: needsAvalancheRating(c),
        };
        valid.push({ option, suggestion, total });
      }
    }
  }
  return { valid, excluded };
}

// ---------------------------------------------------------------------------
// Stage 4: selection

function similarityPenalty(o: ScoredOption, chosen: readonly ScoredOption[]): number {
  const s = THRESHOLDS.selection;
  let penalty = 0;
  for (const ch of chosen) {
    if (ch.option.activity === o.option.activity) penalty += s.sameActivityPenalty;
    if (ch.option.day === o.option.day) penalty += s.sameDayPenalty;
    if (haversineKm(ch.option.candidate.summit, o.option.candidate.summit) <= s.samePlaceKm) penalty += s.samePlacePenalty;
  }
  return penalty;
}

/** Best option per candidate is not enough: we keep all, but never two of the same candidate. */
export function selectSuggestions(valid: readonly ScoredOption[], count: number = THRESHOLDS.selection.count): ScoredOption[] {
  const s = THRESHOLDS.selection;
  const chosen: ScoredOption[] = [];
  const usedCandidates = new Set<string>();

  const pickBest = (pool: readonly ScoredOption[]): ScoredOption | undefined => {
    let best: ScoredOption | undefined;
    let bestScore = -Infinity;
    for (const o of pool) {
      if (usedCandidates.has(o.option.candidate.id)) continue;
      const adj = o.total - similarityPenalty(o, chosen);
      if (adj > bestScore) {
        bestScore = adj;
        best = o;
      }
    }
    return best;
  };

  while (chosen.length < count) {
    const next = pickBest(valid);
    if (!next) break;
    chosen.push(next);
    usedCandidates.add(next.option.candidate.id);
  }

  // Mix: about `targetNew` new options, the rest proven ones.
  const isNew = (o: ScoredOption) => !o.option.candidate.done;
  const replace = (out: ScoredOption, pool: (o: ScoredOption) => boolean): boolean => {
    const others = chosen.filter((c) => c !== out);
    const used = new Set(others.map((c) => c.option.candidate.id));
    let best: ScoredOption | undefined;
    for (const o of valid) {
      if (used.has(o.option.candidate.id) || o === out || !pool(o)) continue;
      if (o.total < out.total - s.mixTolerance) continue;
      if (!best || o.total - similarityPenalty(o, others) > best.total - similarityPenalty(best, others)) best = o;
    }
    if (!best) return false;
    chosen[chosen.indexOf(out)] = best;
    return true;
  };

  const newCount = () => chosen.filter(isNew).length;
  if (newCount() < s.targetNew) {
    const proven = chosen.filter((o) => !isNew(o)).sort((a, b) => a.total - b.total);
    for (const out of proven) {
      if (newCount() >= s.targetNew) break;
      replace(out, isNew);
    }
  }
  if (newCount() > s.targetNew) {
    const news = chosen.filter(isNew).sort((a, b) => a.total - b.total);
    for (const out of news) {
      if (newCount() <= s.targetNew) break;
      replace(out, (o) => !isNew(o));
    }
  }

  return [...chosen].sort((a, b) => b.total - a.total);
}

/** Plan B: the best alternative in case suggestion 1 falls through (other place, activity or day). */
export function selectPlanB(valid: readonly ScoredOption[], chosen: readonly ScoredOption[]): PlanB | undefined {
  const first = chosen[0];
  if (!first) return undefined;
  const s = THRESHOLDS.selection;
  const chosenIds = new Set(chosen.map((c) => c.option.candidate.id));
  let best: ScoredOption | undefined;
  let bestScore = -Infinity;
  for (const o of valid) {
    if (o.option.candidate.id === first.option.candidate.id) continue;
    let score = o.total;
    // Avalanche risk can rise → an option without avalanche dependency on the same day.
    // Weather can turn → another day helps.
    if (first.suggestion.avalancheDependent) {
      if (!o.suggestion.avalancheDependent) score += s.planBIndependenceBonus;
      if (o.option.day === first.option.day) score += s.planBDayBonus;
    } else if (o.option.day !== first.option.day) score += s.planBDayBonus;
    if (chosenIds.has(o.option.candidate.id)) score -= 5; // prefer something not already on the list
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }
  if (!best) return undefined;
  const reason =
    first.suggestion.avalancheDependent && !best.suggestion.avalancheDependent
      ? PLAN_B_REASON.avalanche
      : best.option.day !== first.option.day
        ? PLAN_B_REASON.weather(first.option.day)
        : PLAN_B_REASON.generic;
  return { ...best.suggestion, planBReason: reason };
}

export function suggest(ctx: EngineContext): SuggestionResult {
  const { valid, excluded } = evaluateOptions(ctx);
  const chosen = selectSuggestions(valid);
  const planB = selectPlanB(valid, chosen);
  return {
    suggestions: chosen.map((c) => c.suggestion),
    ...(planB ? { planB } : {}),
    excluded,
  };
}
