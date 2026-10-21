#!/usr/bin/env node
/**
 * Captures the app's key screens (test/screens/screens.json) on an Android
 * emulator, for the release PR's screenshot review (#372): the Android
 * counterpart of capture-ios-screens.cjs, from the same list. The images are
 * named android/<screen>-<variant>.png. The emulator is the size of the phone
 * android.phone in screens.json names, the best-selling Android phone where
 * most Adventists live. Google Play takes no screenshot taller than 2:1, so its
 * shots are taken separately (--store), on an emulator of android.googlePlay's
 * size, and saved, numbered in upload order, to google-play/<language>/.
 *
 * Like the iPhone capture, it saves the settings the app reads at startup, and
 * the screen to open (services/ScreenshotRoute.ts), before each launch. Android
 * keeps AsyncStorage in a SQLite database in the app's private folder, so this
 * writes a fresh database and copies it in as root. That needs an emulator
 * image that allows `adb root` (google_apis, not google_apis_playstore), and
 * nothing in the app: the store builds have no way in. The shot's theme, font
 * size, and display size are set on the emulator itself.
 *
 *   node scripts/capture-android-screens.cjs --out <dir>                  Captures every Android shot into <dir>
 *   node scripts/capture-android-screens.cjs --out <dir> --group library  Only that group's shots, for one of
 *                                                                         several runners
 *   node scripts/capture-android-screens.cjs --out <dir> --store          The Google Play shots, on an emulator
 *                                                                         of Google Play's size
 *
 * The key-screens preview build (EXPO_PUBLIC_KEY_SCREENS=1) must already be
 * installed on the only connected emulator. ADB names the adb to use (default
 * adb). Needs Node 22.5 or later, for node:sqlite.
 */
