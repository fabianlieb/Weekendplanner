// Builds public/catalog/routes.json from the federal geodata API (api3.geo.admin.ch).
// Run: node scripts/build-catalog.mjs   (Node 24, no dependencies)
// Data: © swisstopo / SAC (Skirouten, Schneeschuhrouten), ASTRA / SchweizMobil (Schneeschuhwanderwege).
// Open data (OGD); the source reference is mandatory and shown in the app.

import { mkdirSync, writeFileSync } from 'node:fs';
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

async function allFeatures(layer) {
  const out = new Map();
  for (let offset = 0; ; offset += PAGE) {
    const q = new URLSearchParams({
      geometryType: 'esriGeometryEnvelope',
      geometry: BBOX.join(','),
      imageDisplay: '1000,1000,96',
      mapExtent: BBOX.join(','),
      tolerance: '0',
      layers: `all:${layer}`,
      returnGeometry: 'true',
      geometryFormat: 'geojson',
      sr: '2056',
      lang: 'de',
      limit: String(PAGE),
      offset: String(offset),
    });
    const j = await getJson(`${API}/api/MapServer/identify?${q}`);
    const results = j.results ?? [];
    for (const f of results) {
      const a = f.properties ?? f.attributes ?? {};
      if (a.target_name || a.namer) out.set(String(f.id ?? f.featureId), f);
    }
    process.stdout.write(`\r${layer}: ${offset + results.length} Features, ${out.size} mit Namen`);
    if (results.length < PAGE) break;
  }
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
