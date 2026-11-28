import { describe, expect, it } from 'vitest';
import { context } from '../engine/__fixtures__/scenario';
import { suggest } from '../engine/suggest';
import { decodeSharedPlan, encodeSharedPlan, sharedPlanFrom, shareUrl } from './share';

const s = suggest(context()).suggestions[0]!;

describe('share by link', () => {
  const p = sharedPlanFrom(s, 'Samstag, 5.12.', ['LVS', 'Sonde', 'Thermosflasche für Glühwein'], { lat: 46.75, lon: 9.95, label: 'Startpunkt' });

  it('round-trips through the URL fragment, umlauts included', () => {
    const url = shareUrl(p, 'https://fabianlieb.github.io/Weekendplanner/?view=detail&id=x');
    expect(url.startsWith('https://fabianlieb.github.io/Weekendplanner/?view=shared#p=')).toBe(true);
    const data = new URL(url).hash.slice(3);
    expect(data).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeSharedPlan(data)).toEqual(p);
  });

  it('keeps the risk information of tours', () => {
    const back = decodeSharedPlan(encodeSharedPlan(p))!;
    expect(back.risk.label).toBe(s.risk.label);
    if (s.risk.applies) expect(back.risk.bulletinHint).toMatch(/SLF/);
  });

  it('rejects broken or foreign data', () => {
    expect(decodeSharedPlan('not-base64!!')).toBeUndefined();
    expect(decodeSharedPlan(encodeSharedPlan({ ...p, v: 2 } as unknown as typeof p))).toBeUndefined();
    expect(decodeSharedPlan(undefined)).toBeUndefined();
  });

  it('stays a reasonable length', () => {
    expect(encodeSharedPlan(p).length).toBeLessThan(6000);
  });
});
