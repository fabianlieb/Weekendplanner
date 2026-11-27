// Condition score 0–100 per option from weather and light. Pure functions.

import { fogSea } from './fogSea';
import { THRESHOLDS } from './thresholds';
import type {
  Activity,
  AstroDay,
  Candidate,
  CandidateWeather,
  ConditionResult,
  HourWeather,
  IsoDate,
  Slot,
  SubScores,
  TimeWindow,
} from './types';
import { LIGHT_LABEL } from './texts';
import { clamp, mean, ramp, sum, weighted } from './util';

type WeatherCfg = typeof THRESHOLDS.weather;

/** Hours overlapping the window [start, end). */
export function hoursIn(hours: HourWeather[], w: TimeWindow): HourWeather[] {
  return hours.filter((h) => h.hour * 60 < w.end && h.hour * 60 + 60 > w.start);
}

function sunScore(hours: HourWeather[], cloudRamp: { bad: number; good: number }): number {
  if (hours.length > 0 && hours.every((h) => h.sunshineMinutes !== undefined)) {
    return clamp(mean(hours.map((h) => ((h.sunshineMinutes ?? 0) / 60) * 100)), 0, 100);
  }
  return ramp(mean(hours.map((h) => h.cloudCover)), cloudRamp);
}

function visibilityScore(
  hours: HourWeather[],
  visRamp: { bad: number; good: number },
  proxy: { bad: number; good: number },
): number {
  const vis = hours.map((h) => h.visibility).filter((v): v is number => v !== undefined);
  if (vis.length === hours.length && vis.length > 0) return ramp(mean(vis), visRamp);
  return ramp(mean(hours.map((h) => h.cloudCover)), proxy);
}

function newSnowScore(cm: number, r: { bad: number; good: number }, base: number): number {
  return base + (ramp(cm, r) * (100 - base)) / 100;
}

const maxOf = (xs: number[]) => (xs.length ? Math.max(...xs) : 0);

export interface ConditionInput {
  candidate: Candidate;
  activity: Activity;
  slot: Slot;
  date: IsoDate;
  weather: CandidateWeather;
  astro: AstroDay;
  /** Time on site (from the timing module). */
  window: TimeWindow;
  cfg?: WeatherCfg;
}

/** Returns undefined when weather data for the date is missing (fail closed). */
export function evaluateConditions(input: ConditionInput): ConditionResult | undefined {
  const { activity, slot, date, weather } = input;
  const summit = weather.summit[date];
  const valley = weather.valley[date];
  if (!summit || !valley) return undefined;
  const cfg = input.cfg ?? THRESHOLDS.weather;

  if (activity === 'photo') return photoConditions(input);
  const hours = hoursIn(summit.hours, input.window);
  if (hours.length === 0) return undefined;

  const maxGust = maxOf(hours.map((h) => h.windGusts));
  const meanTemp = mean(hours.map((h) => h.temperature));
  const precip = sum(hours.map((h) => h.precipitation));

  if (activity === 'ski') {
    const c = cfg.ski;
    const sub: SubScores = {
      sun: sunScore(hours, c.cloudCover),
      newSnow: newSnowScore(summit.newSnow72h, c.newSnow, c.newSnowBase),
      wind: ramp(maxGust, c.gusts),
      temperature: Math.min(ramp(meanTemp, c.cold), ramp(meanTemp, c.warm)),
      precipitation: ramp(precip, c.precipitation),
    };
    return {
      score: weighted(sub, c.weights),
      sub,
      facts: { newSnowCm: summit.newSnow72h, maxGust, meanTemp },
      ...(maxGust >= c.gustKnockout ? { knockout: 'wind' as const } : {}),
    };
  }

  // ski_tour and snowshoe
  if (slot === 'evening') {
    const c = cfg.eveningTour;
    const moonUp = moonVisibleInWindow(input.astro, input.window);
    const sub: SubScores = {
      clearNight: ramp(mean(hours.map((h) => h.cloudCover)), c.clearNight),
      moon: moonUp ? ramp(input.astro.moonIllumination, c.moon) : 0,
      wind: ramp(maxGust, c.gusts),
      precipitation: ramp(precip, c.precipitation),
    };
    return {
      score: weighted(sub, c.weights),
      sub,
      facts: {
        maxGust,
        meanTemp,
        moonIllumination: input.astro.moonIllumination,
        ...(input.astro.moonrise !== undefined ? { moonrise: input.astro.moonrise } : {}),
      },
      ...(maxGust >= c.gustKnockout ? { knockout: 'wind' as const } : {}),
    };
  }

  const c = cfg.tour;
  const sub: SubScores = {
    visibility: visibilityScore(hours, c.visibility, c.visibilityProxyCloud),
    wind: ramp(maxGust, c.gusts),
    sun: sunScore(hours, c.cloudCover),
    newSnow: newSnowScore(summit.newSnow72h, c.newSnow, c.newSnowBase),
    precipitation: ramp(precip, c.precipitation),
  };
  return {
    score: weighted(sub, c.weights),
    sub,
    facts: { newSnowCm: summit.newSnow72h, maxGust, meanTemp },
    ...(maxGust >= c.gustKnockout ? { knockout: 'wind' as const } : {}),
  };
}