const { execFileSync, spawnSync } = require('node:child_process');
const { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const {
  ROUTE_KEY,
  SAMPLE_EVERY,
  buildManifest,
  compareSamples,
  loadConfig,
  looksBlank,
  looksLikeSplash,
  planCaptures,
  planStoreCopies,
  settledAfter,
  statusBarClear,
  takeFinalShot,
  takeGroup,
  writeAppStoreCopy,
} = require('./capture-ios-screens.cjs');

const ADB = process.env.ADB || 'adb';

// Where @react-native-async-storage/async-storage keeps its values on Android
// (ReactDatabaseSupplier.java): the RKStorage database's catalystLocalStorage
// table, at database version 1. A database at another version is wiped.
const STORAGE_DATABASE = 'RKStorage';
const STORAGE_TABLE = 'catalystLocalStorage';
const STORAGE_VERSION = 1;

/**
 * The status bar's empty middle, between the clock and the icons, as fractions
 * of the width, measured on the emulator in screens.json. Text scrolled up
 * under the status bar shows there. At Android's largest font the clock and
 * icons grow to about 0.17 and from 0.62, so this stays inside the gap.
 */
const STATUS_BAR_REGIONS = [{ x: [0.25, 0.58], y: [0.012, 0.05] }];

const CHECKS = { statusBarClear: (file) => statusBarClear(file, STATUS_BAR_REGIONS) };

const adb = (...args) => execFileSync(ADB, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).replace(/\r/g, '').trim();
const shell = (command) => adb('shell', command);

/** The preview build's app ID: the store's, plus .preview (app.config.js). */
const previewPackage = () => {
  const previous = process.env.APP_VARIANT;
  process.env.APP_VARIANT = 'preview';
  try {
    const appJson = require('../app.json');
    return require('../app.config.js')({ config: appJson.expo }).android.package;
  } finally {
    if (previous === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previous;
  }
};

/** Writes the settings into a new AsyncStorage database file. */
const writeStorage = (file, manifest) => {
  const { DatabaseSync } = require('node:sqlite');
  rmSync(file, { force: true });
  const database = new DatabaseSync(file);
  database.exec(`CREATE TABLE ${STORAGE_TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  database.exec(`PRAGMA user_version = ${STORAGE_VERSION}`);
  const insert = database.prepare(`INSERT INTO ${STORAGE_TABLE} (key, value) VALUES (?, ?)`);
  for (const [key, value] of Object.entries(manifest)) insert.run(key, value);
  database.close();
};

/** Reads one value from a copy of the app's database, with its write-ahead log. */
const readStorageValue = (dir, key) => {
  const { DatabaseSync } = require('node:sqlite');
  const database = new DatabaseSync(join(dir, STORAGE_DATABASE));
  try {
    const row = database.prepare(`SELECT value FROM ${STORAGE_TABLE} WHERE key = ?`).get(key);
    return row ? row.value : null;
  } finally {
    database.close();
  }
};

/**
 * The shell commands that put the new database in the app's folder, owned by
 * the app and with its folder's SELinux label, so the app can open it. The app
 * must be stopped.
 */
const installStorageCommands = (pkg, pushed) => {
  const folder = `/data/data/${pkg}`;
  const databases = `${folder}/databases`;
  return [
    'set -e',
    `mkdir -p ${databases}`,
    `rm -f ${databases}/${STORAGE_DATABASE} ${databases}/${STORAGE_DATABASE}-*`,
    `cp ${pushed} ${databases}/${STORAGE_DATABASE}`,
    `chown "$(stat -c %u:%g ${folder})" ${databases} ${databases}/${STORAGE_DATABASE}`,
    `chmod 771 ${databases}`,
    `chmod 660 ${databases}/${STORAGE_DATABASE}`,
    `chcon "$(stat -c %C ${folder})" ${databases} ${databases}/${STORAGE_DATABASE}`,
  ].join('; ');
};

/** Copies the app's database, and its write-ahead log if any, into a folder. */
const pullStorage = (pkg, dir) => {
  for (const suffix of ['', '-wal', '-shm']) {
    const remote = `/data/data/${pkg}/databases/${STORAGE_DATABASE}${suffix}`;
    const result = spawnSync(ADB, ['exec-out', `cat ${remote} 2>/dev/null`], { maxBuffer: 64 * 1024 * 1024 });
    if (result.status === 0 && result.stdout.length) writeFileSync(join(dir, `${STORAGE_DATABASE}${suffix}`), result.stdout);
  }
};

/**
 * The emulator settings a shot needs: night mode, font scale, and density, the
 * phone's own times the shot's display size. The density is always set, so the
 * phone's holds even where the emulator rounded its own.
 */
const deviceSettings = (settings, phoneDensity) => ({
  night: settings.theme === 'dark' ? 'yes' : 'no',
  fontScale: String(settings.fontScale),
  density: String(Math.round(phoneDensity * settings.displayScale)),
});

/** Throws unless the emulator's screen is the size the device in screens.json gives. */
const checkScreenSize = (device, reported) => {
  const [width, height] = (/Physical size: (\d+)x(\d+)/.exec(reported) || []).slice(1).map(Number);
  if (width !== device.width || height !== device.height) {
    throw new Error(
      `The emulator's screen is ${width} × ${height}, not ${device.width} × ${device.height} as test/screens/screens.json gives; start it with that size.`,
    );
  }
};

/**
 * A fixed status bar: 9:41, full Wi-Fi and battery, no mobile signal or
 * notifications. System UI leaves demo mode when the font or display size
 * changes, so this runs again after either.
 */
const fixStatusBar = () => {
  const demo = (command) => shell(`am broadcast -a com.android.systemui.demo -e command ${command} >/dev/null`);
  demo('exit');
  demo('enter');
  demo('clock -e hhmm 0941');
  demo('battery -e level 100 -e plugged false');
  demo('network -e wifi show -e level 4');
  demo('network -e mobile hide');
  demo('notifications -e visible false');
};

/** Changes the emulator settings that differ from the last shot's. */
const applyDeviceSettings = (wanted, current) => {
  if (wanted.night !== current.night) shell(`cmd uimode night ${wanted.night}`);
  if (wanted.fontScale !== current.fontScale) shell(`settings put system font_scale ${wanted.fontScale}`);
  if (wanted.density !== current.density) shell(`wm density ${wanted.density}`);
  if (wanted.fontScale !== current.fontScale || wanted.density !== current.density) fixStatusBar();
  return wanted;
};

/**
 * A steady screen for every shot: no animations, a fixed status bar, gesture
 * navigation as on current Pixels, and the screen kept awake and unlocked.
 */
const prepareEmulator = () => {
  for (const name of ['window_animation_scale', 'transition_animation_scale', 'animator_duration_scale']) {
    shell(`settings put global ${name} 0`);
  }
  shell('settings put global sysui_demo_allowed 1');
  fixStatusBar();
  spawnSync(ADB, ['shell', 'cmd overlay enable-exclusive --category com.android.internal.systemui.navbar.gestural']);
  shell('svc power stayon true');
  shell('input keyevent KEYCODE_WAKEUP');
  shell('wm dismiss-keyguard');
};

const sleepUntil = (time) => new Promise((done) => setTimeout(done, Math.max(0, time - Date.now())));

const screenshot = (file) => {
  const result = spawnSync(ADB, ['exec-out', 'screencap -p'], { maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0 || !result.stdout.length) throw new Error(`screencap failed: ${result.stderr}`);
  writeFileSync(file, result.stdout);
};

const isRunning = (pkg) => spawnSync(ADB, ['shell', `pidof ${pkg}`], { encoding: 'utf8' }).stdout.trim() !== '';

/** The shots to take: a group's, every one, or each Google Play shot once. */
const planShots = (config, { group, store }) => {
  const shots = planCaptures(config, 'android');
  if (!store) return takeGroup(shots, group, config);
  const names = new Set(planStoreCopies(config, 'android').map((copy) => copy.name));
  return shots.filter((shot) => names.has(shot.name));
};

const capture = async (outDir, { group, store }) => {
  const config = loadConfig();
  const device = store ? config.android.googlePlay : config.android.phone;
  const pkg = previewPackage();
  // Root, to write into the app's private folder. adbd restarts as root.
  adb('root');
  adb('wait-for-device');
  prepareEmulator();
  const activity = shell(`cmd package resolve-activity --brief -c android.intent.category.LAUNCHER ${pkg}`)
    .split('\n')
    .pop();
  if (!activity.includes('/')) throw new Error(`${pkg} isn't installed, or has no launcher activity.`);
  // A first launch can ask for notifications; grant them so no prompt covers a shot.
  spawnSync(ADB, ['shell', `pm grant ${pkg} android.permission.POST_NOTIFICATIONS`]);
  checkScreenSize(device, shell('wm size'));
  let current = applyDeviceSettings(deviceSettings({ theme: 'light', fontScale: 1, displayScale: 1 }, device.density), {});

  const workDir = mkdtempSync(join(tmpdir(), 'android-key-screens-'));
  // The Google Play shots are kept only as their copies.
  const shotDir = store ? join(workDir, 'shots') : outDir;
  const failures = [];
  const captured = new Set();
  const timings = [];
  const started = Date.now();

  for (const shot of planShots(config, { group, store })) {
    shell(`am force-stop ${pkg}`);
    const database = join(workDir, STORAGE_DATABASE);
    writeStorage(database, buildManifest(shot.settings, shot.route));
    const pushed = '/data/local/tmp/key-screens-storage';
    adb('push', database, pushed);
    shell(installStorageCommands(pkg, pushed));
    current = applyDeviceSettings(deviceSettings(shot.settings, device.density), current);
    shell(`am start -W -n ${activity} >/dev/null`);
    const launched = Date.now();
    const samples = [];
    for (let seconds = SAMPLE_EVERY; seconds < shot.wait; seconds += SAMPLE_EVERY) {
      await sleepUntil(launched + seconds * 1000);
      const sample = join(workDir, `sample-${seconds}.png`);
      screenshot(sample);
      samples.push({ seconds, file: sample });
    }
    await sleepUntil(launched + shot.wait * 1000);

    const file = join(shotDir, shot.file);
    mkdirSync(dirname(file), { recursive: true });
    // Taken even when something went wrong, so the artifact shows what was on
    // screen. It waits for a screen that's still blank, or still loading
    // (takeFinalShot in capture-ios-screens.cjs).
    await takeFinalShot(() => screenshot(file), file, { lastSample: samples.at(-1)?.file });
    const finalSeconds = Math.round((Date.now() - launched) / 1000);
    await compareSamples(samples, file);
    const settled = settledAfter(samples, finalSeconds);
    timings.push({ shot: shot.name, file: shot.file, wait: shot.wait, shotAt: finalSeconds, settledAfter: settled });

    const problems = [];
    if (!isRunning(pkg)) problems.push(`the app wasn't running after opening ${shot.url}`);
    // The app removes the saved screen once it has opened it.
    if (shot.route) {
      const pulled = mkdtempSync(join(workDir, 'pulled-'));
      pullStorage(pkg, pulled);
      try {
        if (readStorageValue(pulled, ROUTE_KEY) !== null) problems.push("the app didn't open the saved screen");
      } catch (error) {
        problems.push(`couldn't read the app's storage back (${error.message})`);
      }
    }
    if (await looksBlank(file)) problems.push('the screen is blank');
    else if (await looksLikeSplash(file)) problems.push('the app still shows its splash screen');
    for (const check of shot.checks) {
      if (!CHECKS[check]) problems.push(`unknown check "${check}"`);
      else if (!(await CHECKS[check](file))) problems.push(`failed ${check}`);
    }
    if (problems.length) failures.push(`${shot.file}: ${problems.join(', ')}`);
    else captured.add(shot.name);
    console.log(
      `${shot.file} <- ${shot.url}  (settled after ${settled}s of ${finalSeconds}s)` +
        (problems.length ? `  (${problems.join(', ')})` : ''),
    );
  }
  shell(`am force-stop ${pkg}`);
  applyDeviceSettings({ ...current, night: 'no', fontScale: '1' }, current);
  shell('wm density reset');

  for (const copy of store ? planStoreCopies(config, 'android') : []) {
    if (!captured.has(copy.name)) {
      failures.push(`${copy.file}: its shot "${copy.name}" wasn't captured`);
      continue;
    }
    const file = join(outDir, copy.file);
    mkdirSync(dirname(file), { recursive: true });
    await writePlayCopy(join(shotDir, copy.source), file, config.android.googlePlay);
  }
  rmSync(workDir, { recursive: true, force: true });
  if (!store) writeFileSync(join(outDir, 'settle-times.json'), `${JSON.stringify(timings, null, 2)}\n`);

  const minutes = ((Date.now() - started) / 60000).toFixed(1);
  const part = store ? ', Google Play shots' : group ? `, group ${group}` : '';
  const summary = [
    `### Android key screens (${device.name}, ${device.width} × ${device.height} at ${device.density} dpi${part})`,
    '',
    store
      ? `${captured.size} captured in ${minutes} minutes, and copied into \`screens/google-play/\`.`
      : group
        ? `${captured.size} captured in ${minutes} minutes; the joined artifact's \`screens/\` folder has every group's.`
        : `${captured.size} captured in ${minutes} minutes, in \`screens/\`.`,
    ...failures.map((failure) => `- ❌ ${failure}`),
    '',
    `Settled within 5 seconds: ${timings.filter((timing) => timing.settledAfter <= 5).length} of ${timings.length}. ` +
      `Slowest: ${[...timings]
        .sort((a, b) => b.settledAfter - a.settledAfter)
        .slice(0, 5)
        .map((timing) => `${timing.shot} ${timing.settledAfter}s`)
        .join(', ')} (every shot is in \`settle-times.json\`).`,
    '',
  ].join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  console.log(summary);
  if (failures.length) process.exitCode = 1;
};

/**
 * Writes a Google Play copy of a screenshot, at the size android.googlePlay
 * gives and with no alpha channel, which Play rejects. The emulator's screen is
 * that size already, so a shot of any other size is an error rather than
 * something to stretch.
 */
const writePlayCopy = async (source, destination, size) => {
  const sharp = require('sharp');
  const { width, height } = await sharp(source).metadata();
  if (width !== size.width || height !== size.height) {
    throw new Error(`${source} is ${width} × ${height}, not Google Play's ${size.width} × ${size.height}; check android.googlePlay in test/screens/screens.json.`);
  }
  await writeAppStoreCopy(source, destination);
};

if (require.main === module) {
  const argument = (name) => {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : process.argv[index + 1];
  };
  const outDir = argument('--out');
  if (!outDir) {
    console.error('Usage: node scripts/capture-android-screens.cjs --out <dir> [--group <group> | --store]');
    process.exit(2);
  }
  capture(resolve(outDir), { group: argument('--group'), store: process.argv.includes('--store') }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  STORAGE_DATABASE,
  STORAGE_TABLE,
  STORAGE_VERSION,
  STATUS_BAR_REGIONS,
  planShots,
  checkScreenSize,
  previewPackage,
  writeStorage,
  readStorageValue,
  installStorageCommands,
  deviceSettings,
  writePlayCopy,
};
