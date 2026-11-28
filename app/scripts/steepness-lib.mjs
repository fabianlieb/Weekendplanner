// Steepest slope near a route, from the swisstopo layer «Hangneigung über 30°» (classes per SLF
// recommendation, 10 m model). Pure helpers; build-steepness.mjs does the downloading.
//
// GRM (Grafische Reduktionsmethode) looks at the steepest spot of about 20 m × 20 m in an area that
// grows with the danger level: «Bereich der Spur» (gering, mässig), «ganzer Hang» (erheblich),
// «ganzer Hang inkl. Auslaufbereich» (gross). We measure three corridors around the route line.

export const ZOOM = 14;
/** Corridor half-widths in metres: track area (about 20 m around the track), whole slope, incl. runout. */
export const CORRIDORS_M = [20, 150, 300];
/**
 * A class counts from a connected area of this many pixels (≈ 20 m × 20 m at zoom 14, 6.6 m per pixel
 * in Switzerland). Scattered single cells (rock, banks, road cuts) do not add up.
 */
export const MIN_PIXELS = 9;

/** Legend colours → class: 1 = 30–35°, 2 = 35–40°, 3 = 40–45°, 4 = 45–50°, 5 = über 50°. */
const LEGEND = [
  [242, 229, 10, 1],
  [244, 111, 36, 2],
  [222, 5, 91, 3],
  [200, 137, 187, 4],
  [75, 75, 75, 5],
];

/** RGBA tile → slope class per pixel (0 = under 30° or no data). */
export function classesFromRgba(rgba) {
  const out = new Uint8Array(rgba.length / 4);
  for (let i = 0; i < out.length; i++) {
    if (rgba[i * 4 + 3] < 128) continue;
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    let best = 0;
    let bestD = 60 * 60; // only near-exact legend colours count
    for (const [lr, lg, lb, cls] of LEGEND) {
      const d = (r - lr) ** 2 + (g - lg) ** 2 + (b - lb) ** 2;
      if (d < bestD) {
        bestD = d;
        best = cls;
      }
    }
    out[i] = best;
  }
  return out;
}

export function worldPx(lat, lon, z = ZOOM) {
  const n = 256 * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return [((lon + 180) / 360) * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
}

/** Metres per pixel at a latitude. */
export function metresPerPixel(lat, z = ZOOM) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
}

/**
 * Grid around the route with the distance of each pixel to the line (in pixels, chamfer 1/√2).
 * Returns { x0, y0, w, h, dist: Float32Array, mpp }.
 */
export function corridorGrid(lines, maxMetres = CORRIDORS_M[CORRIDORS_M.length - 1]) {
  const pts = lines.flat();
  const lat0 = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const mpp = metresPerPixel(lat0);
  const margin = Math.ceil(maxMetres / mpp) + 2;
  const px = lines.map((l) => l.map(([lat, lon]) => worldPx(lat, lon)));
  const xs = px.flat().map((p) => p[0]);
  const ys = px.flat().map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs)) - margin;
  const y0 = Math.floor(Math.min(...ys)) - margin;
  const w = Math.ceil(Math.max(...xs)) + margin - x0 + 1;
  const h = Math.ceil(Math.max(...ys)) + margin - y0 + 1;
  const dist = new Float32Array(w * h).fill(1e9);
  for (const l of px) {
    for (let i = 0; i < l.length; i++) {
      const [ax, ay] = l[i];
      const [bx, by] = l[Math.min(i + 1, l.length - 1)];
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
      for (let s = 0; s <= steps; s++) {
        const x = Math.round(ax + ((bx - ax) * s) / steps) - x0;
        const y = Math.round(ay + ((by - ay) * s) / steps) - y0;
        if (x >= 0 && y >= 0 && x < w && y < h) dist[y * w + x] = 0;
      }
    }
  }
  const D = Math.SQRT2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let d = dist[i];
      if (x > 0) d = Math.min(d, dist[i - 1] + 1);
      if (y > 0) {
        d = Math.min(d, dist[i - w] + 1);
        if (x > 0) d = Math.min(d, dist[i - w - 1] + D);
        if (x < w - 1) d = Math.min(d, dist[i - w + 1] + D);
      }
      dist[i] = d;
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let d = dist[i];
      if (x < w - 1) d = Math.min(d, dist[i + 1] + 1);
      if (y < h - 1) {
        d = Math.min(d, dist[i + w] + 1);
        if (x < w - 1) d = Math.min(d, dist[i + w + 1] + D);
        if (x > 0) d = Math.min(d, dist[i + w - 1] + D);
      }
      dist[i] = d;
    }
  return { x0, y0, w, h, dist, mpp };
}

