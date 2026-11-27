import { describe, expect, it } from 'vitest';
import { OVERCAST, SAT, STORM, SUN, SUNNY, TODAY, buildWeather, candidates, context, freshRisks, goodWeather, input, profile } from './__fixtures__/scenario';
import { eveningCheck } from './eveningCheck';
import { capacity, feedbackAdjustment, fitScore } from './fit';
import { MANUAL_SOURCE } from './risk';
import { evaluateOptions, suggest, travelFor } from './suggest';
import { feedbackStats } from './stats';
import { CHECK_HOLDS, CHECK_REASON, PLAN_B_REASON } from './texts';
import type { Candidate, Feedback, Suggestion } from './types';
import { addDays, haversineKm } from './util';

const byId = (id: string) => candidates.find((c) => c.id === id) as Candidate;
const reasonsFor = (ctx: ReturnType<typeof context>, id: string) =>
  evaluateOptions(ctx).excluded.filter((e) => e.candidateId === id).flatMap((e) => e.reasons);

describe('stage 1 – exclusion', () => {
  it('missing equipment', () => {
    const ctx = context({ profile: { ...profile, equipment: ['alpine_ski', 'camera'] } });
    expect(reasonsFor(ctx, 'schwarzhorn')).toContain('equipment_missing');
    expect(reasonsFor(ctx, 'ibergeregg')).toContain('equipment_missing');
    expect(reasonsFor(ctx, 'flumserberg')).not.toContain('equipment_missing');
  });

  it('unsignposted trails need avalanche equipment, signposted ones do not', () => {
    const ctx = context({ profile: { ...profile, equipment: ['snowshoes'] } });
    expect(reasonsFor(ctx, 'fronalpstock')).toContain('equipment_missing');
    expect(reasonsFor(ctx, 'ibergeregg')).not.toContain('equipment_missing');
  });

  it('travel longer than the maximum', () => {
    const ctx = context({ input: { ...input, maxTravelHours: 1 } });
    expect(reasonsFor(ctx, 'schwarzhorn')).toContain('travel_too_long');
    expect(reasonsFor(ctx, 'flumserberg')).not.toContain('travel_too_long');
  });

  it('travel is estimated when no manual time exists for the start point', () => {
    const t = travelFor(byId('flumserberg'), { id: 'x', name: 'X', lat: 47.3769, lon: 8.5417 });
    expect(t.estimated).toBe(true);
    expect(t.minutes).toBeGreaterThan(60);
    expect(t.minutes).toBeLessThan(150);
  });

  it('free days are never planned', () => {
    const r = suggest(context({ input: { ...input, budget: { sat: 'free', sun: 'full' } } }));
    expect(r.suggestions.every((s) => s.day === 'sun')).toBe(true);
    expect(r.planB?.day ?? 'sun').toBe('sun');
  });

  it('half a day is too short for a long tour with a long drive', () => {
    const ctx = context({ input: { ...input, budget: { sat: 'half', sun: 'half' } } });
    expect(reasonsFor(ctx, 'pizol')).toContain('time_budget');
    // short signposted trail close by still fits
    expect(evaluateOptions(ctx).valid.some((o) => o.option.candidate.id === 'ibergeregg')).toBe(true);
  });

  it('start before the earliest allowed time', () => {
    const ctx = context({ profile: { ...profile, earliestStart: 7 * 60 } });
    const ex = evaluateOptions(ctx).excluded.filter((e) => e.candidateId === 'rigi' && e.slot === 'morning');
    expect(ex.length).toBe(2);
    expect(ex.every((e) => e.reasons.includes('start_too_early'))).toBe(true);
  });

  it('day form «locker» excludes tours beyond the reduced capacity', () => {
    const ctx = context({ input: { ...input, dayForm: 'easy' } });
    expect(reasonsFor(ctx, 'pizol')).toContain('fitness'); // 1200 m > 1500 × 0.7
    expect(reasonsFor(ctx, 'ibergeregg')).not.toContain('fitness');
  });

  it('inactive candidates are excluded', () => {
    const ctx = context({ candidates: candidates.map((c) => (c.id === 'laax' ? { ...c, active: false } : c)) });
    expect(reasonsFor(ctx, 'laax')).toContain('inactive');
  });

  it('missing weather data excludes (fail closed)', () => {
    const ctx = context({ weather: {} });
    const r = suggest(ctx);
    expect(r.suggestions).toHaveLength(0);
    expect(r.excluded.length).toBeGreaterThan(0);
    expect(r.excluded.filter((e) => !e.reasons.includes('day_free')).every((e) => e.reasons.includes('weather_missing'))).toBe(true);
  });

  it('storm excludes everything outdoors', () => {
    const r = suggest(context({ weather: buildWeather(candidates, () => STORM) }));
    expect(r.suggestions).toHaveLength(0);
  });
});

