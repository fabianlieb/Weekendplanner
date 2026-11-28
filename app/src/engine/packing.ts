// Packing list per suggestion: defaults per sport, adapted to the situation, plus extras per place.

import type { Activity, Candidate, Suggestion } from './types';

const BASE: Record<Activity, string[]> = {
  ski_tour: ['LVS', 'Sonde', 'Schaufel', 'Tourenski und Stöcke', 'Felle', 'Harscheisen', 'Helm', 'Sonnenbrille und Skibrille', 'Ersatzhandschuhe', 'Warme Jacke'],
  snowshoe: ['Schneeschuhe', 'Stöcke', 'Wanderschuhe', 'Gamaschen', 'Warme Jacke', 'Ersatzhandschuhe', 'Sonnenbrille'],
  ski: ['Ski und Stöcke', 'Skischuhe', 'Helm', 'Skibrille', 'Handschuhe', 'Skipass oder Zahlungsmittel'],
  photo: ['Kamera', 'Objektive', 'Stativ', 'Ersatzakkus', 'Speicherkarten', 'Warme Kleidung', 'Handwärmer'],
};

const ALWAYS = ['Handy geladen', 'Erste-Hilfe-Set', 'Rettungsdecke', 'Sonnencreme', 'Thermosflasche', 'Proviant'];

export function packingList(s: Pick<Suggestion, 'activity' | 'slot' | 'photo' | 'avalancheDependent'>, candidate?: Pick<Candidate, 'packing'>): string[] {
  const items: string[] = [...BASE[s.activity]];
  // Unsignposted snowshoe tours are in avalanche terrain.
  if (s.activity === 'snowshoe' && s.avalancheDependent) items.unshift('LVS', 'Sonde', 'Schaufel');
  // Dark: evening outings, sunrise/sunset photos, photo add-ons.
  if (s.slot !== 'day' || s.photo) items.push('Stirnlampe');
  if (s.photo && s.activity !== 'photo') items.push('Kamera', 'Stativ', 'Ersatzakku');
  if (s.activity === 'ski_tour') items.push('Stirnlampe');
  items.push(...ALWAYS);
  if (s.activity !== 'ski') items.push('Karte oder GPX auf dem Handy');
  items.push(...(candidate?.packing ?? []));
  return [...new Set(items.map((i) => i.trim()).filter(Boolean))];
}
