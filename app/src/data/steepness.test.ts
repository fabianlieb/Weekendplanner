import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS module shared with the build scripts
import { decodePng } from '../../scripts/png-lib.mjs';
// @ts-expect-error plain JS module shared with the build scripts
import { CORRIDORS_M, MIN_PIXELS, classesFromRgba, corridorGrid, steepestClasses, tilesFor, worldPx } from '../../scripts/steepness-lib.mjs';

/** Tiny RGBA PNG (filter 0 rows) for the decoder. */
function png(width: number, height: number, pixel: (x: number, y: number) => [number, number, number, number]): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) raw.set(pixel(x, y), y * (width * 4 + 1) + 1 + x * 4);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

describe('slope classes from the swisstopo layer', () => {
  it('decodes PNG tiles and maps legend colours to classes', () => {
    const colours: [number, number, number, number][] = [
      [0, 0, 0, 0],
      [242, 229, 10, 255],
      [244, 111, 36, 255],
      [222, 5, 91, 255],
      [200, 137, 187, 255],
      [75, 75, 75, 255],
    ];
    const img = decodePng(png(6, 1, (x) => colours[x]!));
    expect(img.width).toBe(6);
    expect([...classesFromRgba(img.rgba)]).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('measures the steepest class per corridor, ignoring tiny spots', () => {
    const line = [
      [46.8, 9.8],
      [46.81, 9.8],
    ];
    const grid = corridorGrid([line]);
    expect(grid.mpp).toBeGreaterThan(6);
    expect(tilesFor(grid).length).toBeGreaterThan(0);
    const [lineX] = worldPx(46.805, 9.8);
    // a band of class 2 right on the line, a single class-5 pixel on the line every 50 px, a class-3 band
    // 15 m beside the line (a ridge flank: not for the track area, but part of the slope), a detached
    // class-4 band 100 m away (another slope: does not count) and a rock wall (class 5) 40 m away that
    // is connected to the slope (rock does not count as a release area)
    const at100 = lineX + 100 / grid.mpp;
    const at15 = lineX + 15 / grid.mpp;
    const at40 = lineX + 40 / grid.mpp;
    const classAt = (wx: number, wy: number) => {
      if (Math.abs(wx - lineX) < 1.5) return wx === Math.round(lineX) && wy % 50 === 0 ? 5 : 2;
      if (Math.abs(wx - at15) < 0.6) return 3;
      if (wx > at15 && wx < at40) return 1;
      if (Math.abs(wx - at40) < 1.5) return 5;
      if (Math.abs(wx - at100) < 1.5) return 4;
      return 0;
    };
    const [spur, hang, auslauf] = steepestClasses(grid, classAt);
    expect(spur).toBe(2);
    expect(hang).toBe(3);
    expect(auslauf).toBe(3);
    expect(CORRIDORS_M).toEqual([20, 150, 300]);
    expect(MIN_PIXELS).toBeGreaterThan(1);
  });
});
