#!/usr/bin/env node
/**
 * EVALUATION ONLY (#324), not for merging: drives the iPad Simulator through
 * what key screens can't do by deep link alone. It taps share buttons, focuses
 * search fields, plays Bible audio while turning the iPad, and turns it upside
 * down. It saves a screenshot after each step and notes whether the app is
 * still running.
 *
 *   node scripts/ipad-interact.cjs --out <dir>
 *
 * Taps go through serve-sim (SERVE_SIM), at points found by reading the
 * screenshot's text with Vision (scripts/ocr-screens.swift), or at fixed points.
 */
const { execFileSync, spawnSync } = require('node:child_process');
const { mkdirSync, writeFileSync, readFileSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');
const {
  loadConfig,
  buildManifest,
  manifestPath,
  BASE_SETTINGS,
  SERVE_SIM,
} = require('./capture-ios-screens.cjs');

const projectRoot = resolve(__dirname, '..');
const simctl = (...args) => execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8' }).trim();
const serveSim = (...args) =>
  execFileSync('npx', ['--yes', SERVE_SIM, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const sleep = (seconds) => new Promise((done) => setTimeout(done, seconds * 1000));

// How much to turn simctl's portrait-frame screenshot so the app's top is up.
const UPRIGHT = { portrait: 0, portrait_upside_down: 180, landscape_left: 90, landscape_right: 270 };

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const ocr = (file) => {
  const output = execFileSync('xcrun', ['swift', join(__dirname, 'ocr-screens.swift'), 'en-US,zh-Hant,zh-Hans', file], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(output)[file] || [];
};

/**
 * The scenarios. Each opens `route` with `settings` added to the iPad's base
 * settings, then runs its steps: wait, shot, tapText (a regular expression for
 * a line to tap the middle of), tapAt ([x, y] as fractions of the screen as the
 * app shows it), type, rotate, and home.
 */
const SCENARIOS = [
  {
    name: 'share-verse-home',
    route: '',
    steps: [{ shot: 'home' }, { tapText: 'Share Verse' }, { wait: 3 }, { shot: 'sheet' },
      { rotate: 'landscape_left' }, { wait: 3 }, { shot: 'sheet-landscape' }, { rotate: 'portrait' }, { wait: 2 }, { shot: 'sheet-back-portrait' }],
  },
  {
    name: 'share-verse-bible',
    route: 'bible?bookId=JHN&chapter=3&translationId=BSB&verseStart=16&verseEnd=16&popup=verse',
    steps: [{ shot: 'popup' }, { tapText: 'Share Verse' }, { wait: 3 }, { shot: 'sheet' }],
  },
  {
    name: 'share-app',
    route: 'you?popup=share-app',
    steps: [{ shot: 'popup' }, { tapText: 'Share Link' }, { wait: 3 }, { shot: 'sheet' }],
  },
  {
    name: 'library-search-keyboard',
    route: 'explore/library',
    steps: [{ tapText: 'Search all library books' }, { wait: 3 }, { shot: 'focused' },
      { rotate: 'landscape_left' }, { wait: 3 }, { shot: 'focused-landscape' }, { rotate: 'portrait' }, { wait: 2 },
      { type: 'pilgrim' }, { wait: 3 }, { shot: 'typed' }],
  },
  {
    name: 'explore-search-keyboard',
    route: 'explore',
    steps: [{ shot: 'explore' }, { tapText: '^Search' }, { wait: 3 }, { shot: 'focused' }],
  },
  {
    name: 'bible-search-keyboard',
    route: 'bible?bookId=PSA&chapter=23&translationId=BSB',
    // The magnifier at the header's right, measured on the 13-inch iPad in portrait.
    steps: [{ tapAt: [0.957, 0.049] }, { wait: 3 }, { shot: 'focused' }, { type: 'shepherd' }, { wait: 4 }, { shot: 'typed' }],
  },
  {
    name: 'bible-audio-turning',
    route: 'bible?bookId=PSA&chapter=23&translationId=BSB&play=1',
    steps: [{ wait: 8 }, { shot: 'playing' }, { rotate: 'landscape_left' }, { wait: 4 }, { shot: 'playing-landscape' },
      { rotate: 'landscape_right' }, { wait: 4 }, { shot: 'playing-landscape-right' }, { rotate: 'portrait' }, { wait: 4 }, { shot: 'playing-portrait-again' }],
  },
  {
    name: 'upside-down',
    route: '',
    steps: [{ rotate: 'portrait_upside_down' }, { wait: 4 }, { shot: 'home' }, { rotate: 'portrait' }, { wait: 2 }],
  },
  {
    name: 'background-and-back',
    route: 'bible?bookId=PSA&chapter=23&translationId=BSB&play=1',
    steps: [{ wait: 8 }, { home: true }, { wait: 5 }, { rotate: 'landscape_left' }, { wait: 3 }, { relaunch: true }, { wait: 5 }, { shot: 'returned-landscape' }, { rotate: 'portrait' }, { wait: 3 }],
  },
];

const main = async () => {
  const outDir = resolve(argument('--out') || 'ipad-interact');
  mkdirSync(outDir, { recursive: true });
  const config = loadConfig();
  const bundleId = JSON.parse(readFileSync(join(projectRoot, 'app.json'), 'utf8')).expo.ios.bundleIdentifier;
  const udid = process.env.DEVICE_ID;
  if (!udid) throw new Error('Set DEVICE_ID to the booted iPad.');
  simctl('bootstatus', udid, '-b');
  simctl('status_bar', udid, 'override', '--time', '9:41', '--batteryState', 'discharging', '--batteryLevel', '100');
  serveSim('--detach', udid);
  const dataContainer = simctl('get_app_container', udid, bundleId, 'data');
  const manifest = manifestPath(dataContainer, bundleId);
  const isRunning = () => {
    const result = spawnSync('xcrun', ['simctl', 'spawn', udid, 'launchctl', 'list'], { encoding: 'utf8' });
    return (result.stdout || '').includes(`UIKitApplication:${bundleId}`);
  };
  const report = [];
  let orientation = 'portrait';

  for (const scenario of SCENARIOS) {
    const entry = { scenario: scenario.name, steps: [] };
    report.push(entry);
    try {
      if (orientation !== 'portrait') {
        serveSim('rotate', 'portrait', '-d', udid);
        orientation = 'portrait';
        await sleep(2);
      }
      spawnSync('xcrun', ['simctl', 'terminate', udid, bundleId]);
      mkdirSync(dirname(manifest), { recursive: true });
      const settings = { ...BASE_SETTINGS.ipad, ...(scenario.settings || {}) };
      writeFileSync(manifest, JSON.stringify(buildManifest(settings, scenario.route)));
      simctl('ui', udid, 'appearance', 'light');
      simctl('ui', udid, 'content_size', settings.iosTextSize);
      simctl('launch', udid, bundleId);
      await sleep(12);
      let last;
      const shoot = async (name) => {
        const file = join(outDir, `${scenario.name}-${name}.png`);
        simctl('io', udid, 'screenshot', '--type=png', '--mask=ignored', file);
        const turn = UPRIGHT[orientation];
        if (turn) {
          const sharp = require('sharp');
          writeFileSync(file, await sharp(file).rotate(turn).png().toBuffer());
        }
        last = file;
        return file;
      };
      for (const step of scenario.steps) {
        const done = { ...step };
        if (step.wait) await sleep(step.wait);
        if (step.shot) done.file = await shoot(step.shot);
        if (step.tapText) {
          const file = await shoot(`before-tap-${entry.steps.length}`);
          const line = ocr(file).find((each) => new RegExp(step.tapText, 'u').test(each.text.trim()));
          if (!line) {
            done.problem = `no line matching /${step.tapText}/ to tap`;
          } else {
            const [x, y, w, h] = line.box;
            done.tappedAt = [x + w / 2, y + h / 2];
            serveSim('tap', String(x + w / 2), String(y + h / 2), '-d', udid);
          }
        }
        if (step.tapAt) serveSim('tap', String(step.tapAt[0]), String(step.tapAt[1]), '-d', udid);
        if (step.type) serveSim('type', step.type, '-d', udid);
        if (step.rotate) {
          serveSim('rotate', step.rotate, '-d', udid);
          orientation = step.rotate;
        }
        if (step.home) serveSim('button', 'home', '-d', udid);
        if (step.relaunch) simctl('launch', udid, bundleId);
        done.running = isRunning();
        if (!done.running && !step.home) done.problem = [done.problem, 'the app is not running'].filter(Boolean).join('; ');
        entry.steps.push(done);
        if (done.problem) console.log(`::warning::${scenario.name}: ${done.problem}`);
      }
      entry.lastShot = last;
    } catch (error) {
      entry.error = String(error && error.message ? error.message : error);
      console.log(`::warning::${scenario.name}: ${entry.error}`);
    }
  }
  writeFileSync(join(outDir, 'interact.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.map((each) => ({
    scenario: each.scenario,
    problems: each.steps.filter((step) => step.problem).map((step) => step.problem),
    error: each.error,
  })), null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
