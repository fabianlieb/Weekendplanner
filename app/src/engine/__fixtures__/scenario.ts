// Test data: a small candidate list in Eastern / Central Switzerland and synthetic weather.
// Coordinates are approximate and only meant for tests.

import type {
  Candidate,
  CandidateWeather,
  HourWeather,
  IsoDate,
  PointDayWeather,
  Profile,
  RiskEntry,
  WeekendInput,
} from '../types';
import type { EngineContext } from '../suggest';
import { MANUAL_SOURCE } from '../risk';

/** Thursday. The weekend is Sat 2026-12-05 / Sun 2026-12-06. */
export const TODAY: IsoDate = '2026-12-03';
export const SAT: IsoDate = '2026-12-05';
export const SUN: IsoDate = '2026-12-06';

export const profile: Profile = {
  equipment: ['alpine_ski', 'touring_ski', 'skins', 'avalanche_kit', 'snowshoes', 'camera', 'tripod'],
  maxDifficulty: { ski_tour: 'ZS', snowshoe: 'schwer' },
  activities: {
    ski_tour: { enabled: true, level: 2 },
    snowshoe: { enabled: true, level: 2 },
    ski: { enabled: true, level: 2 },
    photo: { enabled: true, level: 2 },
  },
  fitness: { maxElevationGain: 1500, maxHours: 7 },
  earliestStart: 5 * 60,
  startPoints: [
    { id: 'home', name: 'Zuhause', lat: 47.3769, lon: 8.5417 },
    { id: 'cabin', name: 'Ferienhaus', lat: 46.8, lon: 9.83 },
  ],
};

/** The same profile with one level for ski tours and snowshoe tours. */
export function withLevel(p: Profile, level: 1 | 2 | 3): Profile {
  return { ...p, activities: { ...p.activities, ski_tour: { enabled: true, level }, snowshoe: { enabled: true, level } } };
}

export const input: WeekendInput = {
  budget: { sat: 'full', sun: 'full' },
  maxTravelHours: 3,
  startPointId: 'home',
  dayForm: 'normal',
  trainedGroupConfirmed: false,
};

const base = { done: true, active: true } as const;

export const candidates: Candidate[] = [
  {
    ...base,
    id: 'flumserberg',
    name: 'Flumserberg',
    kind: 'ski_resort',
    region: 'Flumserberg',
    valley: { lat: 47.0919, lon: 9.2836, elevation: 1400 },
    summit: { lat: 47.0778, lon: 9.2994, elevation: 2020 },
    durationHours: 7,
    travelMinutes: { home: 60 },
    priceChf: 69,
  },
  {
    ...base,
    id: 'laax',
    name: 'Laax',
    kind: 'ski_resort',
    region: 'Surselva',
    valley: { lat: 46.8381, lon: 9.2667, elevation: 1100 },
    summit: { lat: 46.8711, lon: 9.1739, elevation: 3018 },
    durationHours: 7,
    travelMinutes: { home: 100 },
    priceChf: 89,
    done: false,
  },
  {
    ...base,
    id: 'schwarzhorn',
    name: 'Schwarzhorn (Flüela)',
    kind: 'ski_tour',
    region: 'Region Davos',
    valley: { lat: 46.7556, lon: 9.9567, elevation: 2207 },
    summit: { lat: 46.7353, lon: 9.9603, elevation: 3146 },
    elevationGain: 950,
    durationHours: 5,
    travelMinutes: { home: 140, cabin: 25 },
  },
  {
    ...base,
    id: 'pizol',
    name: 'Pizol',
    kind: 'ski_tour',
    region: 'Sarganserland',
    valley: { lat: 46.9975, lon: 9.45, elevation: 1630 },
    summit: { lat: 46.9703, lon: 9.3967, elevation: 2844 },
    elevationGain: 1200,
    durationHours: 6,
    travelMinutes: { home: 75 },
    done: false,
  },
  {
    ...base,
    id: 'languard',
    name: 'Piz Languard',
    kind: 'ski_tour',
    region: 'Engadin',
    valley: { lat: 46.4914, lon: 9.9025, elevation: 1805 },
    summit: { lat: 46.4925, lon: 9.9483, elevation: 3262 },
    elevationGain: 1450,
    durationHours: 6,
    travelMinutes: { home: 200 },
  },
  {
    ...base,
    id: 'ibergeregg',
    name: 'Trail Ibergeregg',
    kind: 'snowshoe_trail',
    region: 'Ybrig',
    valley: { lat: 47.0189, lon: 8.7125, elevation: 1406 },
    summit: { lat: 47.0275, lon: 8.7275, elevation: 1650 },
    elevationGain: 300,
    durationHours: 2.5,
    travelMinutes: { home: 55 },
    signposted: true,
    eveningPossible: true,
    done: false,
  },
  {
    ...base,
    id: 'fronalpstock',
    name: 'Fronalpstock',
    kind: 'snowshoe_trail',
    region: 'Stoos',
    valley: { lat: 46.9772, lon: 8.6631, elevation: 1300 },
    summit: { lat: 46.9706, lon: 8.6408, elevation: 1922 },
    elevationGain: 650,
    durationHours: 4,
    travelMinutes: { home: 70 },
    signposted: false,
  },
  {
    ...base,
    id: 'chaeserrugg',
    name: 'Chäserrugg',
    kind: 'photo_spot',
    region: 'Toggenburg',
    valley: { lat: 47.1236, lon: 9.3122, elevation: 427 },
    summit: { lat: 47.1544, lon: 9.3131, elevation: 2262 },
    durationHours: 1.5,
    approachMinutes: 15,
    travelMinutes: { home: 80 },
  },
  {
    ...base,
    id: 'rigi',
    name: 'Rigi Kulm',
    kind: 'photo_spot',
    region: 'Zentralschweiz',
    valley: { lat: 47.0856, lon: 8.4419, elevation: 440 },
    summit: { lat: 47.0567, lon: 8.485, elevation: 1797 },
    durationHours: 1.5,
    approachMinutes: 10,
    travelMinutes: { home: 50 },
  },
];

