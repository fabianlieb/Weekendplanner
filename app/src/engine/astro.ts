import { addTime, getMoonIllumination, getMoonTimes, getTimes, type SunTimes } from 'suncalc';
import { THRESHOLDS } from './thresholds';
import type { AstroDay, GeoPoint, IsoDate } from './types';
import { zurichMinutes, zurichNoon, zurichOffsetMinutes } from './util';

const { blueHourLower, blueHourUpper, goldenHourUpper } = THRESHOLDS.astro;

// suncalc keeps custom times in a global list; register them once.
let registered = false;
function registerTimes(): void {
  if (registered) return;
  addTime(blueHourLower, 'wpBlueMorningStart', 'wpBlueEveningEnd');
  addTime(blueHourUpper, 'wpBlueMorningEnd', 'wpBlueEveningStart');
  addTime(goldenHourUpper, 'wpGoldenMorningEnd', 'wpGoldenEveningStart');
  registered = true;
}

function at(times: SunTimes, name: string, date: IsoDate, fallback: number): number {
  const v = times[name];
  return v instanceof Date ? zurichMinutes(v, date) : fallback;
}

const cache = new Map<string, AstroDay>();

/**
 * Sun and moon times for a Zurich calendar date at a point, as minutes since local midnight.
 * Golden hour spans sun altitude blueHourUpper…goldenHourUpper, blue hour blueHourLower…blueHourUpper.
 */
export function computeAstroDay(date: IsoDate, point: GeoPoint): AstroDay {
  const key = `${date}|${point.lat.toFixed(3)}|${point.lon.toFixed(3)}|${Math.round(point.elevation / 50)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.size > 5000) cache.clear();
  const result = computeUncached(date, point);
  cache.set(key, result);
  return result;
}

function computeUncached(date: IsoDate, point: GeoPoint): AstroDay {
  registerTimes();
  const noon = zurichNoon(date);
  const offset = zurichOffsetMinutes(noon);
  const t = getTimes(noon, point.lat, point.lon, point.elevation, offset);

  const sunrise = at(t, 'sunrise', date, 8 * 60);
  const sunset = at(t, 'sunset', date, 17 * 60);
  const blueMorningStart = at(t, 'wpBlueMorningStart', date, sunrise - 40);
  const blueMorningEnd = at(t, 'wpBlueMorningEnd', date, sunrise - 20);
  const goldenMorningEnd = at(t, 'wpGoldenMorningEnd', date, sunrise + 50);
  const goldenEveningStart = at(t, 'wpGoldenEveningStart', date, sunset - 50);
  const blueEveningStart = at(t, 'wpBlueEveningStart', date, sunset + 20);
  const blueEveningEnd = at(t, 'wpBlueEveningEnd', date, sunset + 40);

  const moonTimes = getMoonTimes(noon, point.lat, point.lon, offset);
  const illumination = getMoonIllumination(new Date(noon.getTime() + (sunset - 720) * 60000));

  return {
    sunrise,
    sunset,
    blueMorning: { start: blueMorningStart, end: blueMorningEnd },
    goldenMorning: { start: blueMorningEnd, end: goldenMorningEnd },
    goldenEvening: { start: goldenEveningStart, end: blueEveningStart },
    blueEvening: { start: blueEveningStart, end: blueEveningEnd },
    moonIllumination: illumination.fraction,
    ...(moonTimes.rise ? { moonrise: zurichMinutes(moonTimes.rise, date) } : {}),
    ...(moonTimes.set ? { moonset: zurichMinutes(moonTimes.set, date) } : {}),
  };
}
