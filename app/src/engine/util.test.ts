import { describe, expect, it } from 'vitest';
import { computeAstroDay } from './astro';
import { SAT, SUN, TODAY } from './__fixtures__/scenario';
import { addDays, formatTime, haversineKm, parseTime, ramp, upcomingWeekend, weekday, weighted, zurichMinutes, zurichOffsetMinutes, zurichToday } from './util';

describe('util', () => {
  it('ramp works in both directions and clamps', () => {
    expect(ramp(50, { bad: 0, good: 100 })).toBe(50);
    expect(ramp(-10, { bad: 0, good: 100 })).toBe(0);
    expect(ramp(30, { bad: 70, good: 30 })).toBe(100);
    expect(ramp(50, { bad: 70, good: 30 })).toBe(50);
    expect(ramp(90, { bad: 70, good: 30 })).toBe(0);
  });

  it('weighted ignores missing sub-scores', () => {
    expect(weighted({ a: 100 }, { a: 1, b: 1 })).toBe(100);
    expect(weighted({ a: 100, b: 0 }, { a: 3, b: 1 })).toBe(75);
  });

  it('formats and parses times', () => {
    expect(formatTime(390)).toBe('06:30');
    expect(formatTime(1440 + 5)).toBe('00:05');
    expect(parseTime('05:15')).toBe(315);
  });

  it('computes the upcoming weekend', () => {
    expect(weekday(TODAY)).toBe(4); // Thursday
    expect(upcomingWeekend(TODAY)).toEqual({ sat: SAT, sun: SUN });
    expect(upcomingWeekend(SAT)).toEqual({ sat: SAT, sun: SUN });
    expect(upcomingWeekend(SUN)).toEqual({ sun: SUN });
    expect(upcomingWeekend(addDays(SUN, 1))).toEqual({ sat: addDays(SAT, 7), sun: addDays(SUN, 7) });
  });

  it('handles the Zurich time zone in winter and summer', () => {
    expect(zurichOffsetMinutes(new Date('2026-12-05T12:00:00Z'))).toBe(60);
    expect(zurichOffsetMinutes(new Date('2026-07-05T12:00:00Z'))).toBe(120);
    expect(zurichMinutes(new Date('2026-12-05T06:30:00Z'), '2026-12-05')).toBe(450);
    expect(zurichToday(new Date('2026-12-05T23:30:00Z'))).toBe('2026-12-06');
  });

  it('haversine distance Zurich–Bern is about 95 km', () => {
    expect(haversineKm({ lat: 47.3769, lon: 8.5417 }, { lat: 46.948, lon: 7.4474 })).toBeGreaterThan(90);
    expect(haversineKm({ lat: 47.3769, lon: 8.5417 }, { lat: 46.948, lon: 7.4474 })).toBeLessThan(100);
  });
});

describe('astro', () => {
  const zurich = { lat: 47.3769, lon: 8.5417, elevation: 408 };
  const a = computeAstroDay(SAT, zurich);

  it('sunrise and sunset in Zurich in early December are plausible', () => {
    expect(a.sunrise).toBeGreaterThan(7 * 60 + 45);
    expect(a.sunrise).toBeLessThan(8 * 60 + 10);
    expect(a.sunset).toBeGreaterThan(16 * 60 + 25);
    expect(a.sunset).toBeLessThan(16 * 60 + 45);
  });

  it('light windows are ordered: blue → golden → sunrise … sunset → golden → blue', () => {
    expect(a.blueMorning.start).toBeLessThan(a.blueMorning.end);
    expect(a.blueMorning.end).toBe(a.goldenMorning.start);
    expect(a.goldenMorning.start).toBeLessThan(a.sunrise);
    expect(a.goldenMorning.end).toBeGreaterThan(a.sunrise);
    expect(a.goldenEvening.start).toBeLessThan(a.sunset);
    expect(a.goldenEvening.end).toBeGreaterThan(a.sunset);
    expect(a.blueEvening.start).toBe(a.goldenEvening.end);
    expect(a.blueEvening.end).toBeGreaterThan(a.blueEvening.start);
  });

  it('moon illumination is a fraction', () => {
    expect(a.moonIllumination).toBeGreaterThanOrEqual(0);
    expect(a.moonIllumination).toBeLessThanOrEqual(1);
  });

  it('a summit sees the sun earlier than the valley', () => {
    const high = computeAstroDay(SAT, { ...zurich, elevation: 3000 });
    expect(high.sunrise).toBeLessThan(a.sunrise);
  });
});
