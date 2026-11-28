// Small picture per place from Wikipedia / Wikimedia Commons (free, no key).
// Only shown if a Wikipedia article near the destination matches the place name; otherwise nothing.
// Author and licence come with it (CC licences require attribution). Cached on the device.
// Sent to Wikipedia: only the coordinates of the destination (public places), never your position.

import type { Candidate } from '../engine/types';
import type { PlannerDB } from './db';

export interface PlaceImage {
  url: string;
  title: string;
  pageUrl: string;
  file: string;
  artist?: string;
  license?: string;
  descriptionUrl?: string;
}

export interface ImageCacheRow {
  id: string;
  fetchedAt: string;
  image?: PlaceImage;
}

const TTL_DAYS = 30;
const API = 'https://de.wikipedia.org/w/api.php';
// Words that say nothing about the place
const GENERIC = new Set(['trail', 'schneeschuhtrail', 'schneeschuh', 'rundweg', 'rundtour', 'skigebiet', 'gipfel', 'route', 'davos', 'klosters', 'arosa', 'lenzerheide', 'grindelwald']);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Names to look for: the main part of the entry name and its distinctive words. */
export function nameKeys(name: string): string[] {
  const main = name.split(/ [–-] |\(|\//)[0] ?? name;
  const full = normalize(main);
  const words = full.split(' ').filter((w) => w.length >= 5 && !GENERIC.has(w));
  return [...new Set([full, ...words].filter(Boolean))];
}

interface WikiPage {
  title: string;
  pageimage?: string;
  thumbnail?: { source: string };
  index?: number;
}

/** Best page whose title matches the place name and has a photo (jpg/webp), or undefined. */
export function pickPage(pages: readonly WikiPage[], name: string): WikiPage | undefined {
  const keys = nameKeys(name);
  const rank = (p: WikiPage): number => {
    const t = normalize(p.title);
    if (keys[0] && t === keys[0]) return 3;
    if (keys.some((k) => t === k)) return 2;
    if (keys.some((k) => k.length >= 5 && (t.startsWith(`${k} `) || t.endsWith(` ${k}`)))) return 1;
    return 0;
  };
  const photo = (p: WikiPage) => !!p.thumbnail?.source && /\.(jpe?g|webp)$/i.test(p.pageimage ?? '');
  return pages
    .filter(photo)
    .map((p) => ({ p, r: rank(p) }))
    .filter((x) => x.r > 0)
    .sort((a, b) => b.r - a.r || (a.p.index ?? 99) - (b.p.index ?? 99))[0]?.p;
}

const stripHtml = (s: string | undefined) =>
  s
    ?.replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

type Fetch = (url: string, init?: RequestInit) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
const HEADERS = { 'Api-User-Agent': 'Wochenend-Planer PWA' };

export async function fetchPlaceImage(c: Pick<Candidate, 'name' | 'summit'>, fetchFn: Fetch = (u, i) => fetch(u, i)): Promise<PlaceImage | undefined> {
  const q = new URLSearchParams({
    action: 'query',
    generator: 'geosearch',
    ggscoord: `${c.summit.lat}|${c.summit.lon}`,
    ggsradius: '5000',
    ggslimit: '20',
    prop: 'pageimages',
    piprop: 'thumbnail|name',
    pithumbsize: '320',
    format: 'json',
    origin: '*',
  });
  const r = await fetchFn(`${API}?${q}`, { headers: HEADERS });
  if (!r.ok) return undefined;
  const j = (await r.json()) as { query?: { pages?: Record<string, WikiPage> } };
  const page = pickPage(Object.values(j.query?.pages ?? {}), c.name);
  if (!page?.pageimage || !page.thumbnail) return undefined;

  const image: PlaceImage = {
    url: page.thumbnail.source,
    title: page.title,
    pageUrl: `https://de.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    file: page.pageimage,
  };
  // Author and licence of the file
  try {
    const iq = new URLSearchParams({ action: 'query', titles: `Datei:${page.pageimage}`, prop: 'imageinfo', iiprop: 'extmetadata|url', format: 'json', origin: '*' });
    const ir = await fetchFn(`${API}?${iq}`, { headers: HEADERS });
    const ij = (await ir.json()) as {
      query?: { pages?: Record<string, { imageinfo?: { descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }[] }> };
    };
    const info = Object.values(ij.query?.pages ?? {})[0]?.imageinfo?.[0];
    const meta = info?.extmetadata ?? {};
    const artist = stripHtml(meta.Artist?.value);
    const license = stripHtml(meta.LicenseShortName?.value);
    return { ...image, ...(artist ? { artist } : {}), ...(license ? { license } : {}), ...(info?.descriptionurl ? { descriptionUrl: info.descriptionurl } : {}) };
  } catch {
    return image;
  }
}

/** Cached lookup (also caches «no picture»). Offline or on errors: undefined, not cached. */
export async function placeImage(db: PlannerDB, c: Candidate, now: Date = new Date(), fetchFn?: Fetch): Promise<PlaceImage | undefined> {
  const hit = await db.imageCache.get(c.id);
  if (hit && now.getTime() - Date.parse(hit.fetchedAt) < TTL_DAYS * 86400000) return hit.image;
  try {
    const image = await fetchPlaceImage(c, fetchFn);
    await db.imageCache.put({ id: c.id, fetchedAt: now.toISOString(), ...(image ? { image } : {}) });
    return image;
  } catch {
    return hit?.image;
  }
}
