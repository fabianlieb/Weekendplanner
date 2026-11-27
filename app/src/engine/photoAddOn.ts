// Photo add-on: every sport suggestion gets the best photo spot nearby and the matching light time,
// but only if the detour is feasible: morning light before the activity (with transfer to the start),
// or evening light after it (with transfer to the spot). Departure and return time adapt.

import { photoConditions, photoWindow } from './conditions';
import { LIGHT_LABEL } from './texts';
import { THRESHOLDS } from './thresholds';
import type { Timing } from './timing';
import { travelFor } from './travel';
import type { AstroFn, Candidate, CandidateWeather, GeoPoint, IsoDate, Minutes, PhotoAddOn, Slot, StartPoint } from './types';
import { haversineKm } from './util';

type AddOnCfg = typeof THRESHOLDS.photoAddOn;

export function nearbyPhotoSpots(c: Candidate, all: readonly Candidate[], radiusKm: number = THRESHOLDS.photoAddOn.radiusKm): Candidate[] {
  const assigned = new Set(c.photoSpotIds ?? []);
  return all.filter((s) => {
    if (s.kind !== 'photo_spot' || !s.active || s.id === c.id) return false;
    if (assigned.has(s.id)) return true;
    return Math.min(haversineKm(s.summit, c.summit), haversineKm(s.summit, c.valley)) <= radiusKm;
  });
}

/** Conservative drive between a photo spot and the activity (air distance, mountain detours). */
export function transferMinutes(a: GeoPoint, b: GeoPoint, cfg: AddOnCfg = THRESHOLDS.photoAddOn): number {
  const km = haversineKm(a, b);
  if (km <= cfg.walkingDistanceKm) return 0;
  return Math.round(((km * cfg.transfer.roadFactor) / cfg.transfer.averageSpeedKmh) * 60 + cfg.transfer.fixedMinutes);
}

export interface PhotoAddOnResult {
  addOn: PhotoAddOn;
  score: number;
  departure: Minutes;
  back: Minutes;
  /** Start of the activity (later for a ski day after a morning photo). */
  activityStart: Minutes;
}

export interface PhotoAddOnInput {
  candidate: Candidate;
  all: readonly Candidate[];
  date: IsoDate;
  timing: Timing;
  startPoint: StartPoint;
  earliestStart: Minutes;
  budgetMinutes: number;
  /** Ski days may start a bit later; tours keep their start time. */
  flexibleStart: boolean;
  weather: Readonly<Record<string, CandidateWeather>>;
  astro: AstroFn;
  cfg?: AddOnCfg;
}

export function bestPhotoAddOn(input: PhotoAddOnInput): PhotoAddOnResult | undefined {
  const { candidate, all, date, timing, weather, astro } = input;
  const cfg = input.cfg ?? THRESHOLDS.photoAddOn;
  const buffer = THRESHOLDS.time.arrivalBufferMinutes;
  const assigned = new Set(candidate.photoSpotIds ?? []);
  let best: PhotoAddOnResult | undefined;

  for (const spot of nearbyPhotoSpots(candidate, all, cfg.radiusKm)) {
    const w = weather[spot.id];
    if (!w) continue;
    const a = astro(date, spot.summit);
    const approach = spot.approachMinutes ?? 0;
    const transfer = transferMinutes(spot.summit, candidate.valley, cfg);
    const fromHome = travelFor(spot, input.startPoint).minutes;

    for (const slot of ['morning', 'evening'] as Slot[]) {
      let departure = timing.departure;
      let back = timing.back;
      let activityStart = timing.activityStart;
      let time: Minutes;
      if (slot === 'morning') {
        time = a.sunrise;
        const arriveSpot = a.sunrise - cfg.arriveBeforeLightMinutes;
        const arriveActivity = a.sunrise + cfg.shootAfterLightMinutes + approach + transfer + buffer;
        const latestArrival = timing.activityStart + (input.flexibleStart ? cfg.skiDelayMaxMinutes : 0);
        if (arriveActivity > latestArrival) continue;
        activityStart = Math.max(timing.activityStart, arriveActivity);
        departure = Math.min(timing.departure, arriveSpot - approach - fromHome - buffer);
        if (departure < input.earliestStart) continue;
      } else {
        time = a.sunset;
        const arriveSpot = timing.activityEnd + transfer + buffer + approach;
        if (arriveSpot > a.sunset - cfg.arriveBeforeLightMinutes) continue;
        back = Math.max(timing.back, a.sunset + cfg.shootAfterLightMinutes + approach + fromHome);
      }
      if (back - departure > input.budgetMinutes) continue;

      const light = photoWindow(a, slot);
      const cond = photoConditions({ candidate: spot, activity: 'photo', slot, date, weather: w, astro: a, window: light });
      if (!cond) continue;
      // Assigned spots win ties; a shorter day wins over a longer one.
      const score = cond.score + (assigned.has(spot.id) ? 5 : 0) - (back - departure - (timing.back - timing.departure)) / 60;
      if (best && best.score >= score) continue;
      best = {
        score,
        departure,
        back,
        activityStart,
        addOn: {
          spotId: spot.id,
          spotName: spot.name,
          lightLabel: slot === 'morning' ? LIGHT_LABEL.sunrise : LIGHT_LABEL.sunset,
          time,
        },
      };
    }
  }
  return best;
}
