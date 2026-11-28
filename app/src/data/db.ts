// IndexedDB via Dexie. All data stays on the device.

import { Dexie, type Table } from 'dexie';
import type {
  Candidate,
  ExclusionReason,
  Feedback,
  IsoDate,
  PlanB,
  PointDayWeather,
  RiskEntry,
  StartPoint,
  Suggestion,
  WeekendInput,
} from '../engine/types';
import type { RadarHit } from '../engine/radar';
import type { ImageCacheRow } from './placeImages';
import type { TrackCacheRow } from './tracks';

export interface StoredRiskEntry extends RiskEntry {
  /** `${candidateId}|${date}` — one entry per tour and day; a new tap replaces it. */
  key: string;
  enteredAt: string;
}

export interface SettingsRow<T = unknown> {
  key: string;
  value: T;
}

export interface EveningCheckRecord {
  checkedAt: string;
  date: IsoDate;
  status: 'holds' | 'switch';
  reason?: string;
  alternativeId?: string;
}

/** Suggestions of one weekend, the chosen plan and the evening checks. */
export interface WeekendPlan {
  /** Saturday of the weekend (or Sunday if computed on a Sunday). */
  weekend: IsoDate;
  createdAt: string;
  /** Day the suggestions were computed (risk entries valid on this day). */
  computedOn: IsoDate;
  input: WeekendInput;
  suggestions: Suggestion[];
  planB?: PlanB;
  chosenId?: string;
  /** Snapshot of the chosen suggestion: it stays even if a later recomputation no longer lists it. */
  chosen?: Suggestion | PlanB;
  checks: EveningCheckRecord[];
  /** Number of candidates not suggested at all, per reason (a candidate may count for several). */
  excludedSummary?: Partial<Record<ExclusionReason, number>>;
  weather?: { fetchedAt?: string; fromStaleCache: boolean; error?: string };
  /** Favourite places with very good conditions in the coming days. */
  radar?: RadarHit[];
  /** Packing list items ticked off, per suggestion id. */
  packed?: Record<string, string[]>;
  /** Tours that only lack today's Skitourenguru colour (would fit otherwise). */
  awaitingColour?: string[];
  /** Ad-hoc start point (current location) the plan was computed from. */
  startPoint?: StartPoint;
}

/** The user's markings for a catalogue entry. */
export interface CatalogStateRow {
  id: string;
  favorite?: boolean;
  done?: boolean;
  /** Never suggest this catalogue entry. */
  hidden?: boolean;
}

export interface WeatherCacheRow {
  /** Point key, see `pointKey`. */
  key: string;
  fetchedAt: string;
  days: Record<IsoDate, PointDayWeather>;
}

export class PlannerDB extends Dexie {
  settings!: Table<SettingsRow, string>;
  candidates!: Table<Candidate, string>;
  riskEntries!: Table<StoredRiskEntry, string>;
  feedback!: Table<Feedback, string>;
  weekendPlans!: Table<WeekendPlan, string>;
  weatherCache!: Table<WeatherCacheRow, string>;
  catalogState!: Table<CatalogStateRow, string>;
  imageCache!: Table<ImageCacheRow, string>;
  trackCache!: Table<TrackCacheRow, string>;

  constructor(name = 'wochenend-planer') {
    super(name);
    this.version(1).stores({
      settings: 'key',
      candidates: 'id, kind, done, active',
      riskEntries: 'key, candidateId, date',
      feedback: 'weekend',
      weekendPlans: 'weekend',
      weatherCache: 'key, fetchedAt',
    });
    this.version(2).stores({ catalogState: 'id' });
    this.version(3).stores({ imageCache: 'id', trackCache: 'id' });
  }
}

let instance: PlannerDB | undefined;

/** The app's database (created lazily). */
export function getDb(): PlannerDB {
  instance ??= new PlannerDB();
  return instance;
}
