// Safety rules (non-negotiable). See CLAUDE.md «Sicherheit».
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SAT, TODAY, candidates, context, freshRisks, input, profile, withLevel } from './__fixtures__/scenario';
import { eveningCheck } from './eveningCheck';
import { MANUAL_SOURCE, allowedColors, needsAvalancheRating, resolveRisk } from './risk';
import { suggest } from './suggest';
import * as texts from './texts';
import type { Candidate, RiskColor, RiskEntry, RiskLevel, Suggestion, SuggestionResult } from './types';
import { addDays } from './util';

const FORBIDDEN = /\bsicher(e|er|es|en|em)?\b/i;

const tours = candidates.filter(needsAvalancheRating);
const allSuggested = (r: SuggestionResult): Suggestion[] => [...r.suggestions, ...(r.planB ? [r.planB] : [])];

/** Only one avalanche-dependent candidate, perfect weather: the engine is tempted to suggest it. */
function onlyTour(tourId: string, risks: RiskEntry[], level: RiskLevel = 3, confirmed = true) {
  const c = candidates.find((x) => x.id === tourId) as Candidate;
  return suggest(
    context({
      candidates: [c],
      riskEntries: risks,
      profile: withLevel(profile, level),
      input: { ...input, trainedGroupConfirmed: confirmed },
    }),
  );
}

describe('rule 1 – never «sicher»', () => {
  it('no engine source file contains the word outside comments', () => {
    const dir = __dirname;
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f) && !/\.test\.ts$/.test(f)) files.push(p);
      }
    };
    walk(join(dir, '..'));
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) {
      const code = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      expect(code, f).not.toMatch(FORBIDDEN);
    }
  });

  it('no text constant or template contains it', () => {
    const strings: string[] = [];
    const collect = (v: unknown) => {
      if (typeof v === 'string') strings.push(v);
      else if (typeof v === 'function') {
        for (const arg of [0, 1, 0.95, 'sat', 'sun', 'green', 'orange', 'red', 'Spot']) {
          try {
            collect((v as (a: unknown, b?: unknown, c?: unknown) => unknown)(arg, arg, arg));
          } catch {
            /* some templates need other argument types */
          }
        }
      } else if (v && typeof v === 'object') Object.values(v).forEach(collect);
    };
    collect(texts);
    expect(strings.length).toBeGreaterThan(30);
    for (const s of strings) expect(s).not.toMatch(FORBIDDEN);
  });

  it('no generated suggestion text contains it', () => {
    const result = suggest(context());
    const json = JSON.stringify(result);
    expect(json).not.toMatch(FORBIDDEN);
  });

  it('green is phrased as «geringes Risiko laut Skitourenguru»', () => {
    expect(texts.riskLabel('green')).toContain('geringes Risiko laut Skitourenguru');
  });
});

describe('rule 2 – risk only from Skitourenguru colours', () => {
  it('without an entry, a tour has no colour and is not suggested, whatever the weather', () => {
    for (const t of tours) {
      const r = onlyTour(t.id, []);
      expect(allSuggested(r)).toHaveLength(0);
      expect(r.excluded.every((e) => e.reasons.includes('risk_unknown'))).toBe(true);
    }
  });

  it('the colour shown is exactly the entered colour', () => {
    for (const color of ['green', 'orange', 'red'] as RiskColor[]) {
      const r = onlyTour('schwarzhorn', [{ candidateId: 'schwarzhorn', color, date: TODAY, source: MANUAL_SOURCE }]);
      expect(r.suggestions[0]?.risk.color).toBe(color);
    }
  });
});

