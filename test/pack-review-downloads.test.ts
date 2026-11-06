import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The key-screens downloads a reviewer opens in Chrome, each under the 50 MB
// Chrome looks inside (scripts/pack-review-downloads.cjs). 1.7.0's 349 MB of
// iPhone and iPad screenshots were called dangerous.
const sharp = require('sharp');
const { CHROME_LIMIT_BYTES, PART_TARGET_BYTES, MAX_PARTS, planParts, pack } = require('../scripts/pack-review-downloads.cjs');

const sum = (sizes: number[], part: number[]) => part.reduce((total, index) => total + sizes[index], 0);

describe('planParts', () => {
  it('keeps everything in one part when it fits', () => {
    expect(planParts([10, 20, 30], 100)).toEqual([[0, 1, 2]]);
    expect(planParts([], 100)).toEqual([]);
  });

  it('splits in order into the fewest parts of about equal size, each within the budget', () => {
    // About 1.7.0's iPhone shots: 126 palette PNGs, 50 MB in all.
    const sizes = Array.from({ length: 126 }, (_, index) => 300_000 + ((index * 7919) % 200_000));
    expect(sum(sizes, sizes.map((_, index) => index))).toBeGreaterThan(PART_TARGET_BYTES);
    const parts = planParts(sizes, PART_TARGET_BYTES);
    expect(parts.length).toBe(2);
    expect(parts.flat()).toEqual(sizes.map((_, index) => index));
    const [first, second] = parts.map((part: number[]) => sum(sizes, part));
    expect(Math.abs(first - second)).toBeLessThan(600_000);

    const uneven = [90, 10, 10, 10, 10, 10, 10, 10, 10, 10];
    for (const part of planParts(uneven, 100)) expect(sum(uneven, part)).toBeLessThanOrEqual(100);
  });

  it("refuses a file that can't fit in any part", () => {
    expect(() => planParts([10, 200], 100)).toThrow('larger than');
  });

  it('aims under the limit Chrome looks inside', () => {
    expect(CHROME_LIMIT_BYTES).toBe(52428800);
    expect(PART_TARGET_BYTES).toBeLessThan(CHROME_LIMIT_BYTES);
    expect(MAX_PARTS).toBe(3);
  });
});

describe('pack', () => {
  // A joined folder as merge-key-screens.cjs leaves it: a device's shots,
  // the run's results, and store copies.
  const joined = async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pack-review-'));
    const from = join(dir, 'screens');
    mkdirSync(join(from, 'ios'), { recursive: true });
    mkdirSync(join(from, 'app-store', 'en-US'), { recursive: true });
    for (const name of ['bible-default', 'home-dark', 'home-default', 'you-zh']) {
      // Noise, so each is about 25 KB as a palette PNG.
      await sharp(randomBytes(120 * 200 * 3), { raw: { width: 120, height: 200, channels: 3 } })
        .png()
        .toFile(join(from, 'ios', `${name}.png`));
    }
    await sharp({ create: { width: 60, height: 120, channels: 3, background: '#f3e6df' } })
      .png()
      .toFile(join(from, 'app-store', 'en-US', '01-home-default.png'));
    for (const name of ['ocr.json', 'checks.json', 'settle-times.json']) writeFileSync(join(from, name), '[]\n');
    return { from, out: join(dir, 'review') };
  };

  it('writes palette copies with the same names and sizes, the results in every part, and the store copies untouched', async () => {
    const { from, out } = await joined();
    const { downloads, problems } = await pack({ from, out, devices: ['ios'], store: ['app-store'], budget: 60_000 });
    expect(problems).toEqual([]);
    const parts = downloads.filter((download: { name: string }) => download.name.startsWith('iphone-'));
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.map((part: { name: string }) => part.name)).toEqual(parts.map((_: unknown, index: number) => `iphone-${index + 1}`));
    const shots = parts.flatMap((part: { name: string }) => readdirSync(join(out, part.name, 'screens', 'ios')));
    expect(shots).toEqual(['bible-default.png', 'home-dark.png', 'home-default.png', 'you-zh.png']);
    for (const part of parts) {
      for (const name of ['ocr.json', 'checks.json', 'settle-times.json']) expect(existsSync(join(out, part.name, 'screens', name))).toBe(true);
      expect(part.bytes).toBeLessThanOrEqual(60_000);
    }
    const copy = await sharp(join(out, 'iphone-1', 'screens', 'ios', 'bible-default.png')).metadata();
    expect(copy).toMatchObject({ format: 'png', width: 120, height: 200, isPalette: true });
    // Each store folder is a download of its own, so the App Store's iPhone and
    // iPad copies each stay under 50 MB (#681).
    const store = 'app-store/en-US/01-home-default.png';
    expect(readFileSync(join(out, 'app-store', 'screens', store))).toEqual(readFileSync(join(from, store)));
    expect(downloads.at(-1)).toMatchObject({ name: 'app-store', folders: ['app-store'] });
  });

  it("makes the App Store's iPhone and iPad copies separate downloads (#681)", async () => {
    const { from, out } = await joined();
    mkdirSync(join(from, 'app-store-ipad', 'en-US'), { recursive: true });
    writeFileSync(join(from, 'app-store-ipad', 'en-US', '01-home-default.png'), 'ipad');
    const { downloads, problems } = await pack({ from, out, devices: ['ios'], store: ['app-store', 'app-store-ipad'] });
    expect(problems).toEqual([]);
    expect(downloads.filter((download: { folders?: string[] }) => download.folders)).toEqual([
      expect.objectContaining({ name: 'app-store', folders: ['app-store'] }),
      expect.objectContaining({ name: 'app-store-ipad', folders: ['app-store-ipad'] }),
    ]);
    expect(existsSync(join(out, 'app-store-ipad', 'screens', 'app-store-ipad', 'en-US', '01-home-default.png'))).toBe(true);
    expect(existsSync(join(out, 'app-store', 'screens', 'app-store-ipad'))).toBe(false);
  });

  it('says so when a device needs more parts than the workflow uploads', async () => {
    const { from, out } = await joined();
    const { problems } = await pack({ from, out, devices: ['ios'], budget: 30_000, maxParts: 1 });
    expect(problems).toEqual([expect.stringMatching(/^The iphone screenshots need \d downloads under .*, but the workflow uploads 1: add upload steps/)]);
  });
});
