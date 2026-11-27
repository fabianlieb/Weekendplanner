import { describe, expect, it } from 'vitest';
import { FALLBACK_MODEL, MAX_LOCATIONS_PER_REQUEST, MODEL_LABEL, OpenMeteoError, PRIMARY_MODEL, buildForecastUrl, fetchForecast, parseLocation } from './openMeteo';
import { fakeFetch, fakeLocation } from './__fixtures__/openMeteoResponse';

const pt = { lat: 47.0778, lon: 9.2994, elevation: 2020 };

describe('Open-Meteo URL', () => {
  it('asks for MeteoSwiss + global model, all variables, Zurich time, multiple locations', () => {
    const url = new URL(buildForecastUrl([pt, { lat: 47.1236, lon: 9.3122, elevation: 427 }]));
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    const q = url.searchParams;
    expect(q.get('models')).toBe(`${PRIMARY_MODEL},${FALLBACK_MODEL}`);
    expect(q.get('latitude')).toBe('47.0778,47.1236');
    expect(q.get('longitude')).toBe('9.2994,9.3122');
    expect(q.get('elevation')).toBe('2020,427');
    expect(q.get('timezone')).toBe('Europe/Zurich');
    expect(q.get('past_days')).toBe('3');
    for (const v of ['temperature_2m', 'cloud_cover_low', 'wind_gusts_10m', 'visibility', 'sunshine_duration', 'snowfall']) {
      expect(q.get('hourly')?.split(',')).toContain(v);
    }
    // no API key, no personal data
    expect(url.search).not.toMatch(/key|apikey|token/i);
  });
});

describe('Open-Meteo parsing', () => {
  const loc = fakeLocation(pt.lat, pt.lon, pt.elevation, {
    start: '2026-11-30',
    days: 10,
    primaryHours: 24 * 6, // MeteoSwiss covers the first 6 days
    snowPerHour: (i) => (i >= 24 * 3 && i < 24 * 4 ? 0.5 : 0), // 12 cm on 2026-12-03
  });
  const days = parseLocation(loc);

  it('splits into local days with 24 hours', () => {
    expect(Object.keys(days)).toHaveLength(10);
    expect(days['2026-12-05']?.hours).toHaveLength(24);
    expect(days['2026-12-05']?.hours[8]?.hour).toBe(8);
  });

  it('uses MeteoSwiss where available and the global model beyond', () => {
    expect(days['2026-12-05']?.hours[0]?.temperature).toBe(-5);
    expect(days['2026-12-05']?.model).toBe(MODEL_LABEL.primary);
    expect(days['2026-12-07']?.hours[0]?.temperature).toBe(-4); // global = base + 1
    expect(days['2026-12-07']?.model).toBe(MODEL_LABEL.fallback);
  });

  it('takes visibility from the global model, sunshine in minutes', () => {
    expect(days['2026-12-05']?.hours[10]?.visibility).toBe(20001);
    expect(days['2026-12-05']?.hours[10]?.sunshineMinutes).toBe(50);
  });

  it('sums new snow over the 72 h before 08:00', () => {
    expect(days['2026-12-05']?.newSnow72h).toBe(12); // 03.12. fully inside 02.12. 08:00 – 05.12. 08:00
    expect(days['2026-12-08']?.newSnow72h).toBe(0);
  });

  it('marks mixed days', () => {
    const mixed = parseLocation(fakeLocation(pt.lat, pt.lon, pt.elevation, { start: '2026-12-01', days: 3, primaryHours: 36 }));
    expect(mixed['2026-12-02']?.model).toBe(MODEL_LABEL.mixed);
  });

  it('drops incomplete days (fail closed)', () => {
    const l = fakeLocation(pt.lat, pt.lon, pt.elevation, { start: '2026-12-01', days: 2, primaryHours: 48 });
    const h = l.hourly as Record<string, (number | null)[]>;
    for (const key of [`temperature_2m_${PRIMARY_MODEL}`, `temperature_2m_${FALLBACK_MODEL}`]) {
      for (let i = 24; i < 48; i++) if (i % 2 === 0) (h[key] as (number | null)[])[i] = null;
    }
    const d = parseLocation(l);
    expect(d['2026-12-01']).toBeDefined();
    expect(d['2026-12-02']).toBeUndefined();
  });
});

describe('Open-Meteo fetch', () => {
  it('splits large requests into chunks and keeps the order', async () => {
    const calls: { url: string }[] = [];
    const points = Array.from({ length: MAX_LOCATIONS_PER_REQUEST + 5 }, (_, i) => ({ lat: 46 + i * 0.01, lon: 9, elevation: 1000 + i }));
    const res = await fetchForecast(points, fakeFetch({ start: '2026-12-01', days: 2, primaryHours: 48 }, calls));
    expect(calls).toHaveLength(2);
    expect(res).toHaveLength(points.length);
  });

  it('reports API errors with the reason', async () => {
    const bad = async () => ({ ok: false, status: 400, json: async () => ({ error: true, reason: 'Invalid value' }) });
    await expect(fetchForecast([pt], bad)).rejects.toThrow(OpenMeteoError);
    await expect(fetchForecast([pt], bad)).rejects.toThrow('Invalid value');
  });

  it('reports network errors', async () => {
    const offline = async () => {
      throw new TypeError('Failed to fetch');
    };
    await expect(fetchForecast([pt], offline)).rejects.toThrow('Keine Verbindung');
  });

  it('rejects unexpected response shapes', async () => {
    const weird = async () => ({ ok: true, status: 200, json: async () => ({ foo: 1 }) });
    await expect(fetchForecast([pt], weird)).rejects.toThrow('unerwartetes Antwortformat');
  });
});
