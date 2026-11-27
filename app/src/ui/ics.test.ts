import { describe, expect, it } from 'vitest';
import { context } from '../engine/__fixtures__/scenario';
import { suggest } from '../engine/suggest';
import { buildIcs, foldLine, zurichToUtc } from './ics';

const s = suggest(context()).suggestions[0]!;
const ics = buildIcs({
  s,
  place: { name: 'Test, Startpunkt', lat: 46.7556, lon: 9.9567 },
  navigationUrl: 'https://www.google.com/maps/dir/?api=1&destination=46.75560,9.95670&travelmode=driving',
  appUrl: 'https://example.test/?view=detail&id=x',
  now: new Date('2026-12-03T17:00:00Z'),
});
const unfolded = ics.replace(/\r\n /g, '');

describe('calendar export', () => {
  it('converts Zurich local time to UTC (winter: UTC+1)', () => {
    expect(zurichToUtc('2026-12-05', 6 * 60 + 30).toISOString()).toBe('2026-12-05T05:30:00.000Z');
    expect(zurichToUtc('2026-07-04', 6 * 60).toISOString()).toBe('2026-07-04T04:00:00.000Z');
  });

  it('is a valid VCALENDAR with CRLF line endings and one event', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.split('\r\n').every((l) => !l.includes('\n'))).toBe(true);
    expect(unfolded.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it('runs from departure to return in UTC', () => {
    const dep = s.schedule[0]!.time;
    const hh = String(Math.floor(dep / 60) - 1).padStart(2, '0');
    const mm = String(dep % 60).padStart(2, '0');
    expect(unfolded).toContain(`DTSTART:${s.date.replace(/-/g, '')}T${hh}${mm}00Z`);
    expect(unfolded).toMatch(/DTEND:\d{8}T\d{6}Z/);
  });

  it('has reminders: 18:00 on the eve and 30 min before departure', () => {
    expect(unfolded).toContain('TRIGGER;VALUE=DATE-TIME:20261204T170000Z');
    expect(unfolded).toContain('TRIGGER:-PT30M');
  });

  it('contains title, place, risk hint and escapes special characters', () => {
    expect(unfolded).toContain(`SUMMARY:${s.activityLabel}: ${s.candidateName.replace(/,/g, String.raw`\,`)}`);
    expect(unfolded).toContain(String.raw`LOCATION:Test\, Startpunkt (46.75560\, 9.95670)`);
    expect(unfolded).toContain('GEO:46.75560;9.95670');
    if (s.risk.applies) expect(unfolded).toContain('SLF-Lawinenbulletin');
    expect(unfolded).not.toMatch(/\bsicher\b/i);
  });

  it('folds long lines at 75 octets without breaking characters', () => {
    const long = `DESCRIPTION:${'äöü'.repeat(60)}`;
    const folded = foldLine(long);
    const enc = new TextEncoder();
    for (const part of folded.split('\r\n')) expect(enc.encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(long);
  });
});