export const freshRisks = (today: IsoDate = TODAY): RiskEntry[] => [
  { candidateId: 'schwarzhorn', color: 'green', dangerLevel: 2, date: today, source: MANUAL_SOURCE },
  { candidateId: 'pizol', color: 'orange', dangerLevel: 3, date: today, source: MANUAL_SOURCE },
  { candidateId: 'languard', color: 'green', dangerLevel: 2, date: today, source: MANUAL_SOURCE },
  { candidateId: 'fronalpstock', color: 'green', dangerLevel: 2, date: today, source: MANUAL_SOURCE },
];

// ---------------------------------------------------------------------------
// Weather builders

export type HourParams = Omit<HourWeather, 'hour'>;

export const SUNNY: HourParams = {
  temperature: -6,
  cloudCover: 10,
  cloudLow: 0,
  cloudMid: 10,
  cloudHigh: 30,
  windSpeed: 10,
  windGusts: 20,
  visibility: 40000,
  sunshineMinutes: 55,
  precipitation: 0,
  snowfall: 0,
};

export const OVERCAST: HourParams = {
  temperature: -2,
  cloudCover: 100,
  cloudLow: 100,
  cloudMid: 100,
  cloudHigh: 100,
  windSpeed: 25,
  windGusts: 45,
  visibility: 800,
  sunshineMinutes: 0,
  precipitation: 0.8,
  snowfall: 0.6,
};

export const STORM: HourParams = { ...OVERCAST, windSpeed: 60, windGusts: 95 };

/** Valley under fog (low cloud, cold) — combine with a warm, clear summit for a fog sea. */
export const VALLEY_FOG: HourParams = { ...SUNNY, temperature: -3, cloudCover: 95, cloudLow: 95, cloudMid: 0, cloudHigh: 10, visibility: 300, sunshineMinutes: 0 };
export const SUMMIT_ABOVE_FOG: HourParams = { ...SUNNY, temperature: 3 };

export function day(date: IsoDate, p: HourParams, newSnow72h = 0, model = 'test'): PointDayWeather {
  return { date, model, newSnow72h, hours: Array.from({ length: 24 }, (_, hour) => ({ hour, ...p })) };
}

export type WeatherFn = (c: Candidate, date: IsoDate, point: 'valley' | 'summit') => HourParams | undefined;

export function buildWeather(cands: readonly Candidate[], fn: WeatherFn, newSnow72h = 12, dates: IsoDate[] = [SAT, SUN]): Record<string, CandidateWeather> {
  const out: Record<string, CandidateWeather> = {};
  for (const c of cands) {
    const w: CandidateWeather = { valley: {}, summit: {} };
    for (const d of dates) {
      for (const point of ['valley', 'summit'] as const) {
        const p = fn(c, d, point);
        if (p) w[point][d] = day(d, p, newSnow72h);
      }
    }
    out[c.id] = w;
  }
  return out;
}

/** Good weekend: sunny everywhere, fog sea in the lowlands. */
export const goodWeather: WeatherFn = (c, _d, point) => {
  if (point === 'valley' && c.valley.elevation < 800) return VALLEY_FOG;
  return point === 'summit' && c.kind === 'photo_spot' ? SUMMIT_ABOVE_FOG : SUNNY;
};

export function context(overrides: Partial<EngineContext> = {}): EngineContext {
  return {
    profile,
    input,
    candidates,
    riskEntries: freshRisks(),
    weather: buildWeather(candidates, goodWeather),
    today: TODAY,
    feedback: [],
    ...overrides,
  };
}
