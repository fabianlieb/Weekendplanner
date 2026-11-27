// Travel time from a start point to a candidate: manual value or estimate from air distance.

import { THRESHOLDS } from './thresholds';
import type { Candidate, StartPoint } from './types';
import { haversineKm } from './util';

export function travelFor(c: Candidate, sp: StartPoint): { minutes: number; estimated: boolean } {
  const manual = c.travelMinutes[sp.id];
  if (manual !== undefined && Number.isFinite(manual)) return { minutes: manual, estimated: false };
  const t = THRESHOLDS.travelEstimate;
  const km = haversineKm(sp, c.valley) * t.roadFactor;
  return { minutes: Math.round((km / t.averageSpeedKmh) * 60 + t.fixedMinutes), estimated: true };
}
