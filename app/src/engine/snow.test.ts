import { describe, expect, it } from 'vitest';
import { snowFor, snowTooLow, type SnowStation } from './snow';
import { THRESHOLDS } from './thresholds';

const tour = { valley: { lat: 46.8, lon: 9.8, elevation: 1500 }, summit: { lat: 46.82, lon: 9.82, elevation: 2600 } };
const st = (c: string, lat: number, lon: number, e: number, hs: number, d = '2026-12-04'): SnowStation => ({ c, n: c, lat, lon, e, d, hs, hn3: 10 });

describe('measured snow near a place', () => {
  it('takes the nearest station in the height band of the route', () => {
    const obs = snowFor(tour, [st('FAR', 47.3, 9.8, 2400, 90), st('LOW', 46.81, 9.81, 900, 5), st('OK', 46.83, 9.83, 2500, 70), st('OK2', 46.9, 9.9, 2550, 80)], '2026-12-04');
    expect(obs).toMatchObject({ station: 'OK', depthCm: 70, newSnow3dCm: 10, elevation: 2500 });
  });

  it('nothing without a station in reach, or with old data', () => {
    expect(snowFor(tour, [st('FAR', 47.3, 9.8, 2400, 90)], '2026-12-04')).toBeUndefined();
    expect(snowFor(tour, [st('OLD', 46.83, 9.83, 2500, 70, '2026-11-20')], '2026-12-04')).toBeUndefined();
    expect(snowFor(tour, [], '2026-12-04')).toBeUndefined();
  });

  it('too little snow only for tours and trails', () => {
    const thin = { station: 'X', elevation: 2500, distanceKm: 2, date: '2026-12-04', depthCm: THRESHOLDS.snow.minDepthCm.ski_tour - 1, newSnow3dCm: 0 };
    expect(snowTooLow('ski_tour', thin)).toBe(true);
    expect(snowTooLow('snowshoe', { ...thin, depthCm: THRESHOLDS.snow.minDepthCm.snowshoe })).toBe(false);
    expect(snowTooLow('ski', thin)).toBe(false);
    expect(snowTooLow('photo', thin)).toBe(false);
    expect(snowTooLow('ski_tour', undefined)).toBe(false);
  });
});
