// Builds public/catalog/routes.json from the federal geodata API (api3.geo.admin.ch).
// Run: node scripts/build-catalog.mjs   (Node 24, no dependencies)
// Data: © swisstopo / SAC (Skirouten, Schneeschuhrouten), ASTRA / SchweizMobil (Schneeschuhwanderwege).
// Open data (OGD); the source reference is mandatory and shown in the app.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAYERS, astraTrailToEntry, endpoints, sacRouteToEntry } from './catalog-lib.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'catalog', 'routes.json');
const API = 'https://api3.geo.admin.ch/rest/services';
// Switzerland incl. border areas (LV95)
const BBOX = [2480000, 1070000, 2840000, 1300000];
const PAGE = 200;

async function getJson(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'wochenend-planer-catalog' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((res) => setTimeout(res, 1000 * i));
    }
  }
}

async function identify(layer, box) {
  const q = new URLSearchParams({
    geometryType: 'esriGeometryEnvelope',
    geometry: box.join(','),
    imageDisplay: '1000,1000,96',
    mapExtent: box.join(','),
    tolerance: '0',
    layers: `all:${layer}`,
    returnGeometry: 'true',
    geometryFormat: 'geojson',
    sr: '2056',
    lang: 'de',
    limit: String(PAGE),
  });
  const j = await getJson(`${API}/api/MapServer/identify?${q}`);
  return j.results ?? [];
}

/**
 * All features of a layer. Paging with `offset` is not stable (the API does not sort), so the
 * area is split into tiles; a full tile (= PAGE results) is split again into four.
 */
async function allFeatures(layer) {
  const out = new Map();
  let requests = 0;
  const visit = async (box) => {
    const results = await identify(layer, box);
    requests++;
    const [x0, y0, x1, y1] = box;
    if (results.length >= PAGE && x1 - x0 > 1000) {
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      for (const b of [
        [x0, y0, mx, my],
        [mx, y0, x1, my],
        [x0, my, mx, y1],
        [mx, my, x1, y1],
      ])
        await visit(b);
      return;
    }
    for (const f of results) {
      const a = f.properties ?? f.attributes ?? {};
      if (a.target_name || a.namer) out.set(String(f.id ?? f.featureId), f);
    }
    process.stdout.write(`\r${layer}: ${requests} Abfragen, ${out.size} mit Namen`);
  };
  // Start with a 4 × 3 grid over the area.
  const [X0, Y0, X1, Y1] = BBOX;
  const dx = (X1 - X0) / 4;
  const dy = (Y1 - Y0) / 3;
  for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) await visit([X0 + i * dx, Y0 + k * dy, X0 + (i + 1) * dx, Y0 + (k + 1) * dy]);
  process.stdout.write('\n');
  return [...out.values()];
}

async function height([e, n]) {
  try {
    const j = await getJson(`${API}/height?easting=${Math.round(e)}&northing=${Math.round(n)}&sr=2056`);
    const h = Number(j.height);
    return Number.isFinite(h) ? h : undefined;
  } catch {
    return undefined;
  }
}

/** Runs `fn` over items with limited concurrency. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
        if (++done % 100 === 0) process.stdout.write(`\r  Höhen: ${done}/${items.length}`);
      }
    }),
  );
  process.stdout.write(`\r  Höhen: ${items.length}/${items.length}\n`);
  return out;
}

const entries = [];
for (const [layer, kind] of [
  [LAYERS.skiTours, 'ski_tour'],
  [LAYERS.sacSnowshoe, 'snowshoe'],
]) {
  const features = await allFeatures(layer);
  const heights = await mapLimit(features, 8, (f) => {
    const ep = endpoints(f.geometry);
    return ep ? height(ep.first) : undefined;
  });
  features.forEach((f, i) => {
    const e = sacRouteToEntry(f, kind, heights[i]);
    if (e) entries.push(e);
  });
}
{
  const features = await allFeatures(LAYERS.astraSnowshoe);
  const heights = await mapLimit(features, 8, (f) => {
    const ep = endpoints(f.geometry);
    return ep ? height(ep.first) : undefined;
  });
  features.forEach((f, i) => {
    const e = astraTrailToEntry(f, heights[i]);
    if (e) entries.push(e);
  });
}

// Same route via two features (e.g. split lines): keep one per id.
const unique = [...new Map(entries.map((e) => [e.id, e])).values()].sort((a, b) => a.id.localeCompare(b.id));

// Safety net for the automatic monthly update: a much smaller result means an incomplete download.
if (existsSync(OUT)) {
  const old = JSON.parse(readFileSync(OUT, 'utf8')).entries?.length ?? 0;
  if (unique.length < old * 0.95) {
    console.error(`Nur ${unique.length} statt bisher ${old} Einträge – Download vermutlich unvollständig, alter Katalog bleibt.`);
    process.exit(1);
  }
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify({
    format: 'wochenend-planer-catalog',
    version: 1,
    generatedAt: new Date().toISOString().slice(0, 10),
    attribution: 'Routen: © swisstopo / SAC · Schneeschuhwanderwege: ASTRA / SchweizMobil',
    entries: unique,
  }),
);
const counts = unique.reduce((m, e) => ((m[e.source + ' ' + e.kind] = (m[e.source + ' ' + e.kind] ?? 0) + 1), m), {});
console.log(`${unique.length} Einträge → ${OUT}`, counts);
