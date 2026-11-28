// Steepest slope classes per catalogue route (for the own avalanche risk calculation, GRM).
// Reads the route lines (scripts/route-lines.json), samples the swisstopo slope layer
// «Hangneigung über 30°» (WMTS, zoom 14) in three corridors and stores [Spur, Hang, Auslauf]
// per route in scripts/route-steepness.json and in public/catalog/routes.json (field «steep»).
// Already computed routes are kept; only new ones are computed. Run: node scripts/build-steepness.mjs [--all]

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePolyline, gpxFileName } from './catalog-lib.mjs';
import { decodePng } from './png-lib.mjs';
import { CORRIDORS_M, MIN_PIXELS, ZOOM, classesFromRgba, classesFromSizes, componentSizes, corridorGrid, tilesFor } from './steepness-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const LINES = join(here, 'route-lines.json');
const OUT = join(here, 'route-steepness.json');
const ROUTES = join(here, '..', 'public', 'catalog', 'routes.json');
const TILE = (x, y) => `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.hangneigung-ueber_30/default/current/3857/${ZOOM}/${x}/${y}.png`;

const { routes } = JSON.parse(readFileSync(LINES, 'utf8'));
const previous = existsSync(OUT) && !process.argv.includes('--all') ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
// Largest connected steep area per corridor and class (pixels): the class can be re-derived for another minimum area.
const known = previous.sizes ?? {};
const sizes = { ...known };

// Tile cache (classes per pixel), least recently used dropped beyond the limit.
const cache = new Map();
const LIMIT = 2500;
async function tile(x, y) {
  const key = `${x}/${y}`;
  if (cache.has(key)) {
    const v = cache.get(key);
    cache.delete(key);
    cache.set(key, v);
    return v;
  }
  let v;
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(TILE(x, y), { headers: { 'User-Agent': 'wochenend-planer-steepness' } });
      if (r.status === 404 || r.status === 400) {
        v = new Uint8Array(256 * 256); // outside the data: no slopes over 30°
        break;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      v = classesFromRgba(decodePng(Buffer.from(await r.arrayBuffer())).rgba);
      break;
    } catch (e) {
      if (i >= 4) throw e;
      await new Promise((res) => setTimeout(res, 800 * i));
    }
  }
  cache.set(key, v);
  if (cache.size > LIMIT) cache.delete(cache.keys().next().value);
  return v;
}

function save() {
  const classes = Object.fromEntries(Object.entries(sizes).map(([f, s]) => [f, classesFromSizes(s)]));
  writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), corridorsM: CORRIDORS_M, minPixels: MIN_PIXELS, classes, sizes }));
  return classes;
}

// Routes in spatial order, so neighbouring routes reuse cached tiles.
const todo = Object.entries(routes)
  .filter(([file]) => !sizes[file])
  .map(([file, r]) => ({ file, lines: r.l.map(decodePolyline) }))
  .filter((r) => r.lines.flat().length > 1)
  .map((r) => {
    const p = r.lines[0][Math.floor(r.lines[0].length / 2)];
    return { ...r, key: Math.round(p[0] * 20) * 1000 + Math.round(p[1] * 20) };
  })
  .sort((a, b) => a.key - b.key);

console.log(`${todo.length} Routen zu berechnen (${Object.keys(known).length} schon bekannt)`);
let done = 0;
const started = Date.now();
for (const r of todo) {
  const grid = corridorGrid(r.lines);
  const need = tilesFor(grid);
  const loaded = new Map();
  // a few tiles in parallel
  for (let i = 0; i < need.length; i += 8) {
    await Promise.all(need.slice(i, i + 8).map(async ([x, y]) => loaded.set(`${x}/${y}`, await tile(x, y))));
  }
  sizes[r.file] = componentSizes(grid, (wx, wy) => {
    const t = loaded.get(`${Math.floor(wx / 256)}/${Math.floor(wy / 256)}`);
    return t ? t[(wy % 256) * 256 + (wx % 256)] : 0;
  });
  if (++done % 100 === 0) {
    process.stdout.write(`\r  ${done}/${todo.length} (${Math.round((Date.now() - started) / 1000)} s)`);
    save();
  }
}
process.stdout.write('\n');
save();

// Into the catalogue the app loads.
const classes = save();
const cat = JSON.parse(readFileSync(ROUTES, 'utf8'));
let n = 0;
for (const e of cat.entries) {
  if (!e.track) continue;
  const c = classes[gpxFileName(e.track)];
  if (c) {
    e.steep = c;
    n++;
  } else delete e.steep;
}
writeFileSync(ROUTES, JSON.stringify(cat));
const dist = {};
for (const c of Object.values(classes)) dist[c[0]] = (dist[c[0]] ?? 0) + 1;
console.log(`${n} Routen mit Steilheit → routes.json · Spurbereich-Klassen:`, dist);
