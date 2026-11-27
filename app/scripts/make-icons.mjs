// Generates the app icons (PNG) without extra dependencies: white ground, black mountains,
// red sun (Swiss Style). Run: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(out, { recursive: true });

const INK = [0x11, 0x11, 0x11];
const RED = [0xd5, 0x2b, 0x1e];
const WHITE = [0xff, 0xff, 0xff];

/** Shape test in unit coordinates (0..1). `pad` shrinks the motif for maskable icons. */
function colourAt(x, y, pad) {
  const u = (x - pad) / (1 - 2 * pad);
  const v = (y - pad) / (1 - 2 * pad);
  // Sun
  const dx = u - 0.66;
  const dy = v - 0.3;
  if (dx * dx + dy * dy <= 0.13 * 0.13) return RED;
  // Mountains: two triangles on a base line
  const base = 0.8;
  const inTri = (peakX, peakY, halfWidth) => v <= base && v >= peakY && Math.abs(u - peakX) <= ((v - peakY) / (base - peakY)) * halfWidth;
  if (inTri(0.38, 0.34, 0.3) || inTri(0.68, 0.5, 0.24)) return INK;
  if (v > base && v <= base + 0.035 && u >= 0.08 && u <= 0.92) return INK;
  return WHITE;
}

function png(size, pad) {
  const ss = 4; // supersampling for smooth edges
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const c = colourAt((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size, pad);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = Math.round(r / (ss * ss));
      raw[o + 1] = Math.round(g / (ss * ss));
      raw[o + 2] = Math.round(b / (ss * ss));
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const icons = [
  ['pwa-192x192.png', 192, 0.06],
  ['pwa-512x512.png', 512, 0.06],
  ['maskable-512x512.png', 512, 0.16],
  ['apple-touch-icon.png', 180, 0.08],
  ['favicon-32.png', 32, 0.02],
];
for (const [name, size, pad] of icons) {
  writeFileSync(join(out, name), png(size, pad));
  console.log('wrote', name);
}
