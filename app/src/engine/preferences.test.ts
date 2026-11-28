import { describe, expect, it } from 'vitest';
import { learnPreferences, preferenceBonus } from './preferences';
import { THRESHOLDS } from './thresholds';
import type { Feedback } from './types';

const fb = (ratings: [string, 'ski_tour' | 'ski' | 'snowshoe' | 'photo', boolean][]): Feedback => ({
  weekend: '2026-12-05',
  implemented: true,
  fittingSuggestions: 2,
  ratings: ratings.map(([candidateId, activity, fits], i) => ({ suggestionId: `s${i}`, candidateId, activity, fits })),
});

describe('learning from choices and ratings', () => {
  it('nothing learned without signals', () => {
    const p = learnPreferences([], []);
    expect(p).toEqual({ activity: {}, candidate: {}, signals: 0 });
    expect(preferenceBonus(p, 'x', 'ski')).toBe(0);
    expect(preferenceBonus(undefined, 'x', 'ski')).toBe(0);
  });

  it('a single choice only favours the place, not yet the activity', () => {
    const p = learnPreferences([], [{ candidateId: 'pizol', activity: 'ski_tour' }]);
    expect(p.candidate['pizol']).toBe(THRESHOLDS.learning.placeChosen);
    expect(p.activity['ski_tour']).toBeUndefined();
  });

  it('repeated choices favour the activity, capped', () => {
    const choices = Array.from({ length: 10 }, () => ({ candidateId: 'pizol', activity: 'ski_tour' as const }));
    const p = learnPreferences([], choices);
    expect(p.activity['ski_tour']).toBeGreaterThan(0);
    expect(p.activity['ski_tour']).toBeLessThanOrEqual(THRESHOLDS.learning.maxActivityPoints);
    expect(p.candidate['pizol']).toBe(THRESHOLDS.learning.placeLikeMax);
  });

  it('«passt nicht» pushes a place and its activity down', () => {
    const p = learnPreferences([fb([['rigi', 'photo', false], ['rigi', 'photo', false], ['niesen', 'photo', false]])], []);
    expect(p.candidate['rigi']).toBe(-2 * THRESHOLDS.learning.placeDislike);
    expect(p.activity['photo']).toBeLessThan(0);
    expect(preferenceBonus(p, 'rigi', 'photo')).toBe(p.candidate['rigi']! + p.activity['photo']!);
  });

  it('mixed ratings roughly cancel out', () => {
    const p = learnPreferences([fb([['a', 'ski', true], ['b', 'ski', false], ['c', 'ski', true], ['d', 'ski', false]])], []);
    expect(p.activity['ski'] ?? 0).toBe(0);
  });
});
