/**
 * Weekly full expo-doctor run for the Expo Doctor Monitor workflow.
 *
 * Pull requests run expo-doctor without its dependency version check (the
 * Expo Doctor (config) job in PR Unit Tests), because Expo publishes SDK patch
 * releases often and each one would turn unrelated pull requests red. This
 * runs every check, including that one, and the workflow opens an alert issue
 * when it fails, so new Expo patch releases and packages out of step with the
 * SDK are noticed without blocking anyone.
 *
 * While React Native or Expo is a pre-release, as during the Expo 58 canary,
 * the versions can't match the SDK's, so the run is skipped and passes.
 *
 * Usage: node scripts/expo-doctor-monitor.cjs --report expo-doctor-report.json
 * Exits 1 when expo-doctor finds problems.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ALERT_TITLE = '[monitor] Expo doctor found problems';

// Long enough for every failed check; GitHub issues hold 65,536 characters.
const MAX_OUTPUT_LENGTH = 12000;

const stripAnsi = (text) => String(text || '').replace(/\u001b\[[0-9;]*m/g, '');

/** The installed versions that decide whether a full run can pass. */
const readInstalledVersions = (projectRoot) => {
  const read = (name) => {
    try {
      return require(path.join(projectRoot, 'node_modules', name, 'package.json')).version;
    } catch {
      return null;
    }
  };
  return { expo: read('expo'), reactNative: read('react-native') };
};

/** A reason to skip the run, or null. Pre-release versions have a hyphen. */
const getSkipReason = ({ expo, reactNative }) => {
  const prereleases = [
    ['Expo', expo],
    ['React Native', reactNative],
  ].filter(([, version]) => typeof version === 'string' && version.includes('-'));
  if (!prereleases.length) return null;
  return `${prereleases.map(([name, version]) => `${name} ${version}`).join(' and ')} ${
    prereleases.length > 1 ? 'are pre-releases' : 'is a pre-release'
  }, so the package versions can't match the SDK's yet.`;
};

const truncate = (text) =>
  text.length > MAX_OUTPUT_LENGTH
    ? `${text.slice(0, MAX_OUTPUT_LENGTH)}\n… (cut; the run's log has the rest)`
    : text;

/** Builds the alert issue text from the --report JSON, or from null. */
const buildExpoDoctorAlert = (report, runUrl) => {
  const output = report?.output
    ? ['```', truncate(stripAnsi(report.output).trim()), '```'].join('\n')
    : 'The report was missing. See the run for expo-doctor\'s output.';
  return {
    title: ALERT_TITLE,
    labels: [],
    body: [
      'The weekly full `expo-doctor` run found problems. Usually Expo has published SDK patch releases, and `npx expo install --check` lists them.',
      '',
      output,
      '',
      'To fix it, on a branch from `release-candidate`:',
      '',
      '1. Run `npx expo install --fix`, and update `expo-template-bare-minimum@…` everywhere it is pinned if `npm view expo-template-bare-minimum dist-tags.sdk-<SDK>` is newer.',
      '2. Run `npm run doctor`, `npm run check`, an Android build on the emulator, and a hand-started **iOS PR preview**.',
      '3. Open the pull request. This issue closes on the next passing weekly run.',
      '',
      'See **Expo doctor monitor alerts** in `docs/operations/admin-runbook.md`.',
      '',
      `Run: ${runUrl}`,
    ].join('\n'),
  };
};

const runExpoDoctor = (projectRoot) => {
  const result = spawnSync('npx', ['--no-install', 'expo-doctor'], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
  });
  return {
    exitCode: result.status ?? 1,
    output: stripAnsi(`${result.stdout || ''}${result.stderr || ''}${result.error ? `\n${result.error.message}` : ''}`),
  };
};

const main = () => {
  const reportIndex = process.argv.indexOf('--report');
  const reportPath = reportIndex >= 0 ? process.argv[reportIndex + 1] : null;
  const projectRoot = path.resolve(__dirname, '..');
  const versions = readInstalledVersions(projectRoot);
  const skipReason = getSkipReason(versions);

  const report = skipReason
    ? { status: 'skipped', reason: skipReason, versions }
    : (() => {
        const { exitCode, output } = runExpoDoctor(projectRoot);
        return { status: exitCode === 0 ? 'passed' : 'failed', exitCode, output, versions };
      })();

  if (reportPath) fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(report.status === 'skipped' ? `Skipped: ${report.reason}` : report.output);
  process.exitCode = report.status === 'failed' ? 1 : 0;
};

if (require.main === module) main();

module.exports = {
  ALERT_TITLE,
  buildExpoDoctorAlert,
  getSkipReason,
  readInstalledVersions,
  stripAnsi,
};
