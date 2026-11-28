// Travel time from a start point to a candidate: manual value (car), routed value, or estimate from air distance.

import { THRESHOLDS } from './thresholds';
import type { Candidate, GeoPoint, StartPoint, TransitInfo, TravelMode, TravelSource } from './types';
import { haversineKm } from './util';

export interface TravelTime {
  minutes: number;
  estimated: boolean;
  mode: TravelMode;
  source: TravelSource;
  transit?: TransitInfo;
}

/** Identifies a start point by mode and rounded position (routed times are cached per key). */
export function startKey(sp: Pick<StartPoint, 'lat' | 'lon'>, mode: TravelMode): string {
  const d = THRESHOLDS.routing.startDecimals;
  return `${mode}|${sp.lat.toFixed(d)},${sp.lon.toFixed(d)}`;
}

/** Where the journey ends: by car the parking if known, else the start of the activity. */
export function travelDestination(c: Pick<Candidate, 'valley' | 'parking'>, mode: TravelMode): Pick<GeoPoint, 'lat' | 'lon'> {
  return mode === 'car' && c.parking ? c.parking : c.valley;
}

export function travelFor(c: Candidate, sp: StartPoint): TravelTime {
  const mode = sp.mode ?? 'car';
  const manual = c.travelMinutes[sp.id];
  if (mode === 'car' && manual !== undefined && Number.isFinite(manual)) return { minutes: manual, estimated: false, mode, source: 'manual' };
  const r = c.routedTravel;
  if (r && r.mode === mode && r.startKey === startKey(sp, mode)) {
    return { minutes: r.minutes, estimated: false, mode, source: 'routed', ...(r.transit ? { transit: r.transit } : {}) };
  }
  const t = THRESHOLDS.travelEstimate;
  const p = mode === 'transit' ? t.transit : t;
  const km = haversineKm(sp, c.valley) * p.roadFactor;
  return { minutes: Math.round((km / p.averageSpeedKmh) * 60 + p.fixedMinutes), estimated: true, mode, source: 'estimate' };
}
