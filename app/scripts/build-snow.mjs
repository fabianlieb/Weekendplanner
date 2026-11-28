// Snow depth from the SLF measuring network (IMIS), published with the app as data/snow.json.
// The SLF API sends no CORS headers, so the browser cannot ask it directly; the deploy workflow
// runs this twice a day. Without network the file is simply missing and the app shows nothing.
// Data: SLF Data Service, CC BY 4.0, source reference «SLF» with link to www.slf.ch.
// Run: node scripts/build-snow.mjs [--public]   (--public: into public/ for the dev server)

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', process.argv.includes('--public') ? 'public' : 'dist', 'data', 'snow.json');
const API = 'https://measurement-api.slf.ch/public/api/imis';

async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'wochenend-planer-snow' }, signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

try {
  const [stations, daily] = await Promise.all([getJson(`${API}/stations`), getJson(`${API}/daily-snow?period_in_days=3`)]);
  const byStation = new Map();
  for (const d of daily) {
    const list = byStation.get(d.station_code) ?? [];
    list.push(d);
    byStation.set(d.station_code, list);
  }
  let latest = '';
  const out = [];
  for (const s of stations) {
    if (s.type !== 'SNOW_FLAT') continue;
    const days = (byStation.get(s.code) ?? []).sort((a, b) => (a.measure_date < b.measure_date ? 1 : -1));
    const today = days[0];
    if (!today || typeof today.HS !== 'number') continue;
    const date = today.measure_date.slice(0, 10);
    if (date > latest) latest = date;
    // New snow of the last 3 days (missing days count as 0).
    const hn3 = days.slice(0, 3).reduce((a, d) => a + (typeof d.HN_1D === 'number' ? d.HN_1D : 0), 0);
    out.push({ c: s.code, n: s.label, lat: Number(s.lat.toFixed(5)), lon: Number(s.lon.toFixed(5)), e: Math.round(s.elevation), d: date, hs: Math.round(today.HS), hn3: Math.round(hn3) });
  }
  if (out.length < 30) throw new Error(`nur ${out.length} Stationen`);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ format: 'wochenend-planer-snow', generatedAt: new Date().toISOString(), date: latest, attribution: 'Schneedaten: SLF (IMIS), CC BY 4.0', stations: out }));
  console.log(`${out.length} Schneestationen (${latest}) → ${OUT}`);
} catch (e) {
  console.warn(`Schneedaten nicht geladen: ${e instanceof Error ? e.message : e}`);
}
