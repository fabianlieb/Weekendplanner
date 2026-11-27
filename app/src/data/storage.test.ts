import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { candidates, freshRisks, input, profile } from '../engine/__fixtures__/scenario';
import { BACKUP_FORMAT, exportData, importJson, validateImport } from './backup';
import { PlannerDB } from './db';
import { ManualRiskProvider } from './manualRiskProvider';
import { adoptAlternative, chosenSuggestion, computeSuggestions, feedbackWeekend, runEveningCheck, summariseExclusions, weekendKey } from './planner';
import {
  DEFAULT_PROFILE,
  choosePlan,
  deleteCandidate,
  getLastInput,
  getProfile,
  listCandidates,
  listFeedback,
  riskEntriesOn,
  saveCandidate,
  saveFeedback,
  saveLastInput,
  saveProfile,
  setDone,
  setRisk,
} from './repositories';
import { loadWeather } from './weatherService';
import { fakeFetch } from './__fixtures__/openMeteoResponse';

let db: PlannerDB;
let n = 0;
beforeEach(async () => {
  db = new PlannerDB(`test-${n++}`);
  await db.open();
});
afterEach(async () => {
  await db.delete();
});

// Thursday 2026-12-03, 18:00 in Zurich
const THURSDAY = new Date('2026-12-03T17:00:00Z');
const FRIDAY = new Date('2026-12-04T17:00:00Z');
const weatherFetch = (calls: { url: string }[] = []) => fakeFetch({ start: '2026-11-30', days: 11, primaryHours: 24 * 7 }, calls);

async function seed() {
  await saveProfile(db, profile);
  for (const c of candidates) await saveCandidate(db, c);
  for (const r of freshRisks('2026-12-03')) await setRisk(db, r.candidateId, r.date, r.color, r.dangerLevel, THURSDAY);
}

describe('repositories', () => {
  it('returns the conservative default profile until one is saved', async () => {
    expect(await getProfile(db)).toEqual(DEFAULT_PROFILE);
    expect(DEFAULT_PROFILE.riskLevel).toBe(1);
    await saveProfile(db, profile);
    expect(await getProfile(db)).toEqual(profile);
  });

  it('never stores the trained-group confirmation', async () => {
    await saveLastInput(db, { ...input, trainedGroupConfirmed: true });
    expect((await getLastInput(db))?.trainedGroupConfirmed).toBe(false);
  });

  it('candidates: save, mark done, delete (with its risk entries)', async () => {
    await seed();
    expect(await listCandidates(db)).toHaveLength(candidates.length);
    await setDone(db, 'laax', true);
    expect((await db.candidates.get('laax'))?.done).toBe(true);
    await deleteCandidate(db, 'schwarzhorn');
    expect(await db.candidates.get('schwarzhorn')).toBeUndefined();
    expect(await db.riskEntries.where('candidateId').equals('schwarzhorn').count()).toBe(0);
  });

  it('risk: one entry per tour and day, a new tap replaces it', async () => {
    await setRisk(db, 'pizol', '2026-12-03', 'green');
    await setRisk(db, 'pizol', '2026-12-03', 'orange', 3);
    await setRisk(db, 'pizol', '2026-12-04', 'red');
    const thu = await riskEntriesOn(db, '2026-12-03');
    expect(thu).toHaveLength(1);
    expect(thu[0]).toMatchObject({ color: 'orange', dangerLevel: 3, source: 'Skitourenguru (manuell)' });
  });

  it('manual risk provider returns all entries of the requested candidates', async () => {
    await seed();
    const entries = await new ManualRiskProvider(db).getEntries(['schwarzhorn', 'pizol']);
    expect(entries.map((e) => e.candidateId).sort()).toEqual(['pizol', 'schwarzhorn']);
    expect(entries[0]).not.toHaveProperty('key');
  });

  it('feedback is listed by weekend', async () => {
    await saveFeedback(db, { weekend: '2026-12-12', implemented: false, fittingSuggestions: 1, reasonIfNot: 'krank' });
    await saveFeedback(db, { weekend: '2026-12-05', implemented: true, fittingSuggestions: 3, strictness: 'fitting' });
    expect((await listFeedback(db)).map((f) => f.weekend)).toEqual(['2026-12-05', '2026-12-12']);
  });
});

