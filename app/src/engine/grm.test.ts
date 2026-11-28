// Own avalanche risk calculation (GRM). Same safety rules as for entered colours:
// fail closed, filter by level, red only with confirmation, never «sicher».
import { describe, expect, it } from 'vitest';
import { SAT, TODAY, candidates, context, input, profile, withLevel } from './__fixtures__/scenario';
import { GRM_SOURCE, gradeDegrees, grmColour, grmEntry, levelValue, worse } from './grm';
import { MANUAL_SOURCE, allowedColors, needsAvalancheRating, resolveRisk } from './risk';
import type { SlfDanger, Subdivision } from './slf';
import { suggest } from './suggest';
import type { Candidate, DangerLevel, RiskEntry, RiskLevel, Suggestion, SuggestionResult } from './types';
import { addDays } from './util';

const tours = candidates.filter(needsAvalancheRating);
const all = (r: SuggestionResult): Suggestion[] => [...r.suggestions, ...(r.planB ? [r.planB] : [])];

const danger = (level: DangerLevel, subdivision?: Subdivision, coversSat = true): SlfDanger => ({
  level,
  ...(subdivision ? { subdivision } : {}),
  region: 'CH-1',
  regionName: 'Testregion',
  validFrom: `${TODAY}T16:00:00Z`,
  validTo: coversSat ? `${SAT}T16:00:00Z` : `${addDays(TODAY, 1)}T16:00:00Z`,
  problems: [],
});

/** Tours with terrain data and the same danger everywhere. */
function run(opts: { steep?: [number, number, number]; d?: SlfDanger; risks?: RiskEntry[]; level?: RiskLevel; confirmed?: boolean; onlyTours?: boolean }) {
  const cs = (opts.onlyTours ? tours : candidates).map((c) => (needsAvalancheRating(c) && opts.steep ? { ...c, steep: opts.steep } : c));
  return suggest(
    context({
      candidates: cs,
      riskEntries: opts.risks ?? [],
      profile: withLevel(profile, opts.level ?? 3),
      input: { ...input, trainedGroupConfirmed: opts.confirmed ?? true },
      ...(opts.d ? { slf: Object.fromEntries(cs.filter(needsAvalancheRating).map((c) => [c.id, opts.d!])) } : {}),
    }),
  );
}

