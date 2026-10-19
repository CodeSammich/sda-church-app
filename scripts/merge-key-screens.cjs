#!/usr/bin/env node
/**
 * Joins one platform's key-screen groups that several runners captured and
 * checked (capture-ios-screens.cjs or capture-android-screens.cjs, and
 * check-screens.cjs, with --group) into the one folder a single runner used to
 * make, for the screenshot review (#453, #372): every <platform>/*.png,
 * ocr.json, checks.json, and settle-times.json in list order, and the App
 * Store or Google Play copies, which need shots from every part.
 *
 *   node scripts/merge-key-screens.cjs --platform ios|android --out <screens folder> <part screens folder>...
 *
 * Writes a summary to the step summary. Exits 1 if a shot is missing or any
 * part's checks failed.
 */
const { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');
const { writePlayCopy } = require('./capture-android-screens.cjs');
const { PLATFORMS, loadConfig, planCaptures, planStoreCopies, writeAppStoreCopy } = require('./capture-ios-screens.cjs');

const readJson = (file, empty) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : empty);

/**
 * Merges the parts' results, given each part's ocr.json, checks.json, and
 * settle-times.json, into list order. Returns what's missing too.
 */
const mergeResults = (shots, parts) => {
  const byFile = (entries, key) => new Map(entries.flatMap((entry) => entry).map((entry) => [entry[key], entry]));
  const checks = byFile(parts.map((part) => part.checks), 'file');
  // Both platforms have a shot of each name, so timings go by file.
  const timings = byFile(parts.map((part) => part.timings), 'file');
  // ocr.json is keyed by each runner's path to the screenshot; keep only the
  // part from ios/ or android/ on, since the runners' folders all look alike.
  const ocr = {};
  for (const part of parts) {
    for (const [file, lines] of Object.entries(part.ocr)) {
      ocr[file.replace(new RegExp(`^.*/(?=(${PLATFORMS.join('|')})/[^/]+$)`), '')] = lines;
    }
  }
  return {
    checks: shots.map((shot) => checks.get(shot.file) || { file: shot.file, problems: ['no group checked it'] }),
    timings: shots.map((shot) => timings.get(shot.file)).filter(Boolean),
    ocr,
  };
};

const merge = async (outDir, partDirs, platform = 'ios') => {
  const config = loadConfig();
  const shots = planCaptures(config, platform);
  mkdirSync(join(outDir, platform), { recursive: true });
  for (const partDir of partDirs) {
    const shotDir = join(partDir, platform);
    if (!existsSync(shotDir)) continue;
    for (const name of readdirSync(shotDir)) copyFileSync(join(shotDir, name), join(outDir, platform, name));
  }

  const parts = partDirs.map((partDir) => ({
    checks: readJson(join(partDir, 'checks.json'), []),
    timings: readJson(join(partDir, 'settle-times.json'), []),
    ocr: readJson(join(partDir, 'ocr.json'), {}),
  }));
  const { checks, timings, ocr } = mergeResults(shots, parts);
  writeFileSync(join(outDir, 'checks.json'), JSON.stringify(checks, null, 1));
  writeFileSync(join(outDir, 'settle-times.json'), `${JSON.stringify(timings, null, 2)}\n`);
  writeFileSync(join(outDir, 'ocr.json'), JSON.stringify(ocr, null, 1));

  const problems = [];
  for (const shot of shots) {
    if (!existsSync(join(outDir, shot.file))) problems.push(`${shot.file}: no group captured it`);
  }
  for (const copy of planStoreCopies(config, platform)) {
    const source = join(outDir, copy.source);
    if (!existsSync(source)) continue;
    const file = join(outDir, copy.file);
    mkdirSync(dirname(file), { recursive: true });
    try {
      await (copy.platform === 'android' ? writePlayCopy : writeAppStoreCopy)(source, file);
    } catch (error) {
      problems.push(`${copy.file}: ${error.message}`);
    }
  }

  const failed = checks.filter((check) => check.problems.length);
  const slowest = [...timings].sort((a, b) => b.settledAfter - a.settledAfter).slice(0, 5);
  const summary = [
    `### ${platform === 'ios' ? 'iPhone' : 'Android'} key screens, ${partDirs.length} groups joined`,
    '',
    `${shots.length - problems.length} of ${shots.length} captured; ${checks.length - failed.length} of ${checks.length} pass the text checks.`,
    ...problems.map((problem) => `- ❌ ${problem}`),
    ...failed.map((check) => `- ❌ ${check.file}: ${check.problems.join('; ')}`),
    '',
    `Settled within 5 seconds: ${timings.filter((timing) => timing.settledAfter <= 5).length} of ${timings.length}. ` +
      `Slowest: ${slowest.map((timing) => `${timing.file || timing.shot} ${timing.settledAfter}s`).join(', ')}.`,
    '',
  ].join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  console.log(summary);
  if (problems.length || failed.length) process.exitCode = 1;
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const option = (name) => {
    const index = args.indexOf(name);
    if (index === -1) return undefined;
    const [value] = args.splice(index, 2).slice(1);
    return value;
  };
  const platform = option('--platform') || 'ios';
  const out = option('--out');
  const outDir = out ? resolve(out) : undefined;
  if (!outDir || !args.length || !PLATFORMS.includes(platform)) {
    console.error('Usage: node scripts/merge-key-screens.cjs --platform ios|android --out <screens folder> <part screens folder>...');
    process.exit(2);
  }
  merge(outDir, args.map((partDir) => resolve(partDir)), platform).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { mergeResults, merge };