describe('weather cache', () => {
  it('fetches once and serves the cache while fresh', async () => {
    const calls: { url: string }[] = [];
    const first = await loadWeather(db, candidates, { now: THURSDAY, fetchFn: weatherFetch(calls) });
    expect(calls).toHaveLength(1);
    expect(first.weather['flumserberg']?.summit['2026-12-05']?.hours).toHaveLength(24);
    await loadWeather(db, candidates, { now: new Date(THURSDAY.getTime() + 30 * 60000), fetchFn: weatherFetch(calls) });
    expect(calls).toHaveLength(1);
    await loadWeather(db, candidates, { now: new Date(THURSDAY.getTime() + 3 * 3600000), fetchFn: weatherFetch(calls) });
    expect(calls).toHaveLength(2);
  });

  it('falls back to the cache when offline and says so', async () => {
    await loadWeather(db, candidates, { now: THURSDAY, fetchFn: weatherFetch() });
    const offline = async () => {
      throw new TypeError('Failed to fetch');
    };
    const r = await loadWeather(db, candidates, { now: FRIDAY, fetchFn: offline });
    expect(r.fromStaleCache).toBe(true);
    expect(r.error).toContain('Keine Verbindung');
    expect(r.fetchedAt).toBe(THURSDAY.toISOString());
    expect(r.weather['flumserberg']?.summit['2026-12-05']).toBeDefined();
  });

  it('without cache and offline there is no weather (engine then suggests nothing)', async () => {
    const offline = async () => {
      throw new TypeError('Failed to fetch');
    };
    const r = await loadWeather(db, candidates, { now: THURSDAY, fetchFn: offline });
    expect(r.fromStaleCache).toBe(false);
    expect(Object.keys(r.weather['flumserberg']?.summit ?? {})).toHaveLength(0);
  });

  it('identical points are requested only once', async () => {
    const calls: { url: string }[] = [];
    const twin = { ...candidates[0]!, id: 'twin' };
    await loadWeather(db, [candidates[0]!, twin], { now: THURSDAY, fetchFn: weatherFetch(calls) });
    expect(new URL(calls[0]!.url).searchParams.get('latitude')?.split(',')).toHaveLength(2);
  });
});

describe('planner (storage + weather + engine)', () => {
  it('Thursday: computes and stores 3 suggestions + Plan B', async () => {
    await seed();
    const { plan, weather } = await computeSuggestions(db, input, { now: THURSDAY, fetchFn: weatherFetch() });
    expect(plan.weekend).toBe('2026-12-05');
    expect(plan.computedOn).toBe('2026-12-03');
    expect(plan.suggestions).toHaveLength(3);
    expect(plan.planB).toBeDefined();
    expect(weather.error).toBeUndefined();
    expect(await db.weekendPlans.get('2026-12-05')).toBeDefined();
  });

  it('Friday evening check: without Friday colours a chosen tour switches to Plan B', async () => {
    await seed();
    const { plan } = await computeSuggestions(db, input, { now: THURSDAY, fetchFn: weatherFetch() });
    const tour = plan.suggestions.find((s) => s.avalancheDependent);
    expect(tour).toBeDefined();
    await choosePlan(db, plan.weekend, tour!.id);

    const noColours = await runEveningCheck(db, { now: FRIDAY, fetchFn: weatherFetch() });
    expect(noColours.status).toBe('checked');
    if (noColours.status === 'checked') expect(noColours.result.status).toBe('switch');

    for (const r of freshRisks('2026-12-04')) await setRisk(db, r.candidateId, r.date, r.color, r.dangerLevel, FRIDAY);
    const withColours = await runEveningCheck(db, { now: FRIDAY, fetchFn: weatherFetch() });
    if (withColours.status === 'checked') expect(withColours.result.status).toBe('holds');
    expect((await db.weekendPlans.get(plan.weekend))?.checks).toHaveLength(2);
  });

  it('evening check without a chosen plan asks to choose', async () => {
    await seed();
    await computeSuggestions(db, input, { now: THURSDAY, fetchFn: weatherFetch() });
    expect((await runEveningCheck(db, { now: FRIDAY, fetchFn: weatherFetch() })).status).toBe('no_choice');
  });

  it('recomputing keeps the chosen plan if it still exists', async () => {
    await seed();
    const { plan } = await computeSuggestions(db, input, { now: THURSDAY, fetchFn: weatherFetch() });
    await choosePlan(db, plan.weekend, plan.suggestions[0]!.id);
    const again = await computeSuggestions(db, input, { now: new Date(THURSDAY.getTime() + 60000), fetchFn: weatherFetch() });
    expect(chosenSuggestion(again.plan)?.id).toBe(plan.suggestions[0]!.id);
  });

  it('stores a summary of why candidates were not suggested', async () => {
    await seed();
    await db.riskEntries.clear();
    const { plan } = await computeSuggestions(db, input, { now: THURSDAY, fetchFn: weatherFetch() });
    expect(plan.excludedSummary?.risk_unknown).toBe(4); // 3 tours + 1 unsignposted trail without colour
    expect(plan.suggestions.every((s) => !s.avalancheDependent)).toBe(true);
  });

  it('summary counts only candidates without any valid option', () => {
    const ex = [
      { candidateId: 'a', day: 'sat' as const, slot: 'day' as const, reasons: ['travel_too_long' as const] },
      { candidateId: 'a', day: 'sun' as const, slot: 'day' as const, reasons: ['travel_too_long' as const, 'day_free' as const] },
      { candidateId: 'b', day: 'sat' as const, slot: 'day' as const, reasons: ['conditions_poor' as const] },
    ];
    expect(summariseExclusions(ex, new Set(['b']))).toEqual({ travel_too_long: 1 });
  });

  it('adopting an alternative from the evening check makes it the chosen Plan B', async () => {
    await seed();
    const { plan } = await computeSuggestions(db, input, { now: THURSDAY, fetchFn: weatherFetch() });
    const alt = { ...plan.suggestions[1]!, id: 'other:2026-12-05:day', candidateId: 'other' };
    await adoptAlternative(db, plan.weekend, alt);
    const stored = await db.weekendPlans.get(plan.weekend);
    expect(stored?.chosenId).toBe(alt.id);
    expect(stored?.planB?.id).toBe(alt.id);
    expect(chosenSuggestion(stored!)?.id).toBe(alt.id);
  });

  it('feedback refers to the current weekend on Sat/Sun, else the last one', () => {
    expect(feedbackWeekend('2026-12-05')).toBe('2026-12-05'); // Sat
    expect(feedbackWeekend('2026-12-06')).toBe('2026-12-05'); // Sun
    expect(feedbackWeekend('2026-12-07')).toBe('2026-12-05'); // Mon
    expect(feedbackWeekend('2026-12-11')).toBe('2026-12-05'); // Fri
  });

  it('weekend key', () => {
    expect(weekendKey('2026-12-03')).toBe('2026-12-05');
    expect(weekendKey('2026-12-06')).toBe('2026-12-06');
  });
});

