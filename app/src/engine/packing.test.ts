import { describe, expect, it } from 'vitest';
import { packingList } from './packing';

describe('packing list', () => {
  it('ski tour: avalanche kit, head torch, always items', () => {
    const l = packingList({ activity: 'ski_tour', slot: 'day', avalancheDependent: true });
    expect(l).toEqual(expect.arrayContaining(['LVS', 'Sonde', 'Schaufel', 'Felle', 'Stirnlampe', 'Erste-Hilfe-Set']));
  });

  it('unsignposted snowshoe tour adds the avalanche kit, signposted does not', () => {
    expect(packingList({ activity: 'snowshoe', slot: 'day', avalancheDependent: true })).toContain('LVS');
    expect(packingList({ activity: 'snowshoe', slot: 'day', avalancheDependent: false })).not.toContain('LVS');
  });

  it('evening and photo add-on add head torch and camera; no duplicates; place extras appended', () => {
    const l = packingList(
      { activity: 'ski', slot: 'day', avalancheDependent: false, photo: { spotId: 'x', spotName: 'X', lightLabel: 'Sonnenuntergang', time: 1000 } },
      { packing: ['Bargeld für Parkplatz', 'Kamera'] },
    );
    expect(l).toContain('Stirnlampe');
    expect(l).toContain('Stativ');
    expect(l).toContain('Bargeld für Parkplatz');
    expect(l.filter((i) => i === 'Kamera')).toHaveLength(1);
    expect(new Set(l).size).toBe(l.length);
  });
});
