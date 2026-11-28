import { describe, expect, it } from 'vitest';
import { trackFrame, worldPx } from './media';
import { packingIcon } from './miniIcons';
import { scheduleIcon } from './WeatherChips';

describe('route drawing on map tiles', () => {
  it('projects like Web Mercator tiles (Zürich at zoom 10)', () => {
    const [x, y] = worldPx(47.3769, 8.5417, 10);
    expect(Math.floor(x / 256)).toBe(536);
    expect(Math.floor(y / 256)).toBe(358);
  });

  it('keeps the whole route inside the frame and covers it with tiles', () => {
    const pts: [number, number][] = [
      [47.03, 8.7],
      [47.01, 8.74],
      [46.99, 8.71],
    ];
    const { z, k, proj, tiles } = trackFrame(pts, 320, 190, 16);
    expect(z).toBeGreaterThanOrEqual(12);
    expect(k).toBeGreaterThan(0.4);
    for (const [lat, lon] of pts) {
      const [vx, vy] = proj(lat, lon);
      expect(vx).toBeGreaterThanOrEqual(15.9);
      expect(vx).toBeLessThanOrEqual(304.1);
      expect(vy).toBeGreaterThanOrEqual(15.9);
      expect(vy).toBeLessThanOrEqual(174.1);
    }
    // tiles cover the whole view
    expect(Math.min(...tiles.map((t) => t.vx))).toBeLessThanOrEqual(0);
    expect(Math.min(...tiles.map((t) => t.vy))).toBeLessThanOrEqual(0);
    expect(Math.max(...tiles.map((t) => t.vx + t.size))).toBeGreaterThanOrEqual(320);
    expect(Math.max(...tiles.map((t) => t.vy + t.size))).toBeGreaterThanOrEqual(190);
  });
});

describe('small symbols', () => {
  it('finds a symbol for every packing item, a dot otherwise', () => {
    expect(packingIcon('LVS')).toBe('beacon');
    expect(packingIcon('Tourenski und Stöcke')).toBe('ski');
    expect(packingIcon('Skibrille')).toBe('goggles');
    expect(packingIcon('Skischuhe')).toBe('boot');
    expect(packingIcon('Skipass oder Zahlungsmittel')).toBe('ticket');
    expect(packingIcon('Karte oder GPX auf dem Handy')).toBe('map');
    expect(packingIcon('Etwas Eigenes')).toBe('dot');
  });

  it('schedule symbols follow the travel mode; old plans get one from the wording', () => {
    expect(scheduleIcon({ time: 400, label: 'Abfahrt Zuhause', kind: 'depart' }, 'transit')).toBe('train');
    expect(scheduleIcon({ time: 400, label: 'Abfahrt Zuhause', kind: 'depart' }, 'car')).toBe('car');
    expect(scheduleIcon({ time: 400, label: 'Abfahrt Zuhause' }, undefined)).toBe('car');
    expect(scheduleIcon({ time: 700, label: 'Abfahrt ins Tal' }, 'car')).toBe('dot');
    expect(scheduleIcon({ time: 900, label: 'Ankunft Zuhause' }, 'car')).toBe('home');
  });
});