describe('rule 3 – fail closed on missing or stale risk', () => {
  it('an entry from yesterday counts as unknown', () => {
    const yesterday = addDays(TODAY, -1);
    const r = onlyTour('schwarzhorn', [{ candidateId: 'schwarzhorn', color: 'green', date: yesterday, source: MANUAL_SOURCE }]);
    expect(allSuggested(r)).toHaveLength(0);
    expect(r.excluded[0]?.reasons).toContain('risk_stale');
  });

  it('an entry dated in the future is not accepted', () => {
    const c = candidates.find((x) => x.id === 'schwarzhorn') as Candidate;
    const status = resolveRisk(c, [{ candidateId: c.id, color: 'green', date: addDays(TODAY, 1), source: MANUAL_SOURCE }], TODAY);
    expect(status.kind).toBe('unknown');
  });

  it('an invalid colour value is treated as unknown', () => {
    const c = candidates.find((x) => x.id === 'schwarzhorn') as Candidate;
    const bad = { candidateId: c.id, color: 'yellow', date: TODAY, source: MANUAL_SOURCE } as unknown as RiskEntry;
    expect(resolveRisk(c, [bad], TODAY).kind).toBe('unknown');
  });

  it('the newest entry wins: a fresh red overrides an old green', () => {
    const r = onlyTour(
      'schwarzhorn',
      [
        { candidateId: 'schwarzhorn', color: 'green', date: addDays(TODAY, -2), source: MANUAL_SOURCE },
        { candidateId: 'schwarzhorn', color: 'red', date: TODAY, source: MANUAL_SOURCE },
      ],
      2,
    );
    expect(allSuggested(r)).toHaveLength(0);
  });

  it('unsignposted snowshoe trails need a fresh colour, signposted ones do not', () => {
    const fron = onlyTour('fronalpstock', []);
    expect(allSuggested(fron)).toHaveLength(0);
    const iber = onlyTour('ibergeregg', []);
    expect(iber.suggestions.length).toBeGreaterThan(0);
    expect(iber.suggestions[0]?.risk.label).toBe(texts.SIGNPOSTED_LABEL);
  });

  it('evening check: Thursday entries are not valid on Friday', () => {
    const thursday = suggest(context());
    const plan = thursday.suggestions.find((s) => s.avalancheDependent) as Suggestion;
    expect(plan).toBeDefined();
    const friday = addDays(TODAY, 1);
    const check = eveningCheck(context({ today: friday, riskEntries: freshRisks(TODAY) }), plan);
    expect(check.status).toBe('switch');
    if (check.status === 'switch') {
      expect(check.reason).toBe(texts.CHECK_REASON.riskMissing);
      expect(check.alternative?.avalancheDependent ?? false).toBe(false);
    }
  });

  it('fuzz: no suggestion or Plan B ever depends on a missing, stale or disallowed colour', () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const colors: (RiskColor | undefined)[] = ['green', 'orange', 'red', undefined];
    for (let i = 0; i < 300; i++) {
      const level = (1 + Math.floor(rnd() * 3)) as RiskLevel;
      const confirmed = rnd() < 0.5;
      const entries: RiskEntry[] = [];
      for (const t of tours) {
        const color = colors[Math.floor(rnd() * colors.length)];
        if (!color) continue;
        const age = rnd() < 0.3 ? -Math.ceil(rnd() * 3) : 0;
        entries.push({ candidateId: t.id, color, date: addDays(TODAY, age), source: MANUAL_SOURCE });
      }
      const result = suggest(
        context({ riskEntries: entries, profile: withLevel(profile, level), input: { ...input, trainedGroupConfirmed: confirmed } }),
      );
      for (const s of allSuggested(result)) {
        if (!s.avalancheDependent) continue;
        const entry = entries.filter((e) => e.candidateId === s.candidateId).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
        expect(entry, s.id).toBeDefined();
        expect(entry?.date).toBe(TODAY);
        expect(allowedColors(level)).toContain(entry?.color);
        if (entry?.color === 'red') expect(confirmed).toBe(true);
        expect(s.risk.color).toBe(entry?.color);
      }
    }
  });
});

describe('rule 4 – filter by risk level', () => {
  it.each([
    [1, ['green']],
    [2, ['green', 'orange']],
    [3, ['green', 'orange', 'red']],
  ] as const)('level %i allows %j', (level, expected) => {
    expect(allowedColors(level)).toEqual(expected);
  });

  it('level 1 hides orange tours, level 2 shows them', () => {
    const risks = [{ candidateId: 'pizol', color: 'orange' as const, date: TODAY, source: MANUAL_SOURCE }];
    expect(allSuggested(onlyTour('pizol', risks, 1))).toHaveLength(0);
    expect(onlyTour('pizol', risks, 1).excluded[0]?.reasons).toContain('risk_above_level');
    expect(onlyTour('pizol', risks, 2).suggestions).toHaveLength(1);
  });

  it('level 2 hides red tours even with a trained group', () => {
    const risks = [{ candidateId: 'pizol', color: 'red' as const, date: TODAY, source: MANUAL_SOURCE }];
    expect(allSuggested(onlyTour('pizol', risks, 2, true))).toHaveLength(0);
  });
});

