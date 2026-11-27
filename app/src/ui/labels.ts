import type { CandidateKind, DayForm, Equipment, RiskColor, RiskLevel, TimeBudget } from '../engine/types';

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  alpine_ski: 'Ski (Piste)',
  touring_ski: 'Tourenski',
  skins: 'Felle',
  avalanche_kit: 'LVS-Set',
  snowshoes: 'Schneeschuhe',
  camera: 'Kamera',
  tripod: 'Stativ',
};

export const EQUIPMENT_HINT: Partial<Record<Equipment, string>> = {
  avalanche_kit: 'LVS, Sonde, Schaufel',
};

export const KIND_LABEL: Record<CandidateKind, string> = {
  ski_resort: 'Skigebiet',
  ski_tour: 'Skitour',
  snowshoe_trail: 'Schneeschuh',
  photo_spot: 'Fotospot',
};

export const KIND_PLURAL: Record<CandidateKind, string> = {
  ski_resort: 'Skigebiete',
  ski_tour: 'Skitouren',
  snowshoe_trail: 'Schneeschuh-Trails',
  photo_spot: 'Fotospots',
};

export const KIND_ORDER: CandidateKind[] = ['ski_tour', 'snowshoe_trail', 'ski_resort', 'photo_spot'];

export const RISK_LEVEL_LABEL: Record<RiskLevel, { title: string; text: string }> = {
  1: { title: 'Stufe 1', text: 'Nur grün – geringes Risiko laut Skitourenguru' },
  2: { title: 'Stufe 2', text: 'Grün und orange – Vorsicht, nur mit guter Ausrüstung' },
  3: { title: 'Stufe 3', text: 'Zusätzlich rot – nur in Gruppen mit geschulten Leuten, nie allein, immer mit Bestätigung' },
};

export const RISK_COLOR_SHORT: Record<RiskColor, string> = {
  green: 'grün',
  orange: 'orange',
  red: 'rot',
};

export const BUDGET_LABEL: Record<TimeBudget, string> = { full: 'Ganzer Tag', half: 'Halber Tag', free: 'Frei' };
export const DAY_FORM_LABEL: Record<DayForm, string> = { easy: 'Locker', normal: 'Normal', strong: 'Stark' };

export const LINKS = {
  skitourenguru: 'https://www.skitourenguru.ch',
  slfBulletin: 'https://www.slf.ch/de/lawinenbulletin-und-schneesituation/',
  openMeteo: 'https://open-meteo.com/',
  ccBy: 'https://creativecommons.org/licenses/by/4.0/',
} as const;
