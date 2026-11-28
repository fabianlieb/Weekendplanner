// All user-facing text produced by the engine (Swiss German spelling, «ss»).
// Safety rule: never claim that something is «sicher». A test scans this module.

import type { Activity, DangerLevel, DayKey, IsoDate, RiskColor, Slot } from './types';
import { formatTime, weekday } from './util';

export const ACTIVITY_LABEL: Record<Activity, string> = {
  ski: 'Ski',
  ski_tour: 'Skitour',
  snowshoe: 'Schneeschuh',
  photo: 'Fotografie',
};

export const DAY_LABEL: Record<DayKey, string> = { sat: 'Samstag', sun: 'Sonntag' };
export const DAY_SHORT: Record<DayKey, string> = { sat: 'Sa', sun: 'So' };

const WEEKDAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function shortDate(d: IsoDate): string {
  const [, m, day] = d.split('-');
  return `${WEEKDAY_SHORT[weekday(d)]} ${Number(day)}.${Number(m)}.`;
}

export function activityLabel(activity: Activity, slot: Slot, withPhoto: boolean): string {
  if (activity === 'photo') return slot === 'morning' ? 'Foto am Morgen' : 'Foto am Abend';
  const base = ACTIVITY_LABEL[activity] + (slot === 'evening' ? ' am Abend' : '');
  return withPhoto ? `${base} + Foto` : base;
}

// ---------------------------------------------------------------------------
// Avalanche risk (wording fixed by the safety rules)

export const RISK_COLOR_LABEL: Record<RiskColor, string> = {
  green: 'grün',
  orange: 'orange',
  red: 'rot',
};

export const RISK_TEXT: Record<RiskColor, string> = {
  green: 'geringes Risiko laut Skitourenguru',
  orange: 'erhöhtes Risiko laut Skitourenguru – Vorsicht, nur mit guter Ausrüstung',
  red: 'hohes Risiko laut Skitourenguru – nur in Gruppen mit geschulten Leuten, nie allein',
};

export const RISK_GROUP_NOTE = 'Nur in Gruppen mit geschulten Leuten, nie allein.';
export const RISK_UNKNOWN = 'Risiko unbekannt – keine aktuelle Skitourenguru-Farbe eingetragen';
export const BULLETIN_HINT = 'Prüfe vor dem Start das aktuelle SLF-Lawinenbulletin.';
export const SIGNPOSTED_LABEL = 'Signalisierter Trail · keine Skitourenguru-Bewertung';
export const NOT_AVALANCHE_LABEL = 'Pisten und Fotospots: keine Skitourenguru-Bewertung';
export const TRAINED_GROUP_QUESTION = 'Du bist in einer geschulten Gruppe?';

export function riskLabel(color: RiskColor): string {
  return `Skitourenguru: ${RISK_COLOR_LABEL[color]} · ${RISK_TEXT[color]}`;
}

export function dangerLabel(level: DangerLevel | undefined): string {
  return level ? `Gefahrenstufe ${level} laut Bulletin` : 'Gefahrenstufe nicht eingetragen';
}

export function freshnessNote(entryDate: IsoDate, planDate: IsoDate): string {
  return entryDate === planDate
    ? `Stand ${shortDate(entryDate)}`
    : `Stand ${shortDate(entryDate)} – am Vorabend neu prüfen`;
}

// ---------------------------------------------------------------------------
// Reasoning snippets (selected from the strongest sub-scores).
// Written as they appear mid-sentence; the sentence start is capitalised by the engine.

export const REASON = {
  sunny: 'sonnig',
  mostlySunny: 'viel Sonne',
  newSnow: (cm: number) => `${Math.round(cm)} cm Neuschnee in den letzten 3 Tagen`,
  calm: 'wenig Wind',
  mild: 'angenehme Temperaturen',
  dry: 'trocken',
  goodVisibility: 'gute Sicht',
  clearNight: 'klare Nacht',
  moon: (fraction: number) => (fraction >= 0.9 ? 'Mond fast voll' : `Mond zu ${Math.round(fraction * 100)} % beleuchtet`),
  colourClouds: 'lockere Wolken für Farbe am Himmel',
  clearView: 'freie Sicht am Spot',
  fogSea: 'Hochnebel im Tal, oben Sonne',
  greenRisk: 'Skitourenguru: grün',
  orangeRisk: 'Skitourenguru: orange',
  redRisk: 'Skitourenguru: rot',
  signposted: 'Signalisierter Trail',
  provenFavourite: 'Bewährt',
  newPlace: 'Neu für dich',
  learnedLike: 'passt zu deinen bisherigen Wahlen',
} as const;

export function lightSentence(label: string, time: number, place: string): string {
  return `${label} um ${formatTime(time)} am ${place}.`;
}

export const LIGHT_LABEL = {
  sunrise: 'Sonnenaufgang',
  sunset: 'Sonnenuntergang',
  goldenMorning: 'Golden Hour am Morgen',
  goldenEvening: 'Golden Hour am Abend',
  blueMorning: 'Blue Hour am Morgen',
  blueEvening: 'Blue Hour am Abend',
  moonrise: 'Mondaufgang',
} as const;

export const SCHEDULE = {
  departure: (from: string) => `Abfahrt ${from}`,
  back: (to: string) => `Ankunft ${to}`,
  firstLift: 'Erste Bahn',
  startSki: 'Start Skitag',
  lastRun: 'Letzte Abfahrt',
  startAscent: 'Start Aufstieg',
  startTrail: 'Start Trail',
  summit: 'Gipfel',
  summitPhoto: 'Gipfel, Fotostopp',
  startDescent: 'Abfahrt ins Tal',
  endTour: 'Zurück am Ausgangspunkt',
  arriveSpot: 'Ankunft am Fotospot',
  arrivePhotoSpot: (spot: string) => `Ankunft Fotospot ${spot}`,
  photo: (label: string) => label,
} as const;

export const PLAN_B_REASON = {
  avalanche: 'falls das Lawinenrisiko steigt',
  weather: (day: DayKey) => `falls das Wetter am ${DAY_LABEL[day]} kippt`,
  generic: 'falls Vorschlag 1 wegfällt',
} as const;

export const CHECK_REASON = {
  riskMissing: 'Für heute ist keine Skitourenguru-Farbe eingetragen.',
  riskAbove: 'Lawinenrisiko gestiegen.',
  redUnconfirmed: 'Rote Tour ohne Bestätigung einer geschulten Gruppe.',
  weatherWorse: 'Die Prognose hat sich verschlechtert.',
  weatherMissing: 'Keine aktuellen Wetterdaten.',
  other: 'Der Plan passt nicht mehr.',
} as const;

export const CHECK_HOLDS = 'Plan steht.';
export const CHECK_SWITCH = 'Wechsel auf Plan B';
