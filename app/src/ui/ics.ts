// iCalendar (.ics) for a chosen plan: departure → return, reminders on the eve (check) and before leaving.
// Times are written in UTC, so no VTIMEZONE block is needed.

import { addDays, formatTime, zurichMinutes } from '../engine/util';
import type { IsoDate, Minutes, Suggestion } from '../engine/types';
import { weatherLine } from './format';

/** Eve reminder: 18:00 the day before (matches the evening-check automation). */
export const EVE_REMINDER = 18 * 60;
/** Reminder before departure, minutes. */
export const DEPARTURE_REMINDER = 30;

/** Zurich local date + minutes → UTC instant. */
export function zurichToUtc(date: IsoDate, minutes: Minutes): Date {
  // zurichMinutes(instant, date) is linear in the instant: find the instant with the wanted minutes.
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const guess = new Date(Date.UTC(y, m - 1, d, 0, minutes));
  const diff = zurichMinutes(guess, date) - minutes;
  return new Date(guess.getTime() - diff * 60000);
}

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds lines longer than 75 octets (RFC 5545), without splitting UTF-8 characters. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + n > limit) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += n;
  }
  out.push(current);
  return out.join('\r\n ');
}

export interface IcsInput {
  s: Suggestion;
  /** Where to drive to (parking or start). */
  place: { name: string; lat: number; lon: number };
  navigationUrl: string;
  appUrl: string;
  packing?: string[];
  now?: Date;
}

export function buildIcs({ s, place, navigationUrl, appUrl, packing, now = new Date() }: IcsInput): string {
  const start = s.schedule[0]?.time ?? 8 * 60;
  const end = s.schedule.at(-1)?.time ?? start + 8 * 60;
  const dtStart = zurichToUtc(s.date, start);
  const dtEnd = zurichToUtc(s.date, end <= start ? start + 60 : end);
  const eve = zurichToUtc(addDays(s.date, -1), EVE_REMINDER);

  const desc: string[] = [...s.reasons];
  if (s.weather) desc.push(`Wetter: ${weatherLine(s.weather, s.activity, s.slot)}`);
  if (s.risk.applies) {
    desc.push(s.risk.label);
    if (s.risk.dangerLabel) desc.push(s.risk.dangerLabel);
    if (s.risk.groupNote) desc.push(s.risk.groupNote);
    desc.push(s.risk.bulletinHint);
  }
  desc.push('', 'Zeitplan:', ...s.schedule.map((i) => `${formatTime(i.time)} ${i.label}`));
  if (packing?.length) desc.push('', 'Packliste:', ...packing.map((p) => `- ${p}`));
  desc.push('', `Navigation: ${navigationUrl}`, `Plan in der App: ${appUrl}`);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wochenend-Planer//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${s.id.replace(/[^A-Za-z0-9:-]/g, '-')}@wochenend-planer`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(dtStart)}`,
    `DTEND:${utcStamp(dtEnd)}`,
    `SUMMARY:${escapeText(`${s.activityLabel}: ${s.candidateName}`)}`,
    `LOCATION:${escapeText(`${place.name} (${place.lat.toFixed(5)}, ${place.lon.toFixed(5)})`)}`,
    `GEO:${place.lat.toFixed(5)};${place.lon.toFixed(5)}`,
    `URL:${appUrl}`,
    `DESCRIPTION:${escapeText(desc.join('\n'))}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(`Vorabend-Check: ${s.candidateName} – Farben von heute eintragen und Plan prüfen`)}`,
    `TRIGGER;VALUE=DATE-TIME:${utcStamp(eve)}`,
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(`Abfahrt in ${DEPARTURE_REMINDER} min: ${s.candidateName}`)}`,
    `TRIGGER:-PT${DEPARTURE_REMINDER}M`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