/** Tiles (x, y) at ZOOM that contain at least one pixel within the widest corridor. */
export function tilesFor(grid) {
  const maxPx = CORRIDORS_M[CORRIDORS_M.length - 1] / grid.mpp;
  const out = new Set();
  for (let y = 0; y < grid.h; y++)
    for (let x = 0; x < grid.w; x++)
      if (grid.dist[y * grid.w + x] <= maxPx) out.add(`${Math.floor((grid.x0 + x) / 256)},${Math.floor((grid.y0 + y) / 256)}`);
  return [...out].map((k) => k.split(',').map(Number));
}

/** Pixels this close to the line count as «on the track» (≈ 10 m, the accuracy of the route lines). */
export const ON_TRACK_PX = 1.5;

/**
 * Largest connected area (8-neighbours, in pixels) of slopes of class ≥ c inside each corridor,
 * for c = 1…5: sizes[corridor][c − 1]. `classAt(worldX, worldY)` returns the class of a pixel.
 * Track area: only areas the route itself crosses count – steep flanks beside a ridge or rock
 * bands next to the track do not. Whole slope and runout: areas connected to the track area
 * (±20 m), i.e. the slope the route is in; rock over 50° does not count there (hardly any snow
 * stays on it, it is not a typical release area).
 * Union-find, adding the steepest pixels first, so one pass per corridor gives all thresholds.
 */
export function componentSizes(grid, classAt) {
  const { w, h, dist } = grid;
  const cls = new Uint8Array(w * h);
  const maxPx = CORRIDORS_M[CORRIDORS_M.length - 1] / grid.mpp;
  const inWide = [];
  for (let i = 0; i < w * h; i++) {
    if (dist[i] > maxPx) continue;
    const c = classAt(grid.x0 + (i % w), grid.y0 + Math.floor(i / w));
    if (c) {
      cls[i] = c;
      inWide.push(i);
    }
  }
  const parent = new Int32Array(w * h);
  const size = new Int32Array(w * h);
  const active = new Uint8Array(w * h);
  const touch = new Uint8Array(w * h);
  const find = (a) => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  return CORRIDORS_M.map((m, corridor) => {
    const lim = m / grid.mpp;
    // Pixels that make an area count: on the track (track area) or within the track area (slopes).
    const touchPx = corridor === 0 ? ON_TRACK_PX : CORRIDORS_M[0] / grid.mpp;
    const pts = inWide.filter((i) => dist[i] <= lim && (corridor === 0 || cls[i] < 5)).sort((a, b) => cls[b] - cls[a]);
    active.fill(0);
    const out = [0, 0, 0, 0, 0];
    let best = 0;
    let k = 0;
    for (let c = 5; c >= 1; c--) {
      for (; k < pts.length && cls[pts[k]] >= c; k++) {
        const i = pts[k];
        parent[i] = i;
        size[i] = 1;
        active[i] = 1;
        touch[i] = dist[i] <= touchPx ? 1 : 0;
        const x = i % w;
        for (const d of [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1]) {
          const j = i + d;
          if (j < 0 || j >= w * h || !active[j]) continue;
          const jx = j % w;
          if (Math.abs(jx - x) > 1) continue;
          const ri = find(i);
          const rj = find(j);
          if (ri === rj) continue;
          if (size[ri] < size[rj]) {
            parent[ri] = rj;
            size[rj] += size[ri];
            touch[rj] |= touch[ri];
          } else {
            parent[rj] = ri;
            size[ri] += size[rj];
            touch[ri] |= touch[rj];
          }
        }
        const root = find(i);
        if (touch[root]) best = Math.max(best, size[root]);
      }
      out[c - 1] = best;
    }
    return out;
  });
}

/** Steepest class per corridor whose connected area reaches `minPixels` (0 = none over 30°). */
export function classesFromSizes(sizes, minPixels = MIN_PIXELS) {
  return sizes.map((s) => {
    for (let c = 5; c >= 1; c--) if (s[c - 1] >= minPixels) return c;
    return 0;
  });
}

/** Steepest class per corridor (connected areas of at least MIN_PIXELS). */
export function steepestClasses(grid, classAt) {
  return classesFromSizes(componentSizes(grid, classAt));
}
