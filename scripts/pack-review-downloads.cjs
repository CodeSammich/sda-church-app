#!/usr/bin/env node
/**
 * Packs a joined key-screens folder (merge-key-screens.cjs) into the
 * downloads a reviewer opens in Chrome, each under the 50 MB Chrome looks inside.
 *
 * Chrome looks inside a zip only up to 50 MB (Chromium's
 * download_file_types.asciipb: zip max_file_size_to_analyze 52428800). A
 * bigger zip is judged without seeing that it holds only pictures, and 1.7.0's
 * 349 MB iPhone and iPad screenshots were called dangerous. Before #484,
 * Chrome blocked the one download that held them and the unsigned app. So:
 *
 * - each device's screenshots are their own download, as palette PNGs: the
 *   same names, size, and flat colours, at about a quarter of the bytes;
 * - a device whose shots still pass PART_TARGET_BYTES is split into parts, in
 *   name order, each with the run's ocr.json, checks.json, and
 *   settle-times.json;
 * - each store folder's copies are a download of their own, untouched, since
 *   they're uploaded as they are: the App Store's iPhone copies (app-store),
 *   its iPad copies (app-store-ipad), and Google Play's (google-play). With
 *   1.7.1's English, Traditional and Simplified Chinese sets, the iPhone's and
 *   iPad's together came to 52.6 MB (#681).
 *
 *   node scripts/pack-review-downloads.cjs --from <joined screens folder> --out <folder> \
 *     --devices ios,ipad --store app-store,app-store-ipad
 *
 * Writes <out>/<device>-<n>/screens/<platform>/*.png (iphone-1, ipad-1,
 * android-1, …) and <out>/<store folder>/screens/<store folder>/, which the workflows
 * upload, at most MAX_PARTS parts a device. Fails if a device needs more parts
 * than that, or a download passes 50 MB; see "Downloads under 50 MB"
 * in docs/operations/native-builds.md.
 */
const { appendFileSync, cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } = require('node:fs');
const { availableParallelism } = require('node:os');
const { join, resolve } = require('node:path');
const sharp = require('sharp');

/** The most Chrome looks inside: 50 MiB. */
const CHROME_LIMIT_BYTES = 52428800;
/** Each part's aim, leaving room for the zip's own bytes. */
const PART_TARGET_BYTES = 45 * 1048576;
/** The parts a device's workflow uploads. */
const MAX_PARTS = 3;
const DEVICE_NAMES = { ios: 'iphone', ipad: 'ipad', android: 'android' };
const RESULTS = ['ocr.json', 'checks.json', 'settle-times.json'];
// 256 colours keep the app's flat colours exact and dither its photos, which
// look the same at a glance (measured on 1.7.0's shots).
const PALETTE = { palette: true, quality: 95, effort: 7, compressionLevel: 9 };

const megabytes = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

/**
 * Splits files, in order, into the fewest parts of about equal size that each
 * stay within `budget` bytes. Returns the parts as lists of indexes.
 */
const planParts = (sizes, budget) => {
  const total = sizes.reduce((sum, size) => sum + size, 0);
  if (!sizes.length) return [];
  if (sizes.some((size) => size > budget)) throw new Error(`A file is larger than ${megabytes(budget)} alone.`);
  for (let count = Math.max(1, Math.ceil(total / budget)); ; count++) {
    const parts = [];
    let part = [];
    let before = 0;
    sizes.forEach((size, index) => {
      // Cut where the running total passes this part's share, so the parts
      // come out about equal rather than full, full, and a little.
      const share = (total * (parts.length + 1)) / count;
      if (part.length && parts.length < count - 1 && before + size / 2 > share) {
        parts.push(part);
        part = [];
      }
      part.push(index);
      before += size;
    });
    parts.push(part);
    if (parts.every((indexes) => indexes.reduce((sum, index) => sum + sizes[index], 0) <= budget)) return parts;
  }
};

/** Runs `work` on each item, `limit` at a time. */
const eachLimited = async (items, limit, work) => {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await work(items[index], index);
    }
  });
  await Promise.all(workers);
};

const folderBytes = (dir) =>
  readdirSync(dir, { recursive: true })
    .map((name) => join(dir, name))
    .filter((file) => statSync(file).isFile())
    .reduce((sum, file) => sum + statSync(file).size, 0);

