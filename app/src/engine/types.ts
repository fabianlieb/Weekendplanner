// Domain model of the weekend planner. The engine only depends on these types,
// never on a data source (Open-Meteo, IndexedDB, ...), so it stays testable without a browser.

/** Local calendar date in Europe/Zurich, `YYYY-MM-DD`. */
export type IsoDate = string;

/** Minutes since local midnight (Europe/Zurich). 390 = 06:30. */
export type Minutes = number;

export type CandidateKind = 'ski_resort' | 'ski_tour' | 'snowshoe_trail' | 'photo_spot';
export type Activity = 'ski' | 'ski_tour' | 'snowshoe' | 'photo';

export type Equipment =
  | 'alpine_ski'
  | 'touring_ski'
  | 'skins'
  | 'avalanche_kit'
  | 'snowshoes'
  | 'camera'
  | 'tripod';

export type RiskColor = 'green' | 'orange' | 'red';
export type RiskLevel = 1 | 2 | 3;
/** European avalanche danger level as published in the SLF bulletin. */
export type DangerLevel = 1 | 2 | 3 | 4 | 5;

export type DayKey = 'sat' | 'sun';
export type TimeBudget = 'full' | 'half' | 'free';
export type DayForm = 'easy' | 'normal' | 'strong';
export type MaxTravelHours = 1 | 2 | 3;

/** `day` = normal daytime outing, `evening` = after sunset (clear night, moon), `morning` = sunrise photo. */
export type Slot = 'day' | 'evening' | 'morning';

export interface GeoPoint {
  lat: number;
  lon: number;
  /** Metres above sea level. */
  elevation: number;
}

export interface StartPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface Profile {
  equipment: Equipment[];
  riskLevel: RiskLevel;
  fitness: {
    /** Maximum elevation gain on a normal day, metres. */
    maxElevationGain: number;
    /** Maximum moving time on a normal day, hours. */
    maxHours: number;
  };
  /** Earliest departure from the start point, minutes since midnight. May be before sunrise. */
  earliestStart: Minutes;
  startPoints: StartPoint[];
}

export interface Candidate {
  id: string;
  name: string;
  kind: CandidateKind;
  region?: string;
  /** Valley / trailhead / base station. Also the reference point for the fog sea heuristic. */
  valley: GeoPoint;
  /** Summit / top station / photo position. */
  summit: GeoPoint;
  /** Elevation gain in metres (tours and trails). */
  elevationGain?: number;
  /**
   * Time on site in hours, excluding travel. Tours: total incl. descent. Resorts: a full ski day.
   * Photo spots: minimum stay; the light window may make it longer.
   */
  durationHours: number;
  /** Photo spots: walking time from parking to the spot, one way, minutes. */
  approachMinutes?: number;
  /** Manual travel time per start point id, minutes (one way). */
  travelMinutes: Record<string, number>;
  /** Snowshoe trail is signposted (no avalanche rating needed). */
  signposted?: boolean;
  /** Tour or trail can also be done after sunset. */
  eveningPossible?: boolean;
  priceChf?: number;
  done: boolean;
  /** Inactive candidates (e.g. resort closed) are never suggested. */
  active: boolean;
  note?: string;
  link?: string;
  /** Photo spots explicitly assigned to this candidate (ids of `photo_spot` candidates). */
  photoSpotIds?: string[];
  /** Optional GPX track as XML text. */
  gpx?: string;
}

export interface RiskEntry {
  candidateId: string;
  color: RiskColor;
  dangerLevel?: DangerLevel;
  /** Date the entry was made; it is only valid on this date. */
  date: IsoDate;
  source: string;
}

export interface WeekendInput {
  budget: Record<DayKey, TimeBudget>;
  maxTravelHours: MaxTravelHours;
  startPointId: string;
  dayForm: DayForm;
  /** Answer to «Du bist in einer geschulten Gruppe?». Only relevant at risk level 3. */
  trainedGroupConfirmed: boolean;
}

export type Strictness = 'too_easy' | 'fitting' | 'too_hard';

export interface Feedback {
  /** Saturday of the weekend. */
  weekend: IsoDate;
  implemented: boolean;
  reasonIfNot?: string;
  fittingSuggestions: 0 | 1 | 2 | 3;
  strictness?: Strictness;
}

// ---------------------------------------------------------------------------
// Weather and astro input (normalised; produced by the data layer)

export interface HourWeather {
  /** Local hour 0–23. */
  hour: number;
  temperature: number;
  /** Total cloud cover, %. */
  cloudCover: number;
  cloudLow: number;
  cloudMid: number;
  cloudHigh: number;
  /** km/h */
  windSpeed: number;
  /** km/h */
  windGusts: number;
  /** Metres; undefined when the model does not provide it. */
  visibility?: number;
  /** Sunshine during this hour, minutes (0–60); undefined if not provided. */
  sunshineMinutes?: number;
  /** mm */
  precipitation: number;
  /** cm */
  snowfall: number;
}

