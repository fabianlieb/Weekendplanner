// Timing of an option: when to leave, when the activity runs, when back home.
// Also yields the exclusion reasons that depend on time (budget, start time, daylight).

import { photoWindow } from './conditions';
import { THRESHOLDS } from './thresholds';
import type { AstroDay, ExclusionReason, Minutes, Option, TimeBudget, TimeWindow } from './types';

export interface Timing {
  departure: Minutes;
  /** Start of the activity on site (first lift, start of ascent, arrival at photo spot). */
  activityStart: Minutes;
  activityEnd: Minutes;
  back: Minutes;
  /** Window used for the weather evaluation. */
  window: TimeWindow;
  /** Light window for photo options. */
  lightWindow?: TimeWindow;
}

export type TimingResult = { ok: true; timing: Timing } | { ok: false; reason: ExclusionReason };

type TimeCfg = typeof THRESHOLDS.time;

export interface TimingInput {
  option: Option;
  travelMinutes: number;
  budget: TimeBudget;
  earliestStart: Minutes;
  astro: AstroDay;
  cfg?: TimeCfg;
}

export function computeTiming(input: TimingInput): TimingResult {
  const { option, travelMinutes: travel, budget, earliestStart, astro } = input;
  const cfg = input.cfg ?? THRESHOLDS.time;
  if (budget === 'free') return { ok: false, reason: 'day_free' };
  const budgetMinutes = cfg.budgetHours[budget] * 60;
  const buffer = cfg.arrivalBufferMinutes;
  const c = option.candidate;
  const duration = c.durationHours * 60;

  const finish = (t: Timing): TimingResult =>
    t.back - t.departure > budgetMinutes ? { ok: false, reason: 'time_budget' } : { ok: true, timing: t };

  if (option.activity === 'ski') {
    const departure = Math.max(cfg.liftOpen - travel - buffer, earliestStart);
    const activityStart = departure + travel + buffer;
    const onSite = Math.min(duration, cfg.liftClose - activityStart, budgetMinutes - 2 * travel - buffer);
    if (onSite < cfg.minSkiHours * 60) return { ok: false, reason: 'time_budget' };
    const activityEnd = activityStart + onSite;
    return finish({ departure, activityStart, activityEnd, back: activityEnd + travel, window: { start: activityStart, end: activityEnd } });
  }

  if (option.activity === 'photo') {
    const approach = c.approachMinutes ?? 0;
    const light = photoWindow(astro, option.slot === 'morning' ? 'morning' : 'evening');
    const atSpot = light.start - cfg.photoSetupMinutes;
    const stay = Math.max(duration - 2 * approach, light.end - atSpot);
    const departure = atSpot - approach - buffer - travel;
    if (departure < earliestStart) return { ok: false, reason: 'start_too_early' };
    const activityEnd = atSpot + stay;
    return finish({
      departure,
      activityStart: atSpot,
      activityEnd,
      back: activityEnd + approach + travel,
      window: light,
      lightWindow: light,
    });
  }

  // ski_tour and snowshoe
  if (option.slot === 'evening') {
    const activityStart = astro.sunset + cfg.eveningStartAfterSunset;
    const departure = activityStart - travel - buffer;
    const activityEnd = activityStart + duration;
    return finish({ departure, activityStart, activityEnd, back: activityEnd + travel, window: { start: activityStart, end: activityEnd } });
  }

  const earliestOnSite = earliestStart + travel + buffer;
  const latestEnd = astro.sunset - cfg.daylightMarginMinutes;
  const activityStart = Math.max(Math.min(cfg.tourStartPreferred, latestEnd - duration), earliestOnSite);
  const activityEnd = activityStart + duration;
  if (activityEnd > latestEnd) return { ok: false, reason: 'daylight' };
  return finish({
    departure: activityStart - travel - buffer,
    activityStart,
    activityEnd,
    back: activityEnd + travel,
    window: { start: activityStart, end: activityEnd },
  });
}
