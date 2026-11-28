// Reasoning: 1–2 sentences from text snippets, derived from the strongest sub-scores. No AI.

import { LIGHT_LABEL, REASON } from './texts';
import type { ConditionFacts, PhotoAddOn, RiskInfo, SubScoreKey, SubScores } from './types';
import { formatTime } from './util';

const MIN_SUB = 70;
const MAX_SNIPPETS = 2;

function snippet(key: SubScoreKey, value: number, facts: ConditionFacts): string | undefined {
  switch (key) {
    case 'sun':
      return value >= 85 ? REASON.sunny : REASON.mostlySunny;
    case 'newSnow':
      return facts.newSnowCm !== undefined && facts.newSnowCm >= 5 ? REASON.newSnow(facts.newSnowCm) : undefined;
    case 'wind':
      return REASON.calm;
    case 'visibility':
      return REASON.goodVisibility;
    case 'clearNight':
      return REASON.clearNight;
    case 'moon':
      return facts.moonIllumination !== undefined ? REASON.moon(facts.moonIllumination) : undefined;
    case 'clouds':
      return REASON.colourClouds;
    case 'lowCloud':
      return REASON.clearView;
    case 'precipitation':
      return REASON.dry;
    case 'temperature':
      return REASON.mild;
    case 'fogSea':
      return undefined; // handled separately
  }
}

const PRIORITY: SubScoreKey[] = ['newSnow', 'sun', 'clearNight', 'moon', 'clouds', 'visibility', 'lowCloud', 'wind', 'precipitation', 'temperature'];

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function buildReasons(input: {
  sub: SubScores;
  facts: ConditionFacts;
  risk: RiskInfo;
  photo?: PhotoAddOn;
  isPhotoActivity: boolean;
}): string[] {
  const { sub, facts, risk, photo } = input;
  const sentences: string[] = [];

  if (risk.applies && risk.color) {
    sentences.push(
      risk.source === 'grm'
        ? `${REASON.grmRisk(({ green: 'grün', orange: 'orange', red: 'rot' } as const)[risk.color])}.`
        : `${({ green: REASON.greenRisk, orange: REASON.orangeRisk, red: REASON.redRisk } as const)[risk.color]}.`,
    );
  } else if (risk.applies && risk.signposted) {
    sentences.push(`${REASON.signposted}.`);
  }

  const parts: string[] = [];
  if (facts.fogSea) parts.push(REASON.fogSea);
  // PRIORITY order: the most telling facts first (new snow beats «trocken»).
  const ranked = PRIORITY.filter((k) => (sub[k] ?? 0) >= MIN_SUB);
  for (const key of ranked) {
    if (parts.length >= MAX_SNIPPETS) break;
    const s = snippet(key, sub[key] ?? 0, facts);
    if (s) parts.push(s);
  }

  if (parts.length > 0) {
    sentences.push(`${capitalise(parts.join(', '))}.`);
  }

  // Light time as last sentence, if there is room.
  if (sentences.length < 2) {
    if (photo) {
      sentences.push(`${photo.lightLabel} um ${formatTime(photo.time)} am Fotospot ${photo.spotName}.`);
    } else if (input.isPhotoActivity && facts.lightLabel && facts.lightTime !== undefined) {
      sentences.push(`${facts.lightLabel} um ${formatTime(facts.lightTime)}.`);
    } else if (facts.moonrise !== undefined && (sub.moon ?? 0) >= MIN_SUB) {
      sentences.push(`${LIGHT_LABEL.moonrise} um ${formatTime(facts.moonrise)}.`);
    }
  }

  if (sentences.length === 0) sentences.push('Passt in dein Zeitbudget.');
  return sentences.slice(0, 2);
}
