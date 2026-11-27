import { describe, expect, it } from 'vitest';
import { computeAstroDay } from './astro';
import { evaluateConditions } from './conditions';
import { fogSea } from './fogSea';
import { OVERCAST, SAT, STORM, SUMMIT_ABOVE_FOG, SUNNY, VALLEY_FOG, buildWeather, candidates, day } from './__fixtures__/scenario';
import type { Activity, Candidate, Slot } from './types';

const byId = (id: string) => candidates.find((c) => c.id === id) as Candidate;

function score(id: string, activity: Activity, slot: Slot, valley: typeof SUNNY, summit: typeof SUNNY, newSnow = 0) {
  const c = byId(id);
  const weather = buildWeather([c], (_c, _d, p) => (p === 'valley' ? valley : summit), newSnow)[c.id];
  if (!weather) throw new Error('no weather');
  return evaluateConditions({
    candidate: c,
    activity,
    slot,
    date: SAT,
    weather,
    astro: computeAstroDay(SAT, c.summit),
    window: slot === 'evening' ? { start: 17 * 60, end: 20 * 60 } : { start: 9 * 60, end: 15 * 60 },
  });
}

describe('conditions', () => {
  it('ski: sun beats overcast, new snow adds points', () => {
    const sunny = score('flumserberg', 'ski', 'day', SUNNY, SUNNY)!;
    const grey = score('flumserberg', 'ski', 'day', OVERCAST, OVERCAST)!;
    const powder = score('flumserberg', 'ski', 'day', SUNNY, SUNNY, 20)!;
    expect(sunny.score).toBeGreaterThan(grey.score + 30);
    expect(powder.score).toBeGreaterThan(sunny.score);
    expect(powder.facts.newSnowCm).toBe(20);
  });

  it('storm gusts knock out ski and tour options', () => {
    expect(score('flumserberg', 'ski', 'day', STORM, STORM)?.knockout).toBe('wind');
    expect(score('schwarzhorn', 'ski_tour', 'day', STORM, STORM)?.knockout).toBe('wind');
    expect(score('schwarzhorn', 'ski_tour', 'day', SUNNY, SUNNY)?.knockout).toBeUndefined();
  });

  it('tour: visibility falls back to cloud cover when the model has none', () => {
    const noVis = { ...SUNNY, visibility: undefined };
    const r = score('schwarzhorn', 'ski_tour', 'day', noVis, noVis)!;
    expect(r.sub.visibility).toBeGreaterThan(80);
  });

  it('evening tour: clear night scores higher than overcast', () => {
    const clear = score('ibergeregg', 'snowshoe', 'evening', SUNNY, SUNNY)!;
    const grey = score('ibergeregg', 'snowshoe', 'evening', OVERCAST, OVERCAST)!;
    expect(clear.sub.clearNight).toBeGreaterThan(80);
    expect(clear.score).toBeGreaterThan(grey.score);
  });

  it('photo: fog sea lifts the score and is reported', () => {
    const fog = score('chaeserrugg', 'photo', 'morning', VALLEY_FOG, SUMMIT_ABOVE_FOG)!;
    const grey = score('chaeserrugg', 'photo', 'morning', OVERCAST, OVERCAST)!;
    expect(fog.facts.fogSea).toBe(true);
    expect(fog.score).toBeGreaterThan(85);
    expect(grey.score).toBeLessThan(40);
    expect(fog.facts.lightLabel).toBe('Sonnenaufgang');
  });

  it('missing weather for the date returns undefined (fail closed)', () => {
    const c = byId('flumserberg');
    const r = evaluateConditions({
      candidate: c,
      activity: 'ski',
      slot: 'day',
      date: SAT,
      weather: { valley: {}, summit: {} },
      astro: computeAstroDay(SAT, c.summit),
      window: { start: 540, end: 900 },
    });
    expect(r).toBeUndefined();
  });
});

describe('fog sea heuristic', () => {
  const valleyPt = { lat: 47.12, lon: 9.31, elevation: 430 };
  const summitPt = { lat: 47.15, lon: 9.31, elevation: 2260 };

  it('detects low valley cloud + clear summit + inversion', () => {
    const r = fogSea(day(SAT, VALLEY_FOG), day(SAT, SUMMIT_ABOVE_FOG), valleyPt, summitPt);
    expect(r.likely).toBe(true);
    expect(r.likelihood).toBeGreaterThanOrEqual(90);
  });

  it('no fog sea when the summit is in the clouds', () => {
    expect(fogSea(day(SAT, VALLEY_FOG), day(SAT, OVERCAST), valleyPt, summitPt).likely).toBe(false);
  });

  it('no fog sea without valley fog', () => {
    expect(fogSea(day(SAT, SUNNY), day(SAT, SUMMIT_ABOVE_FOG), valleyPt, summitPt).likely).toBe(false);
  });

  it('no fog sea without inversion (summit much colder)', () => {
    const cold = { ...SUMMIT_ABOVE_FOG, temperature: -15 };
    expect(fogSea(day(SAT, VALLEY_FOG), day(SAT, cold), valleyPt, summitPt).likely).toBe(false);
  });

  it('no fog sea when summit is barely above the valley point', () => {
    const r = fogSea(day(SAT, VALLEY_FOG), day(SAT, SUMMIT_ABOVE_FOG), valleyPt, { ...summitPt, elevation: 600 });
    expect(r.likelihood).toBe(0);
  });
});
