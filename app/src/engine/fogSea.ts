// Fog sea (Nebelmeer) heuristic, version 1.
// Idea: lots of low cloud at the valley point, little cloud at the summit and an inversion
// (summit warmer than valley). All constants in THRESHOLDS.fogSea, to calibrate after testing.

import { THRESHOLDS } from './thresholds';
import type { GeoPoint, HourWeather, PointDayWeather, TimeWindow } from './types';
import { clamp, mean } from './util';

export interface FogSeaResult {
  /** 0–100 */
  likelihood: number;
  likely: boolean;
  valleyLowCloud: number;
  summitCloud: number;
  inversionDelta: number;
}

type FogSeaConfig = typeof THRESHOLDS.fogSea;

function inWindow(hours: HourWeather[], w: TimeWindow): HourWeather[] {
  return hours.filter((h) => h.hour * 60 < w.end && h.hour * 60 + 60 > w.start);
}

export function fogSea(
  valley: PointDayWeather,
  summit: PointDayWeather,
  valleyPoint: GeoPoint,
  summitPoint: GeoPoint,
  /** Defaults to the morning window of the config. */
  window?: TimeWindow,
  cfg: FogSeaConfig = THRESHOLDS.fogSea,
): FogSeaResult {
  const w = window ?? cfg.window;
  const v = inWindow(valley.hours, w);
  const s = inWindow(summit.hours, w);
  const none: FogSeaResult = { likelihood: 0, likely: false, valleyLowCloud: 0, summitCloud: 100, inversionDelta: 0 };
  if (v.length === 0 || s.length === 0) return none;
  if (summitPoint.elevation - valleyPoint.elevation < cfg.minHeightDifference) return none;

  const valleyLowCloud = mean(v.map((h) => h.cloudLow));
  const summitCloud = mean(s.map((h) => h.cloudCover));
  const inversionDelta = mean(s.map((h) => h.temperature)) - mean(v.map((h) => h.temperature));

  // Each criterion contributes up to a third; partial credit close to the limit.
  const lowPart = clamp(valleyLowCloud / cfg.valleyLowCloudMin, 0, 1);
  const clearPart = clamp((100 - summitCloud) / (100 - cfg.summitCloudMax), 0, 1);
  const inversionPart = inversionDelta >= cfg.inversionMinDelta ? 1 : clamp(1 + (inversionDelta - cfg.inversionMinDelta) / 4, 0, 1);

  // All three are needed: use the product, so one missing criterion kills the fog sea.
  const likelihood = Math.round(100 * lowPart * clearPart * inversionPart);
  return { likelihood, likely: likelihood >= cfg.likelyAt, valleyLowCloud, summitCloud, inversionDelta };
}
