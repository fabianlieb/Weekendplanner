// JSON export/import (backup, since data lives only on the device).
// Accepted inputs:
//  1. a full backup `{ format: "wochenend-planer", version: 1, ... }`
//  2. a candidate list: `[ {candidate}, ... ]` or `{ candidates: [ ... ] }`
// Messages are in German because they are shown in the app.

import { ACTIVITIES, normalizeProfile } from '../engine/profile';
import { MANUAL_SOURCE } from '../engine/risk';
import type {
  Activity,
  Candidate,
  CandidateKind,
  DangerLevel,
  Equipment,
  Feedback,
  GeoPoint,
  Profile,
  RiskColor,
  StartPoint,
  Strictness,
  SuggestionRating,
} from '../engine/types';
import type { PlannerDB, StoredRiskEntry, WeekendPlan } from './db';
import { newId, riskKey } from './repositories';

export const BACKUP_FORMAT = 'wochenend-planer';
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  profile?: Profile;
  candidates: Candidate[];
  riskEntries: StoredRiskEntry[];
  feedback: Feedback[];
  weekendPlans: WeekendPlan[];
}

export async function exportData(db: PlannerDB, now: Date = new Date()): Promise<Backup> {
  const profileRow = await db.settings.get('profile');
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    ...(profileRow ? { profile: profileRow.value as Profile } : {}),
    candidates: await db.candidates.toArray(),
    riskEntries: await db.riskEntries.toArray(),
    feedback: await db.feedback.toArray(),
    weekendPlans: await db.weekendPlans.toArray(),
  };
}

export function backupFileName(now: Date = new Date()): string {
  return `wochenend-planer-${now.toISOString().slice(0, 10)}.json`;
}

// ---------------------------------------------------------------------------
// Validation

const KINDS: CandidateKind[] = ['ski_resort', 'ski_tour', 'snowshoe_trail', 'photo_spot'];
const EQUIPMENT: Equipment[] = ['alpine_ski', 'touring_ski', 'skins', 'avalanche_kit', 'snowshoes', 'camera', 'tripod'];
const COLORS: RiskColor[] = ['green', 'orange', 'red'];
const STRICTNESS: Strictness[] = ['too_easy', 'fitting', 'too_hard'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown, min = -Infinity, max = Infinity): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const isStr = (v: unknown): v is string => typeof v === 'string';
const isDate = (v: unknown): v is string => isStr(v) && DATE_RE.test(v);

export class Errors {
  list: string[] = [];
  add(path: string, msg: string) {
    this.list.push(`${path}: ${msg}`);
  }
}

function point(v: unknown, path: string, e: Errors): GeoPoint | undefined {
  if (!isObj(v)) return void e.add(path, 'Koordinaten fehlen');
  if (!isNum(v.lat, -90, 90)) e.add(`${path}.lat`, 'Breitengrad ungültig');
  if (!isNum(v.lon, -180, 180)) e.add(`${path}.lon`, 'Längengrad ungültig');
  if (!isNum(v.elevation, -500, 9000)) e.add(`${path}.elevation`, 'Höhe ungültig (Meter über Meer)');
  return isNum(v.lat) && isNum(v.lon) && isNum(v.elevation) ? { lat: v.lat, lon: v.lon, elevation: v.elevation } : undefined;
}

function optional<T>(o: Obj, key: string, check: (v: unknown) => v is T, path: string, e: Errors, msg: string): T | undefined {
  if (o[key] === undefined || o[key] === null) return undefined;
  if (!check(o[key])) {
    e.add(`${path}.${key}`, msg);
    return undefined;
  }
  return o[key] as T;
}

const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isNonNeg = (v: unknown): v is number => isNum(v, 0);
const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