describe('GRM chart (official leaflet «Achtung Lawinen»)', () => {
  it('reads the levels with subdivisions on the chart axis', () => {
    expect(levelValue(2, 'minus')).toBeCloseTo(2.17, 2);
    expect(levelValue(2)).toBe(2.5);
    expect(levelValue(2, 'plus')).toBeCloseTo(2.83, 2);
  });

  it('gering: 30–35° green, 40–45° orange, over 50° red', () => {
    expect(grmColour(1, undefined, { steep: [1, 5, 5] })!.color).toBe('green');
    expect(grmColour(1, undefined, { steep: [3, 5, 5] })!.color).toBe('orange');
    expect(grmColour(1, undefined, { steep: [5, 5, 5] })!.color).toBe('red');
  });

  it('mässig: under 30° green, 30–40° orange, 40–45° red; only the track area counts', () => {
    expect(grmColour(2, undefined, { steep: [0, 5, 5] })).toMatchObject({ color: 'green', area: 0 });
    expect(grmColour(2, undefined, { steep: [1, 5, 5] })!.color).toBe('orange');
    expect(grmColour(2, undefined, { steep: [2, 5, 5] })!.color).toBe('orange');
    expect(grmColour(2, undefined, { steep: [3, 5, 5] })!.color).toBe('red');
    expect(grmColour(2, 'minus', { steep: [1, 5, 5] })!.color).toBe('green');
  });

  it('erheblich looks at the whole slope, gross includes the runout', () => {
    expect(grmColour(3, 'minus', { steep: [0, 0, 5] })).toMatchObject({ color: 'green', area: 1 });
    expect(grmColour(3, undefined, { steep: [0, 1, 5] })!.color).toBe('orange');
    expect(grmColour(3, undefined, { steep: [0, 2, 5] })!.color).toBe('red');
    expect(grmColour(4, undefined, { steep: [0, 0, 1] })).toMatchObject({ color: 'red', area: 2 });
    expect(grmColour(4, 'minus', { steep: [0, 0, 0] })!.color).toBe('orange');
  });

  it('the SAC grade gives the steepest passage of the track (upper end of its range)', () => {
    expect(gradeDegrees('L')).toBe(28.3);
    expect(gradeDegrees('L+')).toBe(30);
    expect(gradeDegrees('WS-')).toBe(31.7);
    expect(gradeDegrees('ZS')).toBe(38.3);
    expect(gradeDegrees('S+')).toBe(45);
    expect(gradeDegrees('WT2')).toBe(25);
    expect(gradeDegrees('WT3+')).toBe(31.7);
    expect(gradeDegrees('WT6')).toBe(40);
    expect(gradeDegrees('blau')).toBeUndefined();
    // mässig: WS- green, WS and ZS orange, S red
    expect(grmColour(2, undefined, { difficulty: 'WS-' })!.color).toBe('green');
    expect(grmColour(2, undefined, { difficulty: 'WS' })!.color).toBe('orange');
    expect(grmColour(2, undefined, { difficulty: 'ZS+' })!.color).toBe('orange');
    expect(grmColour(2, undefined, { difficulty: 'S' })!.color).toBe('red');
    // gering: ZS- green, S orange
    expect(grmColour(1, undefined, { difficulty: 'ZS-' })!.color).toBe('green');
    expect(grmColour(1, undefined, { difficulty: 'S' })!.color).toBe('orange');
    // the grade wins over the terrain measurement for the track …
    expect(grmColour(2, undefined, { difficulty: 'L', steep: [5, 5, 5] })).toMatchObject({ color: 'green', slopeText: 'SAC-Grad L (bis 28°)' });
    // … and from erheblich on the whole slope counts: grade + 5°
    expect(grmColour(3, undefined, { difficulty: 'ZS', steep: [0, 0, 0] })).toMatchObject({ color: 'red', area: 1 });
    expect(grmColour(3, undefined, { difficulty: 'L', steep: [0, 3, 3] })).toMatchObject({ color: 'orange', slopeText: 'SAC-Grad L (bis 28°) + 5° für den ganzen Hang' });
    expect(grmColour(4, undefined, { difficulty: 'L' })).toMatchObject({ color: 'red', area: 2 });
    // without grade and without terrain data: no colour (fail closed)
    expect(grmColour(3, undefined, {})).toBeUndefined();
    expect(grmColour(1, undefined, {})).toBeUndefined();
  });

  it('sehr gross is always red; the more cautious colour wins', () => {
    expect(grmColour(5, undefined, { steep: [0, 0, 0] })!.color).toBe('red');
    expect(worse('green', 'orange')).toBe('orange');
    expect(worse('red', 'orange')).toBe('red');
  });
});

describe('own calculation – fail closed', () => {
  const c = tours[0]!;
  it('no colour without bulletin or without terrain data', () => {
    expect(grmEntry({ id: c.id, steep: [0, 0, 0] }, undefined, TODAY)).toBeUndefined();
    expect(grmEntry({ id: c.id }, danger(1), TODAY)).toBeUndefined();
    expect(all(run({ steep: [0, 0, 0] })).filter((s) => s.risk.applies && !s.risk.signposted)).toEqual([]);
    expect(all(run({ d: danger(1) })).filter((s) => s.risk.applies && !s.risk.signposted)).toEqual([]);
  });

  it('a computed colour from another day does not count', () => {
    const e = grmEntry({ id: c.id, steep: [0, 0, 0] }, danger(1), addDays(TODAY, -1))!;
    expect(resolveRisk(c, [], TODAY, e).kind).toBe('unknown');
  });

  it('with bulletin and terrain, tours get a colour and can be suggested', () => {
    const r = run({ steep: [0, 0, 0], d: danger(1) });
    const t = all(r).filter((s) => s.risk.applies && !s.risk.signposted);
    expect(t.length).toBeGreaterThan(0);
    for (const s of t) {
      expect(s.risk).toMatchObject({ color: 'green', source: 'grm' });
      expect(s.risk.label).toContain('Berechnet');
      expect(s.risk.grmNote).toContain('unter 30°');
      expect(s.risk.bulletinHint).toContain('SLF-Lawinenbulletin');
      expect(s.risk.dangerLevel).toBe(1);
    }
  });
});

