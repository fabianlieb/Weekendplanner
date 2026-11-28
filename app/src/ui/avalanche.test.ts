import { describe, expect, it } from 'vitest';
import { grmColour, levelValue } from '../engine/grm';
import { THRESHOLDS } from '../engine/thresholds';
import { buildRiskInfo } from '../engine/risk';
import type { SlfDanger } from '../engine/slf';
import type { Candidate } from '../engine/types';
import { elevationText, problemLabel, touchesTour } from './weekend/AvalancheProblems';
import { greenLine, redLine } from './weekend/GrmChart';

describe('avalanche problems', () => {
  it('names problems and elevation bands in German', () => {
    expect(problemLabel('wind_slab')).toBe('Triebschnee');
    expect(problemLabel('persistent_weak_layers')).toBe('Altschnee');
    expect(problemLabel('something_new')).toBe('something new');
    expect(elevationText({ lower: 2400 })).toBe('über 2400 m');
    expect(elevationText({ upper: 1800 })).toBe('unter 1800 m');
    expect(elevationText({ lower: 1800, upper: 2400 })).toBe('1800–2400 m');
    expect(elevationText({})).toBe('alle Höhenlagen');
  });

  it('tells whether the band touches the tour', () => {
    const tour = { low: 1500, high: 2300 };
    expect(touchesTour({ lower: 2400 }, tour)).toBe(false);
    expect(touchesTour({ lower: 2200 }, tour)).toBe(true);
    expect(touchesTour({ upper: 1400 }, tour)).toBe(false);
    expect(touchesTour({}, tour)).toBe(true);
  });

  it('the risk info carries problems, the tour band and the GRM point', () => {
    const c = {
      id: 't',
      name: 'T',
      kind: 'ski_tour',
      difficulty: 'WS',
      valley: { lat: 46.5, lon: 7.5, elevation: 1500 },
      summit: { lat: 46.52, lon: 7.5, elevation: 2600 },
      durationHours: 5,
      travelMinutes: {},
      done: false,
      active: true,
    } as Candidate;
    const slf: SlfDanger = {
      level: 2,
      region: 'CH-1',
      regionName: 'West',
      validFrom: '2026-12-04T16:00:00Z',
      validTo: '2026-12-05T16:00:00Z',
      problems: [{ type: 'wind_slab', aspects: ['N', 'NE'], lower: 2200 }],
    };
    const grm = grmColour(2, undefined, { difficulty: 'WS' })!;
    const info = buildRiskInfo(
      c,
      { kind: 'known', entry: { candidateId: 't', color: grm.color, date: '2026-12-03', source: 'GRM (berechnet)', grm } as never },
      '2026-12-05',
      slf,
    );
    expect(info.slf?.problems).toEqual([{ type: 'wind_slab', aspects: ['N', 'NE'], lower: 2200 }]);
    expect(info.slf?.tour).toEqual({ low: 1500, high: 2600 });
    expect(info.grm).toMatchObject({ x: 2.5, area: 0, color: grm.color });
  });
});

describe('GRM chart lines', () => {
  it('match the colours the engine computes', () => {
    const degrees = THRESHOLDS.grm.classDegrees;
    for (const level of [1, 2, 3, 4] as const)
      for (const sub of ['minus', undefined, 'plus'] as const)
        for (let cls = 0; cls <= 5; cls++) {
          const lv = levelValue(level, sub);
          const deg = degrees[cls]!;
          const expected = deg < greenLine(lv) ? 'green' : deg >= redLine(lv) ? 'red' : 'orange';
          expect(grmColour(level, sub, { steep: [cls, cls, cls] })!.color).toBe(expected);
        }
    expect(greenLine(1)).toBe(40);
    expect(greenLine(3)).toBe(30);
    expect(redLine(1.87)).toBe(45);
  });
});
