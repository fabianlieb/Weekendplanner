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
  /** Tours that only lack today's Skitourenguru colour (would fit otherwise). */
  awaitingColour?: string[];
  /** Ad-hoc start point (current location) the plan was computed from. */
  startPoint?: StartPoint;
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
  }
}

let instance: PlannerDB | undefined;

/** The app's database (created lazily). */
export function getDb(): PlannerDB {
  instance ??= new PlannerDB();
  return instance;
}
