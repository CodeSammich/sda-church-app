#!/usr/bin/env node
/**
 * Joins the key-screen parts that several runners captured and checked
 * (capture-ios-screens.cjs and check-screens.cjs with --shard) into the one
 * folder a single runner used to make, for the screenshot review (#453):
 * every ios/*.png, ocr.json, checks.json, and settle-times.json in list order,
 * and the App Store copies, which need shots from every part.
 *
 *   node scripts/merge-key-screens.cjs --out <screens folder> <part screens folder>...
 *
 * Writes a summary to the step summary. Exits 1 if a shot is missing or any
 * part's checks failed.
 */
const { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');
const { loadConfig, planAppStore, planCaptures, writeAppStoreCopy } = require('./capture-ios-screens.cjs');

const readJson = (file, empty) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : empty);

/**
 * Merges the parts' results, given each part's ocr.json, checks.json, and
 * settle-times.json, into list order. Returns what's missing too.
 */
const mergeResults = (shots, parts) => {
  const byFile = (entries, key) => new Map(entries.flatMap((entry) => entry).map((entry) => [entry[key], entry]));
  const checks = byFile(parts.map((part) => part.checks), 'file');
  const timings = byFile(parts.map((part) => part.timings), 'shot');
  // ocr.json is keyed by each runner's path to the screenshot; keep only the
  // part from ios/ on, since the runners' folders all look alike.
  const ocr = {};
  for (const part of parts) {
    for (const [file, lines] of Object.entries(part.ocr)) ocr[file.slice(file.lastIndexOf('/ios/') + 1)] = lines;
  }
  return {
    checks: shots.map((shot) => checks.get(shot.file) || { file: shot.file, problems: ['no part checked it'] }),
    timings: shots.map((shot) => timings.get(shot.name)).filter(Boolean),
    ocr,
  };
};

const merge = async (outDir, partDirs) => {
  const config = loadConfig();
  const shots = planCaptures(config);
  mkdirSync(join(outDir, 'ios'), { recursive: true });
  for (const partDir of partDirs) {
    const iosDir = join(partDir, 'ios');
    if (!existsSync(iosDir)) continue;
    for (const name of readdirSync(iosDir)) copyFileSync(join(iosDir, name), join(outDir, 'ios', name));
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
    if (!existsSync(join(outDir, shot.file))) problems.push(`${shot.file}: no part captured it`);
  }
  for (const copy of planAppStore(config)) {
    const source = join(outDir, `ios/${copy.name}.png`);
    if (!existsSync(source)) continue;
    const file = join(outDir, copy.file);
    mkdirSync(dirname(file), { recursive: true });
    await writeAppStoreCopy(source, file);
  }

  const failed = checks.filter((check) => check.problems.length);
  const slowest = [...timings].sort((a, b) => b.settledAfter - a.settledAfter).slice(0, 5);
  const summary = [
    `### Key screens, ${partDirs.length} parts joined`,
    '',
    `${shots.length - problems.length} of ${shots.length} captured; ${checks.length - failed.length} of ${checks.length} pass the text checks.`,
    ...problems.map((problem) => `- ❌ ${problem}`),
    ...failed.map((check) => `- ❌ ${check.file}: ${check.problems.join('; ')}`),
    '',
    `Settled within 5 seconds: ${timings.filter((timing) => timing.settledAfter <= 5).length} of ${timings.length}. ` +
      `Slowest: ${slowest.map((timing) => `${timing.shot} ${timing.settledAfter}s`).join(', ')}.`,
    '',
  ].join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  console.log(summary);
  if (problems.length || failed.length) process.exitCode = 1;
};

if (require.main === module) {
  const [flag, out, ...partDirs] = process.argv.slice(2);
  const outDir = flag === '--out' && out ? resolve(out) : undefined;
  if (!outDir || !partDirs.length) {
    console.error('Usage: node scripts/merge-key-screens.cjs --out <screens folder> <part screens folder>...');
    process.exit(2);
  }
  merge(outDir, partDirs.map((partDir) => resolve(partDir))).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { mergeResults, merge };