/** Moon above the horizon at some point of the window. */
export function moonVisibleInWindow(astro: AstroDay, w: TimeWindow): boolean {
  const { moonrise, moonset } = astro;
  if (moonrise === undefined && moonset === undefined) return astro.moonIllumination > 0.5; // always up/down: rough guess
  if (moonrise !== undefined && moonset !== undefined) {
    if (moonrise < moonset) return moonrise < w.end && moonset > w.start;
    return moonset > w.start || moonrise < w.end; // sets in the morning, rises in the evening
  }
  if (moonrise !== undefined) return moonrise < w.end;
  return (moonset ?? 0) > w.start;
}

/** The light window of a photo slot. */
export function photoWindow(astro: AstroDay, slot: Slot): TimeWindow {
  return slot === 'morning'
    ? { start: astro.blueMorning.start, end: astro.goldenMorning.end }
    : { start: astro.goldenEvening.start, end: astro.blueEvening.end };
}

export function photoConditions(input: ConditionInput): ConditionResult | undefined {
  const { date, weather, astro, candidate } = input;
  const summit = weather.summit[date];
  const valley = weather.valley[date];
  if (!summit || !valley) return undefined;
  const c = (input.cfg ?? THRESHOLDS.weather).photo;
  const slot: Slot = input.slot === 'morning' ? 'morning' : 'evening';
  const window = photoWindow(astro, slot);
  const hours = hoursIn(summit.hours, window);
  if (hours.length === 0) return undefined;

  const lowCloud = ramp(mean(hours.map((h) => h.cloudLow)), c.lowCloudAtSpot);
  const colour = mean(hours.map((h) => Math.max(h.cloudMid, h.cloudHigh)));
  const cc = c.colourClouds;
  const clouds =
    colour < cc.idealMin
      ? cc.emptySkyScore + ((100 - cc.emptySkyScore) * colour) / cc.idealMin
      : colour <= cc.idealMax
        ? 100
        : clamp((100 * (cc.zeroAt - colour)) / (cc.zeroAt - cc.idealMax), 0, 100);
  const maxGust = maxOf(hours.map((h) => h.windGusts));

  const fog = fogSea(valley, summit, candidate.valley, candidate.summit, slot === 'morning' ? undefined : window);
  const base: SubScores = {
    clouds,
    visibility: visibilityScore(hours, c.visibility, c.visibilityProxyCloud),
    lowCloud,
    wind: ramp(maxGust, c.gusts),
  };
  const clearScore = weighted(base, c.weightsClear);
  const fogScore = weighted({ ...base, fogSea: fog.likelihood }, c.weightsFogSea);

  const moonBonus =
    slot === 'evening' &&
    astro.moonrise !== undefined &&
    astro.moonrise >= window.start - 60 &&
    astro.moonrise <= window.end + 120 &&
    astro.moonIllumination >= c.moonBonusMinIllumination
      ? c.moonBonus
      : 0;

  const lightTime = slot === 'morning' ? astro.sunrise : astro.sunset;
  return {
    score: clamp(Math.max(clearScore, fogScore) + moonBonus, 0, 100),
    sub: { ...base, fogSea: fog.likelihood, ...(moonBonus ? { moon: 100 } : {}) },
    facts: {
      fogSea: fog.likely,
      maxGust,
      moonIllumination: astro.moonIllumination,
      ...(astro.moonrise !== undefined ? { moonrise: astro.moonrise } : {}),
      lightLabel: slot === 'morning' ? LIGHT_LABEL.sunrise : LIGHT_LABEL.sunset,
      lightTime,
    },
  };
}