describe('stage 4 – selection', () => {
  const result = suggest(context());

  it('returns 3 suggestions with different candidates', () => {
    expect(result.suggestions).toHaveLength(3);
    expect(new Set(result.suggestions.map((s) => s.candidateId)).size).toBe(3);
  });

  it('suggestions differ in activity, place or day', () => {
    const [a, b, c] = result.suggestions as [Suggestion, Suggestion, Suggestion];
    const differs = (x: Suggestion, y: Suggestion) => x.activity !== y.activity || x.day !== y.day || x.candidateId !== y.candidateId;
    expect(differs(a, b) && differs(a, c) && differs(b, c)).toBe(true);
    expect(new Set(result.suggestions.map((s) => s.activity)).size).toBeGreaterThanOrEqual(2);
  });

  it('each suggestion has a 1–2 sentence reasoning and a schedule', () => {
    for (const s of [...result.suggestions, result.planB!]) {
      expect(s.reasons.length).toBeGreaterThanOrEqual(1);
      expect(s.reasons.length).toBeLessThanOrEqual(2);
      for (const r of s.reasons) expect(r).toMatch(/^[A-ZÄÖÜ0-9].*\.$/);
      expect(s.schedule.length).toBeGreaterThanOrEqual(3);
      const times = s.schedule.map((i) => i.time);
      expect([...times].sort((x, y) => x - y)).toEqual(times);
      expect(s.schedule[0]?.label).toMatch(/^Abfahrt /);
      expect(s.schedule.at(-1)?.label).toMatch(/^Ankunft /);
    }
  });

  it('suggestions are sorted by score', () => {
    const scores = result.suggestions.map((s) => s.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('mix: one new option among proven ones', () => {
    expect(result.suggestions.filter((s) => s.isNew)).toHaveLength(1);
  });

  it('mix: a proven option is brought in if all top options are new', () => {
    const allNew = candidates.map((c) => ({ ...c, done: c.id === 'rigi' }));
    const r = suggest(context({ candidates: allNew }));
    expect(r.suggestions.filter((s) => !s.isNew).length).toBeGreaterThanOrEqual(1);
  });

  it('Plan B: different candidate; avalanche-free when suggestion 1 is a tour', () => {
    const first = result.suggestions[0]!;
    const b = result.planB!;
    expect(b).toBeDefined();
    expect(b.candidateId).not.toBe(first.candidateId);
    if (first.avalancheDependent) {
      expect(b.avalancheDependent).toBe(false);
      expect(b.planBReason).toBe(PLAN_B_REASON.avalanche);
    }
  });

  it('Plan B for a ski day on Saturday moves to another day when the weather turns', () => {
    const onlySat = (c: Candidate, d: string, p: 'valley' | 'summit') => (d === SAT ? goodWeather(c, d, p) : { ...SUNNY, cloudCover: 60, sunshineMinutes: 25 });
    const r = suggest(
      context({
        candidates: candidates.filter((c) => c.kind === 'ski_resort' || c.kind === 'photo_spot'),
        weather: buildWeather(candidates, onlySat),
      }),
    );
    expect(r.planB).toBeDefined();
    expect([PLAN_B_REASON.weather('sat'), PLAN_B_REASON.weather('sun'), PLAN_B_REASON.generic]).toContain(r.planB!.planBReason);
  });

  it('sport suggestions get a nearby photo spot with a light time', () => {
    const r = suggest(context({ candidates: candidates.filter((c) => c.id === 'flumserberg' || c.kind === 'photo_spot') }));
    const ski = r.suggestions.find((s) => s.candidateId === 'flumserberg')!;
    expect(ski.photo?.spotId).toBe('chaeserrugg');
    expect(ski.activityLabel).toBe('Ski + Foto');
    expect(ski.schedule.some((i) => i.label.includes('Fotospot Chäserrugg'))).toBe(true);
    const spot = byId('chaeserrugg');
    expect(haversineKm(spot.summit, byId('flumserberg').summit)).toBeLessThan(15);
  });

  it('no photo add-on without a camera', () => {
    const r = suggest(context({ profile: { ...profile, equipment: profile.equipment.filter((e) => e !== 'camera') } }));
    expect(r.suggestions.every((s) => !s.photo && s.activity !== 'photo')).toBe(true);
  });

  it('price is passed through for resorts', () => {
    const r = suggest(context({ candidates: candidates.filter((c) => c.id === 'laax') }));
    expect(r.suggestions[0]?.priceChf).toBe(89);
  });
});

describe('stage 3 – fit', () => {
  it('feedback shifts the capacity, capped at ±15 %', () => {
    const fb = (strictness: Feedback['strictness']): Feedback => ({ weekend: SAT, implemented: true, fittingSuggestions: 2, ...(strictness ? { strictness } : {}) });
    expect(feedbackAdjustment([fb('too_easy')])).toBeCloseTo(0.05);
    expect(feedbackAdjustment([fb('too_hard'), fb('too_hard')])).toBeCloseTo(-0.1);
    expect(feedbackAdjustment(Array.from({ length: 10 }, () => fb('too_easy')))).toBeCloseTo(0.15);
    expect(feedbackAdjustment([fb('fitting'), fb(undefined)])).toBe(0);
    const cap = capacity(profile, 'normal', Array.from({ length: 5 }, () => fb('too_hard')));
    expect(cap.maxElevationGain).toBeCloseTo(1500 * 0.85);
  });

  it('a tour in the ideal load range fits best', () => {
    const cap = capacity(profile, 'normal', []);
    expect(fitScore(byId('schwarzhorn'), cap, 'normal')).toBe(100);
    expect(fitScore(byId('ibergeregg'), cap, 'normal')).toBeLessThan(100);
  });
});

describe('evening check', () => {
  const thursday = suggest(context());
  const tour = thursday.suggestions.find((s) => s.avalancheDependent)!;
  const friday = addDays(TODAY, 1);

  it('plan holds with a fresh colour and stable weather', () => {
    const r = eveningCheck(context({ today: friday, riskEntries: freshRisks(friday) }), tour);
    expect(r.status).toBe('holds');
    expect(CHECK_HOLDS).toBe('Plan steht.');
  });

  it('switches to Plan B when the risk rises above the level', () => {
    const risks = freshRisks(friday).map((e) => (e.candidateId === tour.candidateId ? { ...e, color: 'red' as const } : e));
    const r = eveningCheck(context({ today: friday, riskEntries: risks }), tour, thursday.planB);
    expect(r.status).toBe('switch');
    if (r.status === 'switch') {
      expect(r.reason).toBe(CHECK_REASON.riskAbove);
      expect(r.alternative).toBeDefined();
      expect(r.alternative?.candidateId).not.toBe(tour.candidateId);
    }
  });

  it('switches when the weather gets worse', () => {
    const worse = buildWeather(candidates, (c, d, p) => (c.id === tour.candidateId ? OVERCAST : goodWeather(c, d, p)));
    const r = eveningCheck(context({ today: friday, riskEntries: freshRisks(friday), weather: worse }), tour);
    expect(r.status).toBe('switch');
    if (r.status === 'switch') expect(r.reason).toBe(CHECK_REASON.weatherWorse);
  });

  it('only the plan date is considered for alternatives', () => {
    const risks = freshRisks(friday).filter((e) => e.candidateId !== tour.candidateId);
    const r = eveningCheck(context({ today: friday, riskEntries: risks }), tour);
    if (r.status === 'switch' && r.alternative) expect(r.alternative.date).toBe(tour.date);
  });

  it('a stored Plan B is kept when it is still valid', () => {
    const b = thursday.planB!;
    if (b.date !== tour.date) return; // only comparable on the same date
    const r = eveningCheck(context({ today: friday, riskEntries: [] }), tour, b);
    if (r.status === 'switch') expect(r.alternative?.id).toBe(b.id);
  });

  it('Sunday plan is checked on Saturday', () => {
    const sunPlan = thursday.suggestions.find((s) => s.date === SUN) ?? thursday.planB!;
    const r = eveningCheck(context({ today: SAT, riskEntries: freshRisks(SAT) }), sunPlan);
    expect(['holds', 'switch']).toContain(r.status);
  });
});

describe('stats', () => {
  it('implementation rate and average fitting suggestions', () => {
    const s = feedbackStats([
      { weekend: '2026-12-05', implemented: true, fittingSuggestions: 3 },
      { weekend: '2026-12-12', implemented: false, reasonIfNot: 'krank', fittingSuggestions: 1 },
    ]);
    expect(s.implementationRate).toBe(0.5);
    expect(s.averageFitting).toBe(2);
    expect(feedbackStats([]).implementationRate).toBeUndefined();
  });

  it('risk source is labelled as manual Skitourenguru entry', () => {
    expect(MANUAL_SOURCE).toBe('Skitourenguru (manuell)');
  });
});
