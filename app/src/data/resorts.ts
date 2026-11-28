// Built-in list of Swiss ski areas (the federal lift data cannot be queried by area).
// Coordinates and elevations are approximate (valley station / top station) and should be checked.
// Prices and opening dates are not included.

import type { Candidate } from '../engine/types';

type R = [id: string, name: string, region: string, valley: [number, number, number], summit: [number, number, number]];

const LIST: R[] = [
  ['flumserberg', 'Flumserberg', 'Sarganserland', [47.0919, 9.2836, 1400], [47.0775, 9.2975, 2020]],
  ['pizol', 'Pizol', 'Sarganserland', [47.0294, 9.4347, 520], [46.985, 9.425, 2220]],
  ['toggenburg', 'Wildhaus – Unterwasser', 'Toggenburg', [47.1964, 9.3092, 910], [47.1544, 9.3131, 2262]],
  ['hoch-ybrig', 'Hoch-Ybrig', 'Ybrig', [47.0228, 8.8019, 1040], [47.0119, 8.8294, 1850]],
  ['stoos', 'Stoos', 'Schwyz', [46.9772, 8.6631, 1300], [46.9706, 8.6408, 1922]],
  ['engelberg', 'Engelberg-Titlis', 'Obwalden', [46.8197, 8.4022, 1000], [46.7728, 8.4253, 3020]],
  ['melchsee-frutt', 'Melchsee-Frutt', 'Obwalden', [46.7747, 8.2697, 1920], [46.7683, 8.2878, 2250]],
  ['soerenberg', 'Sörenberg', 'Entlebuch', [46.8225, 8.035, 1166], [46.7869, 8.0472, 2350]],
  ['andermatt', 'Andermatt – Gemsstock', 'Uri', [46.6353, 8.5939, 1440], [46.6025, 8.6111, 2961]],
  ['laax', 'Laax – Flims', 'Surselva', [46.8094, 9.2583, 1100], [46.8378, 9.2181, 2228]],
  ['lenzerheide', 'Arosa Lenzerheide – Lenzerheide', 'Mittelbünden', [46.7272, 9.5583, 1470], [46.7464, 9.6131, 2860]],
  ['arosa', 'Arosa Lenzerheide – Arosa', 'Schanfigg', [46.7783, 9.6794, 1775], [46.7894, 9.6503, 2653]],
  ['parsenn', 'Davos Klosters – Parsenn', 'Prättigau/Davos', [46.8094, 9.8389, 1560], [46.8333, 9.8064, 2662]],
  ['jakobshorn', 'Davos – Jakobshorn', 'Prättigau/Davos', [46.7942, 9.8236, 1560], [46.7717, 9.855, 2590]],
  ['savognin', 'Savognin', 'Surses', [46.5964, 9.5994, 1210], [46.5767, 9.5394, 2670]],
  ['corviglia', 'St. Moritz – Corviglia', 'Engadin', [46.4983, 9.8394, 1820], [46.5197, 9.8008, 3057]],
  ['corvatsch', 'Corvatsch', 'Engadin', [46.4589, 9.805, 1870], [46.4183, 9.8153, 3303]],
  ['diavolezza', 'Diavolezza', 'Engadin', [46.4283, 9.9844, 2093], [46.4092, 9.9692, 2973]],
  ['scuol', 'Scuol – Motta Naluns', 'Unterengadin', [46.7969, 10.2978, 1250], [46.7814, 10.2678, 2142]],
  ['grindelwald-first', 'Grindelwald – First', 'Jungfrauregion', [46.6242, 8.0414, 1034], [46.6594, 8.0539, 2167]],
  ['maennlichen', 'Grindelwald – Männlichen', 'Jungfrauregion', [46.6233, 8.0328, 943], [46.6131, 7.9406, 2343]],
  ['adelboden', 'Adelboden – Lenk', 'Berner Oberland', [46.4925, 7.5594, 1350], [46.4547, 7.5419, 2000]],
  ['zermatt', 'Zermatt', 'Wallis', [46.0207, 7.7491, 1608], [45.9383, 7.7297, 3883]],
  ['saas-fee', 'Saas-Fee', 'Wallis', [46.1081, 7.9275, 1800], [46.0839, 7.9206, 3456]],
  ['verbier', 'Verbier', 'Wallis', [46.0961, 7.2286, 1500], [46.0828, 7.3117, 3330]],
  ['crans-montana', 'Crans-Montana', 'Wallis', [46.3122, 7.4806, 1500], [46.3753, 7.5039, 2900]],
];

export const CATALOG_RESORTS: Candidate[] = LIST.map(([id, name, region, v, s]) => ({
  id: `ski-${id}`,
  name,
  kind: 'ski_resort',
  region,
  valley: { lat: v[0], lon: v[1], elevation: v[2] },
  summit: { lat: s[0], lon: s[1], elevation: s[2] },
  durationHours: 7,
  travelMinutes: {},
  done: false,
  active: true,
  source: 'Skigebiete (eingebaut)',
  note: 'Aus der eingebauten Skigebietsliste: Koordinaten ungefähr, Öffnungszeiten und Preise prüfen.',
}));
