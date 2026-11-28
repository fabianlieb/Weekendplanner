import { describe, expect, it } from 'vitest';
import { candidates, input, profile } from './__fixtures__/scenario';
import { POOL_CAP, isDuplicate, selectPool } from './pool';
import { skiGradeRank, snowshoeGradeRank, tooDifficult } from './profile';
import type { Candidate } from './types';

const home = profile.startPoints[0]!;
function tour(i: number, patch: Partial<Candidate> = {}): Candidate {
  return {
    id: `cat-${i}`,
    name: `Tour ${i}`,
    kind: 'ski_tour',
    valley: { lat: 46.9 + i * 0.001, lon: 9.0 + i * 0.001, elevation: 1200 },
    summit: { lat: 46.92 + i * 0.001, lon: 9.02 + i * 0.001, elevation: 2200 },
    elevationGain: 1000,
    durationHours: 5,
    travelMinutes: {},
    done: false,
    active: true,
    difficulty: 'WS',
    source: 'swisstopo/SAC',
    ...patch,
  };
}
const base = { profile, startPoint: home, maxTravelHours: 3, dayForm: input.dayForm };

describe('difficulty', () => {
  it('ranks SAC and snowshoe grades', () => {
    expect(['L', 'WS-', 'WS+', 'ZS', 'S+', 'SS'].map((g) => skiGradeRank(g))).toEqual([0, 1, 1, 2, 3, 4]);
    expect(['blau', 'rot', 'schwarz', 'WT1', 'WT2', 'WT3+', 'WT5'].map((g) => snowshoeGradeRank(g))).toEqual([0, 1, 2, 0, 1, 2, 2]);
  });

  it('filters above the profile limit; unknown difficulty passes', () => {
    const p = { ...profile, maxDifficulty: { ski_tour: 'WS' as const, snowshoe: 'leicht' as const } };
    expect(tooDifficult(p, 'ski_tour', 'WS+')).toBe(false);
    expect(tooDifficult(p, 'ski_tour', 'ZS-')).toBe(true);
    expect(tooDifficult(p, 'snowshoe_trail', 'rot')).toBe(true);
    expect(tooDifficult(p, 'snowshoe_trail', undefined)).toBe(false);
  });
});

describe('candidate pool', () => {
  it('keeps all own entries and adds fitting catalogue entries', () => {
    const pool = selectPool({ ...base, own: candidates, catalog: [tour(1), tour(2, { difficulty: 'S' })] });
    expect(pool.filter((c) => !c.source).length).toBe(candidates.length);
    expect(pool.some((c) => c.id === 'cat-1')).toBe(true);
    expect(pool.some((c) => c.id === 'cat-2')).toBe(false); // too difficult for ZS profile? S > ZS
  });

  it('drops catalogue duplicates of own entries', () => {
    const own = candidates.find((c) => c.id === 'pizol')!;
    const dup = tour(9, { summit: { ...own.summit, lat: own.summit.lat + 0.002 } });
    expect(isDuplicate(own, dup)).toBe(true);
    expect(selectPool({ ...base, own: [own], catalog: [dup] }).some((c) => c.id === 'cat-9')).toBe(false);
  });

  it('respects disabled sports, hidden entries, capacity and travel', () => {
    const off = { ...profile, activities: { ...profile.activities, ski_tour: { enabled: false, level: 2 as const } } };
    expect(selectPool({ ...base, profile: off, own: [], catalog: [tour(1)] })).toHaveLength(0);
    expect(selectPool({ ...base, own: [], catalog: [tour(1, { active: false })] })).toHaveLength(0);
    expect(selectPool({ ...base, own: [], catalog: [tour(1, { elevationGain: 2500 })] })).toHaveLength(0);
    expect(selectPool({ ...base, maxTravelHours: 1, own: [], catalog: [tour(1, { valley: { lat: 46.0, lon: 7.7, elevation: 1600 } })] })).toHaveLength(0);
  });

  it('caps per kind, closest first; favourites and included ids always come along', () => {
    const many = Array.from({ length: 60 }, (_, i) => tour(i));
    const pool = selectPool({ ...base, own: [], catalog: [...many, tour(99, { favorite: true, valley: { lat: 46.0, lon: 7.7, elevation: 1600 } })], include: new Set(['cat-59']) });
    expect(pool.filter((c) => c.kind === 'ski_tour').length).toBe(POOL_CAP.ski_tour + 2);
    expect(pool.some((c) => c.id === 'cat-99')).toBe(true);
    expect(pool.some((c) => c.id === 'cat-59')).toBe(true);
  });
});
