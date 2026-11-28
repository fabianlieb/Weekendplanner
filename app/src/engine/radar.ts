// Spot radar: which favourite places have very good conditions in the coming days?
// Replaces the «Spot-Alarm» (no push without a server): the result is shown on the start screen.
// Places in avalanche terrain are left out on purpose: without today's Skitourenguru colour
// the app must not call a tour worthwhile (fail closed).

import { computeAstroDay } from './astro';
import { evaluateConditions, photoWindow } from './conditions';
import { needsAvalancheRating } from './risk';
import { LIGHT_LABEL, REASON } from './texts';
import { THRESHOLDS } from './thresholds';
import type { Activity, AstroFn, Candidate, CandidateKind, CandidateWeather, IsoDate, Slot } from './types';
import { formatTime } from './util';

export interface RadarHit {
  candidateId: string;
  name: string;
  activity: Activity;
  date: IsoDate;
  slot: Slot;
  score: number;
  /** «Nebelmeer wahrscheinlich · Sonnenaufgang 07:52» */
  headline: string;
}

const KIND_ACTIVITY: Record<CandidateKind, Activity> = { ski_resort: 'ski', ski_tour: 'ski_tour', snowshoe_trail: 'snowshoe', photo_spot: 'photo' };

export const RADAR = {
  /** Minimum condition score for a radar hit. */
  minScore: 75,
  maxHits: 6,
} as const;

export function spotRadar(input: {
  candidates: readonly Candidate[];
  weather: Readonly<Record<string, CandidateWeather>>;
  dates: readonly IsoDate[];
  astro?: AstroFn;
}): RadarHit[] {
  const astro = input.astro ?? computeAstroDay;
  const hits: RadarHit[] = [];
  for (const c of input.candidates) {
    if (!c.favorite || !c.active || needsAvalancheRating(c)) continue;
    const w = input.weather[c.id];
    if (!w) continue;
    const activity = KIND_ACTIVITY[c.kind];
    const slots: Slot[] = activity === 'photo' ? ['morning', 'evening'] : ['day'];
    for (const date of input.dates) {
      const a = astro(date, c.summit);
      for (const slot of slots) {
        const window = activity === 'photo' ? photoWindow(a, slot) : THRESHOLDS.weather.dayWindow;
        const cond = evaluateConditions({ candidate: c, activity, slot, date, weather: w, astro: a, window });
        if (!cond || cond.knockout || cond.score < RADAR.minScore) continue;
        const parts: string[] = [];
        if (cond.facts.fogSea) parts.push('Nebelmeer wahrscheinlich');
        if (activity === 'photo') parts.push(`${slot === 'morning' ? LIGHT_LABEL.sunrise : LIGHT_LABEL.sunset} ${formatTime(slot === 'morning' ? a.sunrise : a.sunset)}`);
        else {
          if ((cond.sub.sun ?? 0) >= 85) parts.push(REASON.sunny);
          if ((cond.facts.newSnowCm ?? 0) >= 5) parts.push(REASON.newSnow(cond.facts.newSnowCm ?? 0));
        }
        hits.push({ candidateId: c.id, name: c.name, activity, date, slot, score: Math.round(cond.score), headline: parts.join(' · ') || 'Sehr gute Bedingungen' });
      }
    }
  }
  // Best first; at most one hit per place and day.
  const seen = new Set<string>();
  return hits
    .sort((x, y) => y.score - x.score || x.date.localeCompare(y.date))
    .filter((h) => {
      const k = `${h.candidateId}|${h.date}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, RADAR.maxHits);
}
