import { describe, expect, it } from 'vitest';
import { OVERCAST, SAT, SUN, buildWeather, candidates, goodWeather } from './__fixtures__/scenario';
import { spotRadar } from './radar';

const fav = candidates.map((c) => ({ ...c, favorite: true }));

describe('spot radar', () => {
  it('reports favourite photo spots with a fog sea and the light time', () => {
    const hits = spotRadar({ candidates: fav, weather: buildWeather(fav, goodWeather), dates: [SAT, SUN] });
    const chaeserrugg = hits.find((h) => h.candidateId === 'chaeserrugg');
    expect(chaeserrugg).toBeDefined();
    expect(chaeserrugg!.headline).toMatch(/Nebelmeer wahrscheinlich · Sonnen(aufgang|untergang) \d\d:\d\d/);
  });

  it('never lists places in avalanche terrain (no colour, no «lohnt sich»)', () => {
    const hits = spotRadar({ candidates: fav, weather: buildWeather(fav, goodWeather), dates: [SAT, SUN] });
    expect(hits.some((h) => ['schwarzhorn', 'pizol', 'languard', 'fronalpstock'].includes(h.candidateId))).toBe(false);
  });

  it('only favourites, only good conditions, at most 6, one per place and day', () => {
    expect(spotRadar({ candidates, weather: buildWeather(candidates, goodWeather), dates: [SAT] })).toHaveLength(0);
    expect(spotRadar({ candidates: fav, weather: buildWeather(fav, () => OVERCAST), dates: [SAT, SUN] })).toHaveLength(0);
    const hits = spotRadar({ candidates: fav, weather: buildWeather(fav, goodWeather), dates: [SAT, SUN] });
    expect(hits.length).toBeLessThanOrEqual(6);
    expect(new Set(hits.map((h) => `${h.candidateId}|${h.date}`)).size).toBe(hits.length);
  });
});
