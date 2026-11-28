// Avalanche risk handling: Skitourenguru colours entered by the user, plus the official SLF
// danger level of the place's warning region (loaded automatically, shown with every tour).

import {
  BULLETIN_HINT,
  NOT_AVALANCHE_LABEL,
  RISK_GROUP_NOTE,
  RISK_UNKNOWN,
  SIGNPOSTED_LABEL,
  dangerLabel,
  freshnessNote,
  riskLabel,
  slfDangerLabel,
} from './texts';
import type { Candidate, IsoDate, RiskColor, RiskEntry, RiskInfo, RiskLevel, RiskStatus } from './types';
import { validForDate, type SlfDanger } from './slf';

/** Source of avalanche risk colours. MVP: manual entry. Later: an automatic provider. */
export interface AvalancheRiskProvider {
  /** Shown next to the colour, e.g. «Skitourenguru (manuell)». */
  readonly source: string;
  /** Latest entries for the given candidates. Entries of any date may be returned; freshness is checked by the engine. */
  getEntries(candidateIds: readonly string[]): Promise<RiskEntry[]>;
}

export const MANUAL_SOURCE = 'Skitourenguru (manuell)';

/** Tours and unsignposted snowshoe trails are in avalanche terrain and need a rating. */
export function needsAvalancheRating(c: Candidate): boolean {
  return c.kind === 'ski_tour' || (c.kind === 'snowshoe_trail' && !c.signposted);
}

/** Shows avalanche info at all (tours and every snowshoe trail). */
export function showsAvalancheInfo(c: Candidate): boolean {
  return c.kind === 'ski_tour' || c.kind === 'snowshoe_trail';
}

/** Latest entry for a candidate (by date; later entries in the list win on the same date). */
export function latestEntry(candidateId: string, entries: readonly RiskEntry[]): RiskEntry | undefined {
  let best: RiskEntry | undefined;
  for (const e of entries) {
    if (e.candidateId !== candidateId) continue;
    if (!best || e.date >= best.date) best = e;
  }
  return best;
}

/**
 * Fail closed: an entry is only valid on the day it was made (`today`).
 * Missing or older entries mean «unknown». Entries dated in the future are invalid too.
 */
export function resolveRisk(c: Candidate, entries: readonly RiskEntry[], today: IsoDate): RiskStatus {
  const entry = latestEntry(c.id, entries);
  if (!needsAvalancheRating(c)) {
    // A fresh entry for a signposted trail is still honoured (stricter, never looser).
    if (entry && entry.date === today && c.kind === 'snowshoe_trail') return { kind: 'known', entry };
    return { kind: 'not_required', signposted: c.kind === 'snowshoe_trail' && c.signposted === true };
  }
  if (!entry) return { kind: 'unknown', reason: 'missing' };
  if (entry.date !== today) return { kind: 'unknown', reason: 'stale' };
  if (!isValidColor(entry.color)) return { kind: 'unknown', reason: 'missing' };
  return { kind: 'known', entry };
}

function isValidColor(c: unknown): c is RiskColor {
  return c === 'green' || c === 'orange' || c === 'red';
}

/** Colours allowed by the profile's risk level: 1 → green, 2 → + orange, 3 → + red. */
export function allowedColors(level: RiskLevel): RiskColor[] {
  if (level >= 3) return ['green', 'orange', 'red'];
  if (level === 2) return ['green', 'orange'];
  return ['green'];
}

export type RiskDecision = 'allowed' | 'unknown' | 'above_level' | 'red_unconfirmed';

export function riskDecision(status: RiskStatus, level: RiskLevel, trainedGroupConfirmed: boolean): RiskDecision {
  if (status.kind === 'not_required') return 'allowed';
  if (status.kind === 'unknown') return 'unknown';
  const color = status.entry.color;
  if (!allowedColors(level).includes(color)) return 'above_level';
  if (color === 'red' && !trainedGroupConfirmed) return 'red_unconfirmed';
  return 'allowed';
}

export function buildRiskInfo(c: Candidate, status: RiskStatus, planDate: IsoDate, slf?: SlfDanger): RiskInfo {
  const applies = showsAvalancheInfo(c);
  const signposted = c.kind === 'snowshoe_trail' && c.signposted === true;
  if (!applies) {
    return { applies, signposted, label: NOT_AVALANCHE_LABEL, dangerLabel: '', bulletinHint: '', freshnessNote: '' };
  }
  const info = buildRiskInfoBase(status, planDate, applies, signposted);
  if (!slf) return info;
  // The official level is shown automatically; a level entered by hand stays as additional info.
  const validForPlan = validForDate(slf, planDate);
  return {
    ...info,
    dangerLabel: slfDangerLabel(slf.level, slf.subdivision, slf.regionName, validForPlan),
    slf: { level: slf.level, ...(slf.subdivision ? { subdivision: slf.subdivision } : {}), regionName: slf.regionName, validTo: slf.validTo, validForPlan },
  };
}

function buildRiskInfoBase(status: RiskStatus, planDate: IsoDate, applies: boolean, signposted: boolean): RiskInfo {
  if (status.kind === 'known') {
    const { color, dangerLevel, date } = status.entry;
    return {
      applies,
      signposted,
      color,
      ...(dangerLevel ? { dangerLevel } : {}),
      entryDate: date,
      label: riskLabel(color),
      dangerLabel: dangerLabel(dangerLevel),
      bulletinHint: BULLETIN_HINT,
      ...(color === 'red' ? { groupNote: RISK_GROUP_NOTE } : {}),
      freshnessNote: freshnessNote(date, planDate),
    };
  }
  return {
    applies,
    signposted,
    label: status.kind === 'not_required' && signposted ? SIGNPOSTED_LABEL : RISK_UNKNOWN,
    dangerLabel: dangerLabel(undefined),
    bulletinHint: BULLETIN_HINT,
    freshnessNote: '',
  };
}
