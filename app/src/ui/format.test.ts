import { describe, expect, it } from 'vitest';
import type { WeatherSummary } from '../engine/types';
import { formatDuration, weatherLine } from './format';

const w: WeatherSummary = {
  temperature: -5,
  maxGust: 25,
  cloudCover: 20,
  sunshineHours: 6.2,
  newSnowCm: 12,
  precipitationMm: 0,
  fogSeaLikely: false,
  model: 'ICON-CH (MeteoSchweiz)',
  hours: [],
};

describe('weather line', () => {
  it('day outing: temperature, gusts, sun, new snow', () => {
    expect(weatherLine(w, 'ski_tour', 'day')).toBe('−5 °C · Böen 25 km/h · 6 h Sonne · 12 cm Neuschnee');
  });

  it('mentions a likely fog sea', () => {
    expect(weatherLine({ ...w, fogSeaLikely: true, newSnowCm: 0 }, 'ski', 'day')).toBe('−5 °C · Böen 25 km/h · 6 h Sonne · Nebelmeer wahrscheinlich');
  });

  it('photo and evening outings show clouds instead of sun hours; moon in the evening', () => {
    expect(weatherLine(w, 'photo', 'morning')).toBe('−5 °C · Böen 25 km/h · Bewölkung 20 %');
    expect(weatherLine({ ...w, moonIllumination: 0.93 }, 'snowshoe', 'evening')).toBe('−5 °C · Böen 25 km/h · Bewölkung 20 % · 12 cm Neuschnee · Mond 93 %');
  });

  it('precipitation and no sun', () => {
    expect(weatherLine({ ...w, temperature: 2, sunshineHours: 0.2, newSnowCm: 0, precipitationMm: 3.5 }, 'ski', 'day')).toBe('2 °C · Böen 25 km/h · kaum Sonne · 3,5 mm Niederschlag');
  });

  it('durations', () => {
    expect(formatDuration(100)).toBe('1 h 40 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(45)).toBe('45 min');
  });
});
