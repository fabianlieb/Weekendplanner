// Own avalanche risk calculation with the «Grafische Reduktionsmethode» (GRM) of the Swiss
// avalanche training core team (KAT / SLF, leaflet «Achtung Lawinen»): danger level from the SLF
// bulletin × steepest spot (about 20 m × 20 m) in the relevant slope area → green / orange / red.
//
// Steepness:
// - Track area (gering, mässig): from the SAC grade, which the SAC defines by the steepest passage
//   (ski: L up to 30°, WS from 30°, ZS from 35°, S from 40°, SS from 45° …; snowshoe WT1–WT6), taking
//   the upper end of the grade's range.
// - Whole slope (erheblich) and incl. runout (gross): the track value + 5° (the whole slope is usually
//   steeper than the track). A terrain measurement along the route lines proved unreliable in alpine
//   terrain (rock in the 10 m slope model), so it is only used for routes without a SAC grade.
// Cautious settings: no reduction for favourable aspects or elevations, no colour without bulletin or
// steepness. A planning aid, not a replacement for the assessment on site.

import { THRESHOLDS } from './thresholds';
import type { Candidate, DangerLevel, IsoDate, RiskColor, RiskEntry } from './types';
import type { SlfDanger, Subdivision } from './slf';

/** Slope classes of the swisstopo layer «Hangneigung über 30°». */
export const SLOPE_CLASS_LABEL = ['unter 30°', '30–35°', '35–40°', '40–45°', '45–50°', 'über 50°'] as const;
/** Relevant slope area (GRM): gering/mässig, erheblich, gross. */
export const GRM_AREA = ['im Bereich der Spur', 'im ganzen Hang', 'im ganzen Hang inkl. Auslauf'] as const;

export const GRM_SOURCE = 'GRM (berechnet)';

/** Danger level with subdivision as a number on the GRM axis, e.g. 2+ → 2.83. */
export function levelValue(level: DangerLevel, subdivision?: Subdivision): number {
  const o = THRESHOLDS.grm.subdivisionOffset;
  return level + (subdivision === 'minus' ? o.minus : subdivision === 'plus' ? o.plus : o.neutral);
}

/**
 * Steepest passage from the SAC grade, upper end of the grade's range (cautious):
 * ski grades span 5° (L 25–30°, WS 30–35° …), «−» / «» / «+» end after a third, two thirds, all of it.
 * Snowshoe: WT1/WT2 under 25°, WT3 under 30°, WT4 up to 30°, WT5 under 35°, WT6 over 35°.
 */
export function gradeDegrees(difficulty: string | undefined): number | undefined {
  if (!difficulty) return undefined;
  const d = difficulty.trim().toUpperCase();
  const ski = d.match(/^(L|WS|ZS|S|SS|AS|EX)([+-]?)$/);
  if (ski) {
    const lo = { L: 25, WS: 30, ZS: 35, S: 40, SS: 45, AS: 50, EX: 55 }[ski[1] as 'L'];
    return Math.round((lo + (ski[2] === '-' ? 5 / 3 : ski[2] === '+' ? 5 : 10 / 3)) * 10) / 10;
  }
  const wt = d.match(/^WT([1-6])([+-]?)$/);
  if (wt) {
    const base = { 1: 25, 2: 25, 3: 30, 4: 31.7, 5: 35, 6: 40 }[Number(wt[1]) as 1];
    const step = wt[1] === '1' || wt[1] === '2' ? 0 : 5 / 3;
    return Math.round((base + (wt[2] === '-' ? -step : wt[2] === '+' ? step : 0)) * 10) / 10;
  }
  return undefined;
}

export interface GrmResult {
  color: RiskColor;
  /** Danger level on the chart axis (e.g. 2+ → 2.83). */
  levelX: number;
  /** Area used: 0 Spur, 1 Hang, 2 inkl. Auslauf. */
  area: 0 | 1 | 2;
  /** Slope in degrees used for the chart. */
  slopeDeg: number;
  /** «SAC-Grad ZS (bis 38°)» or «35–40° (Karte Hangneigung)». */
  slopeText: string;
}

/**
 * GRM chart: green below the green line, red from the red line on, orange between.
 * Green line: 40° at the start of «gering», 5° lower per level. Red line: 45° at level 1.87,
 * about 5.6° lower per level (read from the official chart). From level 5 always red.
 * Undefined if the steepness needed for this level is missing (fail closed).
 */
export function grmColour(
  level: DangerLevel,
  subdivision: Subdivision | undefined,
  terrain: { difficulty?: string; steep?: readonly number[] },
): GrmResult | undefined {
  const g = THRESHOLDS.grm;
  const lv = levelValue(level, subdivision);
  const area: 0 | 1 | 2 = lv < 3 ? 0 : lv < 4 ? 1 : 2;
  const fromGrade = gradeDegrees(terrain.difficulty);
  const cls = (k: number) => {
    const c = terrain.steep?.[k];
    return c === undefined ? undefined : Math.max(0, Math.min(5, Math.round(c)));
  };
  let slopeDeg: number;
  let slopeText: string;
  if (fromGrade !== undefined) {
    const grade = `SAC-Grad ${terrain.difficulty?.trim()} (bis ${Math.round(fromGrade)}°)`;
    slopeDeg = fromGrade + (area > 0 ? g.slopeMarginDeg : 0);
    slopeText = area > 0 ? `${grade} + ${g.slopeMarginDeg}° für den ganzen Hang` : grade;
  } else {
    // No grade: terrain measurement (track area, whole slope, incl. runout).
    const c = cls(area);
    if (c === undefined) return undefined;
    slopeDeg = g.classDegrees[c]!;
    slopeText = `${SLOPE_CLASS_LABEL[c]} (Karte Hangneigung)`;
  }
  if (level >= 5) return { color: 'red', levelX: lv, area, slopeDeg, slopeText };
  const greenBelow = g.greenAtLevel1 - g.greenPerLevel * (lv - 1);
  const redFrom = g.redAt.deg - g.redPerLevel * (lv - g.redAt.level);
  const color: RiskColor = slopeDeg < greenBelow ? 'green' : slopeDeg >= redFrom ? 'red' : 'orange';
  return { color, levelX: lv, area, slopeDeg, slopeText };
}

/** Computed entry for today, or undefined without bulletin or steepness (fail closed). */
export function grmEntry(
  c: Pick<Candidate, 'id' | 'steep' | 'difficulty'>,
  slf: SlfDanger | undefined,
  today: IsoDate,
): (RiskEntry & { grm: GrmResult }) | undefined {
  if (!slf) return undefined;
  const grm = grmColour(slf.level, slf.subdivision, { ...(c.difficulty ? { difficulty: c.difficulty } : {}), ...(c.steep ? { steep: c.steep } : {}) });
  if (!grm) return undefined;
  return { candidateId: c.id, color: grm.color, dangerLevel: slf.level, date: today, source: GRM_SOURCE, grm };
}

const ORDER: Record<RiskColor, number> = { green: 0, orange: 1, red: 2 };

/** The more cautious of two colours. */
export function worse(a: RiskColor, b: RiskColor): RiskColor {
  return ORDER[a] >= ORDER[b] ? a : b;
}