describe('rule 5 – red only with confirmation', () => {
  const risks = [{ candidateId: 'pizol', color: 'red' as const, date: TODAY, source: MANUAL_SOURCE }];

  it('level 3 without confirmation hides red tours', () => {
    const r = onlyTour('pizol', risks, 3, false);
    expect(allSuggested(r)).toHaveLength(0);
    expect(r.excluded[0]?.reasons).toContain('risk_red_unconfirmed');
  });

  it('level 3 with confirmation shows red tours with the group note', () => {
    const s = onlyTour('pizol', risks, 3, true).suggestions[0];
    expect(s?.risk.color).toBe('red');
    expect(s?.risk.groupNote).toBe('Nur in Gruppen mit geschulten Leuten, nie allein.');
    expect(s?.risk.label).toContain('nie allein');
  });

  it('the confirmation question is worded as required', () => {
    expect(texts.TRAINED_GROUP_QUESTION).toBe('Du bist in einer geschulten Gruppe?');
  });
});

describe('rule 6 – risk info is always visible on tours and snowshoe trails', () => {
  it('every tour or trail suggestion carries colour, danger level and bulletin hint', () => {
    const r = suggest(context({ profile: withLevel(profile, 3), input: { ...input, trainedGroupConfirmed: true } }));
    const sports = [...r.suggestions, ...(r.planB ? [r.planB] : [])].filter((s) => s.activity === 'ski_tour' || s.activity === 'snowshoe');
    for (const s of suggest(context({ candidates: candidates.filter((c) => c.kind === 'ski_tour' || c.kind === 'snowshoe_trail') })).suggestions) sports.push(s);
    expect(sports.length).toBeGreaterThan(0);
    for (const s of sports) {
      expect(s.risk.applies).toBe(true);
      expect(s.risk.label.length).toBeGreaterThan(0);
      expect(s.risk.bulletinHint).toBe(texts.BULLETIN_HINT);
      expect(s.risk.dangerLabel).toMatch(/Gefahrenstufe/);
      if (!s.risk.signposted) {
        expect(s.risk.color).toBeDefined();
        expect(s.risk.freshnessNote).toMatch(/^Stand /);
      }
    }
  });

  it('a Thursday entry for a Saturday tour asks to re-check on the eve', () => {
    const s = onlyTour('schwarzhorn', freshRisks()).suggestions.find((x) => x.date === SAT);
    expect(s?.risk.freshnessNote).toContain('am Vorabend neu prüfen');
  });

  it('the danger level is shown when entered', () => {
    const s = onlyTour('schwarzhorn', freshRisks()).suggestions[0];
    expect(s?.risk.dangerLabel).toBe('Gefahrenstufe 2 laut Bulletin');
  });
});

describe('sports and levels per activity', () => {
  it('a disabled sport is never suggested', () => {
    const p = { ...profile, activities: { ...profile.activities, ski_tour: { enabled: false, level: 2 as const } } };
    const r = suggest(context({ profile: p }));
    expect([...r.suggestions, ...(r.planB ? [r.planB] : [])].some((s) => s.activity === 'ski_tour')).toBe(false);
    expect(r.excluded.filter((e) => e.candidateId === 'schwarzhorn').every((e) => e.reasons.includes('activity_disabled'))).toBe(true);
  });

  it('the level of each activity limits its own colours', () => {
    // Ski tours level 1 (green only), snowshoe level 2: orange snowshoe allowed, orange tour not.
    const p = { ...profile, activities: { ...profile.activities, ski_tour: { enabled: true, level: 1 as const }, snowshoe: { enabled: true, level: 2 as const } } };
    const risks = [
      { candidateId: 'pizol', color: 'orange' as const, date: TODAY, source: MANUAL_SOURCE },
      { candidateId: 'fronalpstock', color: 'orange' as const, date: TODAY, source: MANUAL_SOURCE },
    ];
    const ex = (id: string) => suggest(context({ profile: p, riskEntries: risks })).excluded.filter((e) => e.candidateId === id).flatMap((e) => e.reasons);
    expect(ex('pizol')).toContain('risk_above_level');
    expect(ex('fronalpstock')).not.toContain('risk_above_level');
  });
});
