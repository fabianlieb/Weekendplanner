// Writes one GPX file per catalogue route into dist/catalog/gpx/ (runs after `vite build`).
// The swisstopo app and Guru Maps load a route from a public URL, so the files are published
// with the app on GitHub Pages. They are not precached by the service worker.
// Source: scripts/route-lines.json (written by build-catalog.mjs).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePolyline, gpxDocument } from './catalog-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, 'route-lines.json');
const OUT = join(here, '..', 'dist', 'catalog', 'gpx');
const CREDIT = { 'swisstopo/SAC': '© swisstopo / SAC', 'ASTRA/SchweizMobil': 'ASTRA / SchweizMobil' };

if (!existsSync(SRC)) {
  console.warn('scripts/route-lines.json fehlt – keine GPX-Dateien erzeugt.');
  process.exit(0);
}
const { routes } = JSON.parse(readFileSync(SRC, 'utf8'));
mkdirSync(OUT, { recursive: true });
let n = 0;
for (const [file, r] of Object.entries(routes)) {
  if (!/^[A-Za-z0-9-]+\.gpx$/.test(file)) continue;
  writeFileSync(join(OUT, file), gpxDocument(r.n, CREDIT[r.s] ?? r.s, r.l.map(decodePolyline)));
  n++;
}
console.log(`${n} GPX-Dateien → dist/catalog/gpx/`);
