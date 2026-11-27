// Weather numbers for display: what the summit/spot looks like during the activity window.

import { hoursIn } from './conditions';
import { fogSea } from './fogSea';
import type { AstroDay, Candidate, CandidateWeather, IsoDate, Slot, TimeWindow, WeatherSummary } from './types';
import { mean, sum } from './util';

export function weatherSummary(input: {
  candidate: Candidate;
  weather: CandidateWeather;
  date: IsoDate;
  window: TimeWindow;
  slot: Slot;
  astro: AstroDay;
}): WeatherSummary | undefined {
  const { candidate, weather, date, window, slot } = input;
  const summit = weather.summit[date];
  const valley = weather.valley[date];
  if (!summit) return undefined;
  const hours = hoursIn(summit.hours, window);
  if (hours.length === 0) return undefined;

  const sunshine = hours.every((h) => h.sunshineMinutes !== undefined) ? sum(hours.map((h) => h.sunshineMinutes ?? 0)) / 60 : undefined;
  const fog = valley ? fogSea(valley, summit, candidate.valley, candidate.summit).likely : false;
  const round1 = (x: number) => Math.round(x * 10) / 10;

  return {
    temperature: Math.round(mean(hours.map((h) => h.temperature))),
    maxGust: Math.round(Math.max(...hours.map((h) => h.windGusts))),
    cloudCover: Math.round(mean(hours.map((h) => h.cloudCover))),
    ...(sunshine !== undefined ? { sunshineHours: round1(sunshine) } : {}),
    newSnowCm: Math.round(summit.newSnow72h),
    precipitationMm: round1(sum(hours.map((h) => h.precipitation))),
    fogSeaLikely: fog,
    ...(slot === 'evening' ? { moonIllumination: input.astro.moonIllumination } : {}),
    model: summit.model,
    hours: hours.map((h) => ({
      hour: h.hour,
      temperature: Math.round(h.temperature),
      windGusts: Math.round(h.windGusts),
      cloudCover: Math.round(h.cloudCover),
      ...(h.sunshineMinutes !== undefined ? { sunshineMinutes: Math.round(h.sunshineMinutes) } : {}),
      precipitation: round1(h.precipitation),
    })),
  };
}
