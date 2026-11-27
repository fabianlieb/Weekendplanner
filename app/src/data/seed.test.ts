import { describe, expect, it } from 'vitest';
import { validateCandidate } from './backup';
import { SEED_CANDIDATES } from './seed';

describe('start list', () => {
  it('has 15–20 valid candidates with unique ids', () => {
    expect(SEED_CANDIDATES.length).toBeGreaterThanOrEqual(15);
    expect(SEED_CANDIDATES.length).toBeLessThanOrEqual(20);
    expect(new Set(SEED_CANDIDATES.map((c) => c.id)).size).toBe(SEED_CANDIDATES.length);
    for (const c of SEED_CANDIDATES) expect(validateCandidate(c, c.id), c.id).toBeDefined();
  });

  it('covers all four activities', () => {
    const kinds = new Set(SEED_CANDIDATES.map((c) => c.kind));
    expect([...kinds].sort()).toEqual(['photo_spot', 'ski_resort', 'ski_tour', 'snowshoe_trail']);
  });

  it('lies in Switzerland (rough bounding box) with summit above valley', () => {
    for (const c of SEED_CANDIDATES) {
      for (const p of [c.valley, c.summit]) {
        expect(p.lat, c.id).toBeGreaterThan(45.8);
        expect(p.lat, c.id).toBeLessThan(47.85);
        expect(p.lon, c.id).toBeGreaterThan(5.9);
        expect(p.lon, c.id).toBeLessThan(10.5);
      }
      expect(c.summit.elevation, c.id).toBeGreaterThan(c.valley.elevation);
    }
  });

  it('is neutral: nothing done, no prices, no travel times', () => {
    for (const c of SEED_CANDIDATES) {
      expect(c.done).toBe(false);
      expect(c.priceChf).toBeUndefined();
      expect(Object.keys(c.travelMinutes)).toHaveLength(0);
      expect(c.note).toMatch(/prüfen/);
    }
  });
});