/**
 * Packs `from` into `out`, given the platform folders to pack (ios, ipad,
 * android) and the store folders to copy. Returns what it wrote and any
 * problems.
 */
const pack = async ({ from, out, devices, store = [], budget = PART_TARGET_BYTES, maxParts = MAX_PARTS }) => {
  const problems = [];
  const downloads = [];
  const results = RESULTS.filter((name) => existsSync(join(from, name)));
  const resultBytes = results.reduce((sum, name) => sum + statSync(join(from, name)).size, 0);

  for (const platform of devices) {
    const dir = join(from, platform);
    const names = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.png')).sort() : [];
    if (!names.length) continue;
    const staging = join(out, `.${platform}`);
    mkdirSync(staging, { recursive: true });
    await eachLimited(names, availableParallelism(), (name) =>
      sharp(join(dir, name)).png(PALETTE).toFile(join(staging, name)),
    );
    const sizes = names.map((name) => statSync(join(staging, name)).size);
    const parts = planParts(sizes, budget - resultBytes);
    if (parts.length > maxParts) {
      problems.push(
        `The ${DEVICE_NAMES[platform]} screenshots need ${parts.length} downloads under ${megabytes(budget)}, ` +
          `but the workflow uploads ${maxParts}: add upload steps for the rest, and raise MAX_PARTS and its test.`,
      );
    }
    parts.forEach((indexes, index) => {
      const name = `${DEVICE_NAMES[platform]}-${index + 1}`;
      const target = join(out, name, 'screens');
      mkdirSync(join(target, platform), { recursive: true });
      for (const each of indexes) cpSync(join(staging, names[each]), join(target, platform, names[each]));
      for (const result of results) cpSync(join(from, result), join(target, result));
      downloads.push({
        name,
        shots: indexes.length,
        first: names[indexes[0]],
        last: names[indexes[indexes.length - 1]],
        bytes: folderBytes(join(out, name)),
      });
    });
  }

  for (const name of store.filter((each) => existsSync(join(from, each)))) {
    cpSync(join(from, name), join(out, name, 'screens', name), { recursive: true });
    downloads.push({ name, folders: [name], bytes: folderBytes(join(out, name)) });
  }

  for (const download of downloads) {
    if (download.bytes > CHROME_LIMIT_BYTES) {
      problems.push(`${download.name} is ${megabytes(download.bytes)}, past the ${megabytes(CHROME_LIMIT_BYTES)} Chrome checks.`);
    }
  }
  return { downloads, problems };
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const option = (name) => {
    const index = args.indexOf(name);
    return index === -1 ? undefined : args[index + 1];
  };
  const from = option('--from');
  const out = option('--out');
  const devices = (option('--devices') || '').split(',').filter(Boolean);
  const store = (option('--store') || '').split(',').filter(Boolean);
  if (!from || !out || !devices.length || !devices.every((device) => DEVICE_NAMES[device])) {
    console.error('Usage: node scripts/pack-review-downloads.cjs --from <joined screens folder> --out <folder> --devices ios,ipad|android [--store <folder>,...]');
    process.exit(2);
  }
  pack({ from: resolve(from), out: resolve(out), devices, store })
    .then(({ downloads, problems }) => {
      const summary = [
        '### Downloads, each under the 50 MB Chrome looks inside',
        '',
        ...downloads.map((download) =>
          download.folders
            ? `- \`${download.name}\`: ${download.folders.join(', ')}, ${megabytes(download.bytes)}`
            : `- \`${download.name}\`: ${download.shots} shots, ${download.first} to ${download.last}, ${megabytes(download.bytes)}`,
        ),
        ...problems.map((problem) => `- ❌ ${problem}`),
        '',
      ].join('\n');
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
      console.log(summary);
      for (const problem of problems) console.log(`::error::${problem} See "Downloads under 50 MB" in docs/operations/native-builds.md.`);
      // A join that failed before writing anything still gets its summary.
      mkdirSync(resolve(out), { recursive: true });
      writeFileSync(join(resolve(out), 'downloads.json'), `${JSON.stringify(downloads, null, 2)}\n`);
      if (problems.length) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { CHROME_LIMIT_BYTES, PART_TARGET_BYTES, MAX_PARTS, DEVICE_NAMES, PALETTE, planParts, pack };
