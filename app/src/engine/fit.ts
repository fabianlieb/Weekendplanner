// Fit between the person (fitness, day form, feedback) and an option.

import { THRESHOLDS } from './thresholds';
import type { Candidate, DayForm, Feedback, Profile } from './types';
import { clamp } from './util';

type FitnessCfg = typeof THRESHOLDS.fitness;

/** Capacity shift from strictness feedback: «zu leicht» raises, «zu streng» lowers, capped. */
export function feedbackAdjustment(feedback: readonly Feedback[], cfg: FitnessCfg = THRESHOLDS.fitness): number {
  let shift = 0;
  for (const f of feedback) {
    if (f.strictness === 'too_easy') shift += cfg.feedbackStep;
    if (f.strictness === 'too_hard') shift -= cfg.feedbackStep;
  }
  return clamp(shift, -cfg.feedbackCap, cfg.feedbackCap);
}

export interface Capacity {
  maxElevationGain: number;
  maxHours: number;
}

export function capacity(
  profile: Profile,
  dayForm: DayForm,
  feedback: readonly Feedback[],
  cfg: FitnessCfg = THRESHOLDS.fitness,
): Capacity {
  const factor = cfg.dayFormFactor[dayForm] * (1 + feedbackAdjustment(feedback, cfg));
  return {
    maxElevationGain: profile.fitness.maxElevationGain * factor,
    maxHours: profile.fitness.maxHours * factor,
  };
}

/** Relative load 0…n of a tour or trail against the capacity (max of elevation and time). */
export function load(c: Candidate, cap: Capacity): number {
  const gain = (c.elevationGain ?? 0) / Math.max(1, cap.maxElevationGain);
  const hours = c.durationHours / Math.max(0.1, cap.maxHours);
  return Math.max(gain, hours);
}

/** True if a tour or trail exceeds the adjusted capacity. */
export function exceedsCapacity(c: Candidate, cap: Capacity): boolean {
  if (c.kind !== 'ski_tour' && c.kind !== 'snowshoe_trail') return false;
  return load(c, cap) > 1;
}

/** Fit 0–100. Tours: ideal load range scores 100. Ski and photo: day form preference. */
export function fitScore(c: Candidate, cap: Capacity, dayForm: DayForm, cfg: FitnessCfg = THRESHOLDS.fitness): number {
  if (c.kind === 'ski_resort' || c.kind === 'photo_spot') {
    return { easy: 90, normal: 80, strong: 65 }[dayForm];
  }
  const l = load(c, cap);
  if (l < cfg.idealLoadMin) return 60 + (40 * l) / cfg.idealLoadMin;
  if (l <= cfg.idealLoadMax) return 100;
  return clamp(100 - ((l - cfg.idealLoadMax) / (1 - cfg.idealLoadMax)) * 50, 0, 100);
}