describe('own calculation and entered colour', () => {
  const c = tours[0]!;
  const calc = (color: 'green' | 'orange' | 'red'): RiskEntry => ({ candidateId: c.id, color, date: TODAY, source: GRM_SOURCE });
  const manual = (color: 'green' | 'orange' | 'red'): RiskEntry => ({ candidateId: c.id, color, date: TODAY, source: MANUAL_SOURCE });

  it('the more cautious colour counts, in both directions', () => {
    const a = resolveRisk(c, [manual('red')], TODAY, calc('green'));
    expect(a.kind === 'known' && a.entry.color).toBe('red');
    const b = resolveRisk(c, [manual('green')], TODAY, calc('orange'));
    expect(b.kind === 'known' && b.entry.color).toBe('orange');
    expect(b.kind === 'known' && b.entry.source).toBe(GRM_SOURCE);
  });

  it('an entered green cannot lift a computed red into the suggestions of level 2', () => {
    const risks = tours.map((t) => ({ ...manual('green'), candidateId: t.id }));
    const r = run({ steep: [5, 5, 5], d: danger(2), risks, level: 2 });
    expect(all(r).filter((s) => s.risk.applies && !s.risk.signposted)).toEqual([]);
  });

  it('when both differ, the suggestion says so', () => {
    const risks = tours.map((t) => ({ ...manual('green'), candidateId: t.id }));
    const r = run({ steep: [1, 1, 1], d: danger(2), risks, level: 3 });
    const t = all(r).find((s) => s.risk.applies && !s.risk.signposted)!;
    expect(t.risk.color).toBe('orange');
    expect(t.risk.bothNote).toBe('Skitourenguru: grün – die vorsichtigere Farbe gilt.');
  });
});

describe('own calculation – levels, red, freshness', () => {
  it('level 1 sees only green, level 2 also orange', () => {
    const orange = run({ steep: [1, 1, 1], d: danger(2), level: 1 });
    expect(all(orange).filter((s) => s.risk.applies && !s.risk.signposted)).toEqual([]);
    const l2 = run({ steep: [1, 1, 1], d: danger(2), level: 2 });
    expect(all(l2).some((s) => s.risk.color === 'orange')).toBe(true);
  });

  it('computed red only at level 3 with confirmation, with the group note', () => {
    expect(all(run({ steep: [3, 3, 3], d: danger(2), level: 3, confirmed: false, onlyTours: true })).filter((s) => s.risk.color === 'red')).toEqual([]);
    const red = all(run({ steep: [3, 3, 3], d: danger(2), level: 3, confirmed: true, onlyTours: true })).filter((s) => s.risk.color === 'red');
    expect(red.length).toBeGreaterThan(0);
    for (const s of red) expect(s.risk.groupNote).toBe('Nur in Gruppen mit geschulten Leuten, nie allein.');
  });

  it('Thursday bulletin for a Saturday tour: re-check on the eve; covered day: no note', () => {
    const notYet = all(run({ steep: [0, 0, 0], d: danger(1, undefined, false) })).find((s) => s.risk.source === 'grm' && s.date === SAT);
    if (notYet) {
      expect(notYet.risk.freshnessNote).toContain('am Vorabend neu prüfen');
      expect(notYet.risk.dangerLabel).toContain('am Vorabend neu prüfen');
    }
    const covered = all(run({ steep: [0, 0, 0], d: danger(1) })).find((s) => s.risk.source === 'grm' && s.date === SAT);
    if (covered) expect(covered.risk.freshnessNote).toBe('');
  });

  it('fuzz: computed colours always respect level and confirmation', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
    for (let i = 0; i < 150; i++) {
      const level = (1 + Math.floor(rnd() * 5)) as DangerLevel;
      const sub = (['minus', 'neutral', 'plus', undefined] as const)[Math.floor(rnd() * 4)];
      const steep = [0, 1, 2].map(() => Math.floor(rnd() * 6)) as [number, number, number];
      const prof = (1 + Math.floor(rnd() * 3)) as RiskLevel;
      const confirmed = rnd() < 0.5;
      const r = run({ steep, d: danger(level, sub), level: prof, confirmed });
      for (const s of all(r)) {
        if (!s.risk.applies || s.risk.signposted) continue;
        expect(s.risk.color).toBeDefined();
        expect(allowedColors(prof)).toContain(s.risk.color);
        if (s.risk.color === 'red') expect(confirmed).toBe(true);
        expect(s.risk.color).toBe(grmColour(level, sub, { steep })!.color);
      }
    }
  });
});

// Keep the type import used (Candidate) for readers of the fixtures.
export type { Candidate };