export interface PointDayWeather {
  date: IsoDate;
  hours: HourWeather[];
  /** Snowfall in the 72 h before this day's 08:00, cm. */
  newSnow72h: number;
  /** Model that delivered the data, for display. */
  model: string;
}

export interface CandidateWeather {
  valley: Record<IsoDate, PointDayWeather>;
  summit: Record<IsoDate, PointDayWeather>;
}

export interface TimeWindow {
  start: Minutes;
  end: Minutes;
}

export interface AstroDay {
  sunrise: Minutes;
  sunset: Minutes;
  goldenMorning: TimeWindow;
  goldenEvening: TimeWindow;
  blueMorning: TimeWindow;
  blueEvening: TimeWindow;
  /** Illuminated fraction 0–1 around evening. */
  moonIllumination: number;
  moonrise?: Minutes;
  moonset?: Minutes;
}

export type AstroFn = (date: IsoDate, point: GeoPoint) => AstroDay;

// ---------------------------------------------------------------------------
// Engine output

export type SubScoreKey =
  | 'sun'
  | 'newSnow'
  | 'wind'
  | 'temperature'
  | 'precipitation'
  | 'visibility'
  | 'clearNight'
  | 'moon'
  | 'clouds'
  | 'lowCloud'
  | 'fogSea';

export type SubScores = Partial<Record<SubScoreKey, number>>;

export interface ConditionResult {
  score: number;
  sub: SubScores;
  /** Facts used for the reasoning texts. */
  facts: ConditionFacts;
  /** Hard knock-out from weather (e.g. storm). */
  knockout?: 'wind';
}

export interface ConditionFacts {
  newSnowCm?: number;
  maxGust?: number;
  meanTemp?: number;
  fogSea?: boolean;
  moonIllumination?: number;
  moonrise?: Minutes;
  lightLabel?: string;
  lightTime?: Minutes;
}

export interface ScheduleItem {
  time: Minutes;
  label: string;
}

export type RiskStatus =
  | { kind: 'not_required'; signposted: boolean }
  | { kind: 'unknown'; reason: 'missing' | 'stale' }
  | { kind: 'known'; entry: RiskEntry };

export interface RiskInfo {
  /** True for activities in avalanche terrain (tours, unsignposted trails). */
  applies: boolean;
  color?: RiskColor;
  dangerLevel?: DangerLevel;
  entryDate?: IsoDate;
  signposted: boolean;
  /** Main line, e.g. «Skitourenguru: grün · geringes Risiko laut Skitourenguru». */
  label: string;
  dangerLabel: string;
  bulletinHint: string;
  /** Extra warning for red tours. */
  groupNote?: string;
  /** «Stand Do 27.11. – am Vorabend neu prüfen». */
  freshnessNote: string;
}

export interface PhotoAddOn {
  spotId: string;
  spotName: string;
  lightLabel: string;
  time: Minutes;
}

export interface Option {
  candidate: Candidate;
  activity: Activity;
  day: DayKey;
  date: IsoDate;
  slot: Slot;
}

export type ExclusionReason =
  | 'inactive'
  | 'equipment_missing'
  | 'risk_unknown'
  | 'risk_stale'
  | 'risk_above_level'
  | 'risk_red_unconfirmed'
  | 'travel_too_long'
  | 'travel_unknown'
  | 'time_budget'
  | 'day_free'
  | 'start_too_early'
  | 'daylight'
  | 'fitness'
  | 'weather_missing'
  | 'weather_knockout'
  | 'conditions_poor';

export interface Suggestion {
  id: string;
  candidateId: string;
  candidateName: string;
  region?: string;
  activity: Activity;
  /** «Skitour», «Ski + Foto», ... */
  activityLabel: string;
  day: DayKey;
  date: IsoDate;
  slot: Slot;
  score: number;
  conditionScore: number;
  fitScore: number;
  sub: SubScores;
  reasons: string[];
  schedule: ScheduleItem[];
  travel: { minutes: number; estimated: boolean; startPointName: string };
  photo?: PhotoAddOn;
  priceChf?: number;
  risk: RiskInfo;
  isNew: boolean;
  /** Depends on the avalanche rating (tour or unsignposted trail). */
  avalancheDependent: boolean;
}

export interface PlanB extends Suggestion {
  /** «falls das Lawinenrisiko steigt» */
  planBReason: string;
}

export interface Exclusion {
  candidateId: string;
  day: DayKey;
  slot: Slot;
  reasons: ExclusionReason[];
}

export interface SuggestionResult {
  suggestions: Suggestion[];
  planB?: PlanB;
  excluded: Exclusion[];
}
