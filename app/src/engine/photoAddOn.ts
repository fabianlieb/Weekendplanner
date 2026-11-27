// Photo add-on: every sport suggestion gets the best photo spot nearby and the matching light time.

import { photoConditions, photoWindow } from './conditions';
import { LIGHT_LABEL } from './texts';
import { THRESHOLDS } from './thresholds';
import type { AstroFn, Candidate, CandidateWeather, IsoDate, PhotoAddOn, Slot } from './types';
import { haversineKm } from './util';
import type { Timing } from './timing';

export function nearbyPhotoSpots(c: Candidate, all: readonly Candidate[], radiusKm: number = THRESHOLDS.photoAddOn.radiusKm): Candidate[] {
  const assigned = new Set(c.photoSpotIds ?? []);
  return all.filter((s) => {
    if (s.kind !== 'photo_spot' || !s.active || s.id === c.id) return false;
    if (assigned.has(s.id)) return true;
    return Math.min(haversineKm(s.summit, c.summit), haversineKm(s.summit, c.valley)) <= radiusKm;
  });
}

export interface PhotoAddOnResult {
  addOn: PhotoAddOn;
  score: number;
  /** Latest end of the light window, to extend the schedule if needed. */
  lightEnd: number;
}

export function bestPhotoAddOn(input: {
  candidate: Candidate;
  all: readonly Candidate[];
  date: IsoDate;
  timing: Timing;
  weather: Readonly<Record<string, CandidateWeather>>;
  astro: AstroFn;
}): PhotoAddOnResult | undefined {
  const { candidate, all, date, timing, weather, astro } = input;
  const slack = THRESHOLDS.photoAddOn.windowSlackMinutes;
  const assigned = new Set(candidate.photoSpotIds ?? []);
  let best: PhotoAddOnResult | undefined;

  for (const spot of nearbyPhotoSpots(candidate, all)) {
    const w = weather[spot.id];
    if (!w) continue;
    const a = astro(date, spot.summit);
    for (const slot of ['morning', 'evening'] as Slot[]) {
      const light = photoWindow(a, slot);
      if (light.end < timing.activityStart - slack || light.start > timing.activityEnd + slack) continue;
      const cond = photoConditions({ candidate: spot, activity: 'photo', slot, date, weather: w, astro: a, window: light });
      if (!cond) continue;
      // Assigned spots win ties.
      const score = cond.score + (assigned.has(spot.id) ? 5 : 0);
      if (best && best.score >= score) continue;
      const useMoon = slot === 'evening' && cond.sub.moon !== undefined && a.moonrise !== undefined;
      best = {
        score,
        lightEnd: light.end,
        addOn: {
          spotId: spot.id,
          spotName: spot.name,
          lightLabel: useMoon ? LIGHT_LABEL.moonrise : slot === 'morning' ? LIGHT_LABEL.sunrise : LIGHT_LABEL.sunset,
          time: useMoon && a.moonrise !== undefined ? a.moonrise : slot === 'morning' ? a.sunrise : a.sunset,
        },
      };
    }
  }
  return best;
}