describe('backup export/import', () => {
  it('round trip: export → import (replace) restores everything', async () => {
    await seed();
    await saveFeedback(db, { weekend: '2026-12-05', implemented: true, fittingSuggestions: 2, strictness: 'too_easy' });
    const backup = await exportData(db);
    expect(backup.format).toBe(BACKUP_FORMAT);
    const text = JSON.stringify(backup);

    const other = new PlannerDB(`test-restore-${n++}`);
    await other.open();
    await saveCandidate(other, { ...candidates[0]!, id: 'leftover' });
    const res = await importJson(other, text, 'replace');
    expect(res.ok).toBe(true);
    expect(await getProfile(other)).toEqual(profile);
    expect((await listCandidates(other)).map((c) => c.id).sort()).toEqual(candidates.map((c) => c.id).sort());
    expect(await other.riskEntries.count()).toBe(4);
    expect(await listFeedback(other)).toHaveLength(1);
    await other.delete();
  });

  it('merge keeps existing data', async () => {
    await saveCandidate(db, { ...candidates[0]!, id: 'mine' });
    const res = await importJson(db, JSON.stringify([candidates[1]]), 'merge');
    expect(res.ok).toBe(true);
    expect((await listCandidates(db)).map((c) => c.id).sort()).toEqual(['laax', 'mine']);
  });

  it('a minimal candidate list gets ids and defaults', () => {
    const r = validateImport({
      candidates: [
        {
          name: 'Rigi Kulm',
          kind: 'photo_spot',
          valley: { lat: 47.0856, lon: 8.4419, elevation: 440 },
          summit: { lat: 47.0567, lon: 8.485, elevation: 1797 },
          durationHours: 1.5,
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const c = r.data.candidates[0]!;
      expect(c.id).toMatch(/^c-/);
      expect(c).toMatchObject({ done: false, active: true, travelMinutes: {} });
    }
  });

  it('rejects invalid data with understandable messages', () => {
    const r = validateImport([{ name: '', kind: 'bike', valley: { lat: 200, lon: 9, elevation: 1 }, durationHours: 0 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const all = r.errors.join('\n');
      expect(all).toContain('Name fehlt');
      expect(all).toContain('Typ muss');
      expect(all).toContain('Breitengrad');
      expect(all).toContain('summit');
      expect(all).toContain('Dauer');
    }
  });

  it('tours need elevation gain; links must be http(s)', () => {
    const base = { ...candidates.find((c) => c.id === 'pizol')!, link: 'javascript:alert(1)' };
    const { elevationGain: _drop, ...noGain } = base;
    const r = validateImport([noGain]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join()).toContain('Höhenmeter fehlen');
      expect(r.errors.join()).toContain('Link muss');
    }
  });

  it('rejects invalid risk colours (no own risk values can be smuggled in)', () => {
    const r = validateImport({
      format: BACKUP_FORMAT,
      version: 1,
      candidates: [candidates[2]],
      riskEntries: [{ candidateId: candidates[2]!.id, color: 'yellow', date: '2026-12-03' }],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects non-JSON and unknown formats', async () => {
    expect((await importJson(db, 'not json', 'merge')).ok).toBe(false);
    expect(validateImport({ format: 'other' }).ok).toBe(false);
    expect(validateImport({ format: BACKUP_FORMAT, version: 99 }).ok).toBe(false);
  });

  it('duplicate ids are reported', () => {
    const r = validateImport([candidates[0], candidates[0]]);
    expect(r.ok).toBe(false);
  });
});