export function validateCandidate(v: unknown, path: string, e: Errors = new Errors()): Candidate | undefined {
  const before = e.list.length;
  if (!isObj(v)) return void e.add(path, 'kein Objekt');
  const name = isStr(v.name) && v.name.trim() ? v.name.trim() : undefined;
  if (!name) e.add(`${path}.name`, 'Name fehlt');
  const kind = KINDS.includes(v.kind as CandidateKind) ? (v.kind as CandidateKind) : undefined;
  if (!kind) e.add(`${path}.kind`, `Typ muss einer von ${KINDS.join(', ')} sein`);
  const valley = point(v.valley, `${path}.valley`, e);
  const summit = point(v.summit, `${path}.summit`, e);
  if (!isNum(v.durationHours, 0.1, 24)) e.add(`${path}.durationHours`, 'Dauer in Stunden (0.1–24) fehlt');

  const travel: Record<string, number> = {};
  if (v.travelMinutes !== undefined) {
    if (!isObj(v.travelMinutes)) e.add(`${path}.travelMinutes`, 'muss ein Objekt { Startpunkt-ID: Minuten } sein');
    else
      for (const [k, m] of Object.entries(v.travelMinutes)) {
        if (isNum(m, 0, 1440)) travel[k] = m;
        else e.add(`${path}.travelMinutes.${k}`, 'Minuten ungültig');
      }
  }

  const elevationGain = optional(v, 'elevationGain', isNonNeg, path, e, 'Höhenmeter ungültig');
  const approachMinutes = optional(v, 'approachMinutes', isNonNeg, path, e, 'Zustiegszeit ungültig');
  const signposted = optional(v, 'signposted', isBool, path, e, 'muss true/false sein');
  const eveningPossible = optional(v, 'eveningPossible', isBool, path, e, 'muss true/false sein');
  const priceChf = optional(v, 'priceChf', isNonNeg, path, e, 'Preis ungültig');
  const done = optional(v, 'done', isBool, path, e, 'muss true/false sein');
  const favorite = optional(v, 'favorite', isBool, path, e, 'muss true/false sein');
  const active = optional(v, 'active', isBool, path, e, 'muss true/false sein');
  const region = optional(v, 'region', isStr, path, e, 'muss Text sein');
  const difficulty = optional(v, 'difficulty', isStr, path, e, 'muss Text sein (SAC-Grad, z. B. WS+ oder WT3)');
  const note = optional(v, 'note', isStr, path, e, 'muss Text sein');
  const link = optional(v, 'link', isStr, path, e, 'muss Text sein');
  const gpx = optional(v, 'gpx', isStr, path, e, 'muss Text sein');
  const photoSpotIds = optional(v, 'photoSpotIds', isStrArray, path, e, 'muss eine Liste von IDs sein');
  const packing = optional(v, 'packing', isStrArray, path, e, 'muss eine Liste von Texten sein');
  const track =
    isObj(v.track) && isStr(v.track.layer) && isStr(v.track.featureId) ? { layer: v.track.layer, featureId: v.track.featureId } : undefined;
  const steep =
    Array.isArray(v.steep) && v.steep.length === 3 && v.steep.every((x) => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 5)
      ? (v.steep as [number, number, number])
      : undefined;
  let parking: { lat: number; lon: number } | undefined;
  if (v.parking !== undefined && v.parking !== null) {
    if (isObj(v.parking) && isNum(v.parking.lat, -90, 90) && isNum(v.parking.lon, -180, 180)) parking = { lat: v.parking.lat, lon: v.parking.lon };
    else e.add(`${path}.parking`, 'Parkplatz braucht lat und lon');
  }
  if ((kind === 'ski_tour' || kind === 'snowshoe_trail') && elevationGain === undefined) e.add(`${path}.elevationGain`, 'Höhenmeter fehlen');
  if (link && !/^https?:\/\//.test(link)) e.add(`${path}.link`, 'Link muss mit http:// oder https:// beginnen');

  if (e.list.length > before || !name || !kind || !valley || !summit) return undefined;
  return {
    id: isStr(v.id) && v.id ? v.id : newId(),
    name,
    kind,
    valley,
    summit,
    durationHours: v.durationHours as number,
    travelMinutes: travel,
    done: done ?? false,
    active: active ?? true,
    ...(region !== undefined ? { region } : {}),
    ...(difficulty !== undefined ? { difficulty } : {}),
    ...(elevationGain !== undefined ? { elevationGain } : {}),
    ...(approachMinutes !== undefined ? { approachMinutes } : {}),
    ...(signposted !== undefined ? { signposted } : {}),
    ...(eveningPossible !== undefined ? { eveningPossible } : {}),
    ...(priceChf !== undefined ? { priceChf } : {}),
    ...(note !== undefined ? { note } : {}),
    ...(link !== undefined ? { link } : {}),
    ...(gpx !== undefined ? { gpx } : {}),
    ...(photoSpotIds !== undefined ? { photoSpotIds } : {}),
    ...(parking ? { parking } : {}),
    ...(track ? { track } : {}),
    ...(steep ? { steep } : {}),
    ...(packing?.length ? { packing } : {}),
    ...(favorite ? { favorite } : {}),
  };
}

function validateProfile(v: unknown, e: Errors): Profile | undefined {
  const before = e.list.length;
  if (!isObj(v)) return void e.add('profile', 'kein Objekt');
  const equipment = Array.isArray(v.equipment) ? v.equipment.filter((x): x is Equipment => EQUIPMENT.includes(x as Equipment)) : [];
  if (Array.isArray(v.equipment) && equipment.length !== v.equipment.length) e.add('profile.equipment', `unbekanntes Material (erlaubt: ${EQUIPMENT.join(', ')})`);
  if (v.activities !== undefined) {
    if (!isObj(v.activities)) e.add('profile.activities', 'muss ein Objekt pro Sportart sein');
    else
      for (const [a, s] of Object.entries(v.activities)) {
        if (!ACTIVITIES.includes(a as Activity)) e.add(`profile.activities.${a}`, `unbekannte Sportart (erlaubt: ${ACTIVITIES.join(', ')})`);
        else if (!isObj(s) || !isBool(s.enabled) || ![1, 2, 3].includes(s.level as number)) e.add(`profile.activities.${a}`, 'braucht enabled (true/false) und level (1–3)');
      }
  } else if (![1, 2, 3].includes(v.riskLevel as number)) e.add('profile.riskLevel', 'Risikostufe muss 1, 2 oder 3 sein');
  const f = isObj(v.fitness) ? v.fitness : {};
  if (!isNum(f.maxElevationGain, 0, 5000)) e.add('profile.fitness.maxElevationGain', 'Höhenmeter ungültig');
  if (!isNum(f.maxHours, 0.5, 24)) e.add('profile.fitness.maxHours', 'Stunden ungültig');
  if (!isNum(v.earliestStart, 0, 1439)) e.add('profile.earliestStart', 'Startzeit in Minuten nach Mitternacht (0–1439)');
  const startPoints: StartPoint[] = [];
  if (!Array.isArray(v.startPoints)) e.add('profile.startPoints', 'Liste fehlt');
  else
    v.startPoints.forEach((s, i) => {
      if (isObj(s) && isStr(s.id) && isStr(s.name) && isNum(s.lat, -90, 90) && isNum(s.lon, -180, 180))
        startPoints.push({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, ...(s.mode === 'car' || s.mode === 'transit' ? { mode: s.mode } : {}) });
      else e.add(`profile.startPoints[${i}]`, 'braucht id, name, lat, lon');
    });
  if (e.list.length > before) return undefined;
  return normalizeProfile({
    equipment,
    ...(isObj(v.activities) ? { activities: v.activities as unknown as Profile['activities'] } : { riskLevel: v.riskLevel }),
    ...(isObj(v.maxDifficulty) ? { maxDifficulty: v.maxDifficulty as unknown as Profile['maxDifficulty'] } : {}),
    fitness: { maxElevationGain: f.maxElevationGain as number, maxHours: f.maxHours as number },
    earliestStart: v.earliestStart as number,
    startPoints,
  });
}

function validateRisk(v: unknown, path: string, e: Errors): StoredRiskEntry | undefined {
  if (!isObj(v) || !isStr(v.candidateId) || !isDate(v.date) || !COLORS.includes(v.color as RiskColor)) {
    e.add(path, 'Risikoeintrag braucht candidateId, date (JJJJ-MM-TT) und color (green/orange/red)');
    return undefined;
  }
  const dl = v.dangerLevel;
  if (dl !== undefined && ![1, 2, 3, 4, 5].includes(dl as number)) {
    e.add(`${path}.dangerLevel`, 'Gefahrenstufe muss 1–5 sein');
    return undefined;
  }
  return {
    key: riskKey(v.candidateId, v.date),
    candidateId: v.candidateId,
    color: v.color as RiskColor,
    ...(dl !== undefined ? { dangerLevel: dl as DangerLevel } : {}),
    date: v.date,
    source: isStr(v.source) ? v.source : MANUAL_SOURCE,
    enteredAt: isStr(v.enteredAt) ? v.enteredAt : new Date(0).toISOString(),
  };
}

function validateFeedback(v: unknown, path: string, e: Errors): Feedback | undefined {
  if (!isObj(v) || !isDate(v.weekend) || !isBool(v.implemented) || ![0, 1, 2, 3].includes(v.fittingSuggestions as number)) {
    e.add(path, 'Feedback braucht weekend, implemented und fittingSuggestions (0–3)');
    return undefined;
  }
  if (v.strictness !== undefined && !STRICTNESS.includes(v.strictness as Strictness)) {
    e.add(`${path}.strictness`, 'muss too_easy, fitting oder too_hard sein');
    return undefined;
  }
  const ratings = Array.isArray(v.ratings)
    ? v.ratings.filter(
        (r): r is SuggestionRating =>
          isObj(r) && isStr(r.suggestionId) && isStr(r.candidateId) && ACTIVITIES.includes(r.activity as Activity) && isBool(r.fits),
      )
    : undefined;
  return {
    weekend: v.weekend,
    implemented: v.implemented,
    fittingSuggestions: v.fittingSuggestions as Feedback['fittingSuggestions'],
    ...(ratings?.length ? { ratings } : {}),
    ...(isStr(v.reasonIfNot) ? { reasonIfNot: v.reasonIfNot } : {}),
    ...(v.strictness !== undefined ? { strictness: v.strictness as Strictness } : {}),
  };
}

function validatePlan(v: unknown, path: string, e: Errors): WeekendPlan | undefined {
  if (!isObj(v) || !isDate(v.weekend) || !isDate(v.computedOn) || !Array.isArray(v.suggestions) || !isObj(v.input)) {
    e.add(path, 'Wochenendplan unvollständig');
    return undefined;
  }
  return { ...(v as unknown as WeekendPlan), checks: Array.isArray(v.checks) ? (v.checks as WeekendPlan['checks']) : [] };
}

export interface ParsedImport {
  kind: 'backup' | 'candidates';
  profile?: Profile;
  candidates: Candidate[];
  riskEntries: StoredRiskEntry[];
  feedback: Feedback[];
  weekendPlans: WeekendPlan[];
}

export type ValidationResult = { ok: true; data: ParsedImport; warnings: string[] } | { ok: false; errors: string[] };

export function validateImport(json: unknown): ValidationResult {
  const e = new Errors();
  const warnings: string[] = [];

  const candidateList = Array.isArray(json) ? json : isObj(json) && json.format === undefined && Array.isArray(json.candidates) ? json.candidates : undefined;
  if (candidateList) {
    const candidates = candidateList.map((c, i) => validateCandidate(c, `[${i}]`, e)).filter((c): c is Candidate => !!c);
    checkDuplicates(candidates, e);
    return e.list.length ? { ok: false, errors: e.list } : { ok: true, data: { kind: 'candidates', candidates, riskEntries: [], feedback: [], weekendPlans: [] }, warnings };
  }

  if (!isObj(json) || json.format !== BACKUP_FORMAT) return { ok: false, errors: ['Unbekanntes Dateiformat: weder Backup noch Kandidatenliste.'] };
  if (json.version !== BACKUP_VERSION) return { ok: false, errors: [`Backup-Version ${String(json.version)} wird nicht unterstützt (erwartet ${BACKUP_VERSION}).`] };

  const profile = json.profile !== undefined ? validateProfile(json.profile, e) : undefined;
  const arr = (k: string) => (Array.isArray(json[k]) ? (json[k] as unknown[]) : []);
  const candidates = arr('candidates').map((c, i) => validateCandidate(c, `candidates[${i}]`, e)).filter((c): c is Candidate => !!c);
  checkDuplicates(candidates, e);
  const riskEntries = arr('riskEntries').map((r, i) => validateRisk(r, `riskEntries[${i}]`, e)).filter((r): r is StoredRiskEntry => !!r);
  const feedback = arr('feedback').map((f, i) => validateFeedback(f, `feedback[${i}]`, e)).filter((f): f is Feedback => !!f);
  // Old plans are only history: drop broken ones with a warning instead of failing.
  const planErrors = new Errors();
  const weekendPlans = arr('weekendPlans').map((p, i) => validatePlan(p, `weekendPlans[${i}]`, planErrors)).filter((p): p is WeekendPlan => !!p);
  warnings.push(...planErrors.list);

  const ids = new Set(candidates.map((c) => c.id));
  const orphans = riskEntries.filter((r) => !ids.has(r.candidateId));
  if (orphans.length) warnings.push(`${orphans.length} Risikoeinträge ohne passenden Kandidaten werden übersprungen.`);

  if (e.list.length) return { ok: false, errors: e.list };
  return {
    ok: true,
    data: { kind: 'backup', ...(profile ? { profile } : {}), candidates, riskEntries: riskEntries.filter((r) => ids.has(r.candidateId)), feedback, weekendPlans },
    warnings,
  };
}

function checkDuplicates(candidates: Candidate[], e: Errors) {
  const seen = new Set<string>();
  for (const c of candidates) {
    if (seen.has(c.id)) e.add(`id ${c.id}`, 'kommt mehrfach vor');
    seen.add(c.id);
  }
}

export type ImportMode = 'replace' | 'merge';

/**
 * Writes validated data. `replace` clears profile, candidates, risk entries, feedback and plans first
 * (weather cache is kept). A candidate list is always merged.
 */
export async function applyImport(db: PlannerDB, data: ParsedImport, mode: ImportMode): Promise<void> {
  await db.transaction('rw', [db.settings, db.candidates, db.riskEntries, db.feedback, db.weekendPlans], async () => {
    if (mode === 'replace' && data.kind === 'backup') {
      await Promise.all([db.candidates.clear(), db.riskEntries.clear(), db.feedback.clear(), db.weekendPlans.clear(), db.settings.delete('profile')]);
    }
    if (data.profile) await db.settings.put({ key: 'profile', value: data.profile });
    await db.candidates.bulkPut(data.candidates);
    await db.riskEntries.bulkPut(data.riskEntries);
    await db.feedback.bulkPut(data.feedback);
    await db.weekendPlans.bulkPut(data.weekendPlans);
  });
}

export async function importJson(db: PlannerDB, text: string, mode: ImportMode): Promise<ValidationResult> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['Die Datei ist kein gültiges JSON.'] };
  }
  const result = validateImport(json);
  if (result.ok) await applyImport(db, result.data, mode);
  return result;
}
