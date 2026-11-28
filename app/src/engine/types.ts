// Domain model of the weekend planner. The engine only depends on these types,
// never on a data source (Open-Meteo, IndexedDB, ...), so it stays testable without a browser.

import type { SnowObservation } from './snow';

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

export type TravelMode = 'car' | 'transit';
/** Where a travel time comes from. */
export type TravelSource = 'manual' | 'routed' | 'estimate';

export interface StartPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Usual way of travelling from here (default: car). */
  mode?: TravelMode;
}

export interface StationRef {
  id: string;
  name: string;
}

/** Public transport legs behind a routed travel time. */
export interface TransitInfo {
  from: StationRef;
  to: StationRef;
  /** Walk from the start point to the first stop, minutes. */
  walkToMinutes: number;
  /** Walk from the last stop to the start of the activity, minutes. */
  walkFromMinutes: number;
}

/** Travel time from a routing service for one start point and mode (attached by the planner, not stored). */
export interface RoutedTravel {
  startKey: string;
  mode: TravelMode;
  minutes: number;
  transit?: TransitInfo;
}

export interface ActivitySetting {
  /** The person does this sport; disabled activities are never suggested. */
  enabled: boolean;
  /**
   * Self-assessed level 1–3. For ski tours and snowshoe tours it is the upper limit of the
   * Skitourenguru colours: 1 → green, 2 → + orange, 3 → + red (red only with trained-group confirmation).
   */
  level: RiskLevel;
}

export type SkiTourGrade = 'L' | 'WS' | 'ZS' | 'S';
export type SnowshoeGrade = 'leicht' | 'mittel' | 'schwer';

export interface Profile {
  equipment: Equipment[];
  activities: Record<Activity, ActivitySetting>;
  /** Hardest technical difficulty to suggest (catalogue routes carry a difficulty). */
  maxDifficulty: { ski_tour: SkiTourGrade; snowshoe: SnowshoeGrade };
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
  /** Where the entry comes from; undefined = own list. E.g. «swisstopo/SAC», «ASTRA/SchweizMobil». */
  source?: string;
  /** Technical difficulty: SAC scale for tours (L, WS, ZS …, WT1–WT6) or trail colour (blau, rot, schwarz). */
  difficulty?: string;
  /** On the «Merkliste»: shown in the spot radar when conditions are very good. */
  favorite?: boolean;
  /** Extra items for the packing list of this place (e.g. «Steigeisen», «Bargeld für Parkplatz»). */
  packing?: string[];
  /** Parking for navigation (optional). Without it, navigation goes to the start / photo position. */
  parking?: { lat: number; lon: number };
  /** Photo spots: walking time from parking to the spot, one way, minutes. */
  approachMinutes?: number;
  /** Manual travel time per start point id, minutes (one way, by car). */
  travelMinutes: Record<string, number>;
  /** Routed travel time for the current start point (set by the planner, never stored). */
  routedTravel?: RoutedTravel;
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
  /** Catalogue route line, loaded on demand (geo.admin.ch layer + feature id). */
  track?: { layer: string; featureId: string };
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
  /** Car or public transport for this weekend (default: the start point's mode). */
  travelMode?: TravelMode;
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
  /** Rating per suggestion of that weekend (fits / does not fit). */
  ratings?: SuggestionRating[];
}

export interface SuggestionRating {
  suggestionId: string;
  candidateId: string;
  activity: Activity;
  fits: boolean;
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
  | 'activity_disabled'
  | 'too_difficult'
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
  | 'conditions_poor'
  | 'snow_low';

export interface WeatherHourRow {
  hour: number;
  temperature: number;
  windGusts: number;
  cloudCover: number;
  /** Minutes of sunshine in this hour, if the model provides it. */
  sunshineMinutes?: number;
  precipitation: number;
}

/** Weather at the summit/spot during the activity, for display. */
export interface WeatherSummary {
  /** Mean temperature in the window, °C. */
  temperature: number;
  maxGust: number;
  /** Mean total cloud cover, %. */
  cloudCover: number;
  /** Sunshine in the window, hours (undefined without model data). */
  sunshineHours?: number;
  newSnowCm: number;
  precipitationMm: number;
  fogSeaLikely: boolean;
  /** Moon illumination 0–1 for evening outings. */
  moonIllumination?: number;
  model: string;
  hours: WeatherHourRow[];
}

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
  travel: { minutes: number; estimated: boolean; startPointName: string; mode?: TravelMode; source?: TravelSource; transit?: TransitInfo };
  /** Measured snow near the place (SLF IMIS), if a station is in reach. */
  snow?: SnowObservation;
  photo?: PhotoAddOn;
  priceChf?: number;
  risk: RiskInfo;
  /** Optional: plans stored before this field existed have none. */
  weather?: WeatherSummary;
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
  /** Score the option would have if only the risk colour were missing (to rank tours awaiting a colour). */
  potential?: number;
}

export interface SuggestionResult {
  suggestions: Suggestion[];
  planB?: PlanB;
  excluded: Exclusion[];
}
