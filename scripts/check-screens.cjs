#!/usr/bin/env node
/**
 * Checks the key-screen screenshots for things every screen must show, by
 * reading their text with Apple's Vision framework (scripts/ocr-screens.swift,
 * macOS only) and applying rules (#331):
 *
 * - every screen with a tab bar shows the four tab labels, in the shot's
 *   language, in the tab bar;
 * - no screen shows a system prompt, the setup dialog, or a code value such as
 *   "undefined";
 * - Bible screens show the verse button's whole label in the chapter controls,
 *   not a cut-off "V";
 * - a screen's own `mustShowLines` in test/screens/screens.json match the start
 *   of some line, which catches a verse number split across two lines.
 *
 * Where a label is missing, it takes a closer look at that strip of the screen,
 * enlarged and with more contrast, before reporting it.
 *
 *   node scripts/check-screens.cjs --dir <screens folder>   The folder holding ios/*.png
 *
 * Writes ocr.json and checks.json into that folder, and a summary to the step
 * summary. Exits 1 if any rule fails.
 */
const { execFileSync } = require('node:child_process');
const { appendFileSync, existsSync, mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { loadConfig, planCaptures } = require('./capture-ios-screens.cjs');

// Vision's languages for each app language, most important first. Bible screens
// in English also show Chinese, so English reads both.
const OCR_LANGUAGES = {
  en: ['en-US', 'zh-Hant'],
  zh: ['zh-Hant', 'en-US'],
  'zh-cn': ['zh-Hans', 'en-US'],
  es: ['es-ES', 'en-US'],
};

// The tab bar's labels, from app/(tabs)/_layout.tsx.
const TAB_LABELS = {
  en: ['Home', 'Bible', 'Explore', 'You'],
  zh: ['首頁', '聖經', '探索', '您'],
  'zh-cn': ['首页', '圣经', '探索', '您'],
  es: ['Inicio', 'Biblia', 'Explorar', 'Tú'],
};

// The Bible's verse button, from app/(tabs)/bible/index.tsx.
const VERSE_BUTTON = { en: 'Verse', zh: '節', 'zh-cn': '节', es: 'Versículo' };

// Where each label belongs, as fractions of the screenshot's height from the
// top, measured on the iPhone in screens.json. A label elsewhere, such as
// "Read Verse" on Home, doesn't count.
const REGIONS = {
  tabs: [0.9, 0.99],
  chapterControls: [0.82, 0.91],
  // While reading, the tab bar hides and the chapter controls move down.
  chapterControlsReading: [0.88, 0.99],
};

// Text that means something went wrong: a system prompt over the app, the
// first-launch setup, or a value the app failed to fill in.
const NEVER_SHOWN = ['Open in', 'Get Started', 'undefined', 'NaN', '[object Object]'];

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isChinese = (text) => /\p{Script=Han}/u.test(text);

/**
 * Whether a label appears as a whole word, with its top inside the region.
 * "Verse" doesn't count inside "Verses". Chinese has no spaces between words,
 * so any occurrence counts there.
 */
const showsLabel = (lines, label, region) => {
  const pattern = isChinese(label)
    ? new RegExp(escape(label), 'u')
    : new RegExp(`(^|[^\\p{L}])${escape(label)}($|[^\\p{L}])`, 'u');
  return lines.some(
    (line) =>
      pattern.test(line.text) &&
      (!region || (line.box[1] >= region[0] && line.box[1] <= region[1])),
  );
};

// Vision often misses a lone Chinese character, such as 您 or 節, even on a
// closer look. A one-character label can't be cut short the way "Verse" became
// "V", and the other labels still show the language, so these aren't required.
const required = (labels) => labels.filter((label) => [...label].length > 1);

/** The labels a shot must show, by region. */
const expectedLabels = (shot) => {
  const language = shot.settings.language;
  const expected = [];
  if (shot.tabs !== false) expected.push(['tabs', required(TAB_LABELS[language])]);
  if (shot.route.startsWith('bible')) {
    const controls = shot.tabs === false ? 'chapterControlsReading' : 'chapterControls';
    const labels = required([VERSE_BUTTON[language]]);
    if (labels.length) expected.push([controls, labels]);
  }
  return expected;
};

/** Returns what's wrong with one shot, given the lines of text read from it. */
const checkShot = (shot, lines) => {
  const problems = [];
  for (const [region, labels] of expectedLabels(shot)) {
    const missing = labels.filter((label) => !showsLabel(lines, label, REGIONS[region]));
    if (!missing.length) continue;
    problems.push(
      region === 'tabs'
        ? `tab labels missing: ${missing.join(', ')}`
        : `the verse button doesn't show "${missing[0]}"`,
    );
  }
  for (const text of NEVER_SHOWN) {
    if (lines.some((line) => line.text.includes(text))) problems.push(`shows "${text}"`);
  }
  for (const rule of shot.mustShowLines || []) {
    if (!lines.some((line) => new RegExp(rule, 'u').test(line.text.trim()))) {
      problems.push(`no line matches /${rule}/`);
    }
  }
  return problems;
};

/** Adds each screen's rules to its shots. */
const planChecks = (config) =>
  planCaptures(config).map((shot) => {
    const screen = config.screens.find((candidate) =>
      candidate.variants.some((variant) => `${candidate.name}-${variant}` === shot.name),
    );
    return { ...shot, tabs: screen.tabs, mustShowLines: screen.mustShowLines };
  });

/** Runs Vision on images, one call per language set: { [file]: lines }. */
const ocr = (jobs) => {
  const groups = new Map();
  for (const { file, languages } of jobs) {
    const key = languages.join(',');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(file);
  }
  const text = {};
  for (const [languages, files] of groups) {
    const output = execFileSync(
      'xcrun',
      ['swift', join(__dirname, 'ocr-screens.swift'), languages, ...files],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    Object.assign(text, JSON.parse(output));
  }
  return text;
};

/**
 * Crops a strip of the screen for a closer look: three times larger, in grey,
 * with its contrast stretched. Dim tab labels in dark mode and single Chinese
 * characters, such as 您, are often missed at full size.
 */
const cropStrip = async (file, region, out) => {
  const sharp = require('sharp');
  const { width, height } = await sharp(file).metadata();
  const top = Math.round(height * region[0]);
  const stripHeight = Math.round(height * (region[1] - region[0]));
  await sharp(file)
    .extract({ left: 0, top, width, height: stripHeight })
    .resize(width * 3, stripHeight * 3)
    .greyscale()
    .normalise()
    .png()
    .toFile(out);
};

/** Converts a line read from a strip back to the whole screenshot's coordinates. */
const fromStrip = (line, region) => ({
  ...line,
  box: [
    line.box[0],
    region[0] + line.box[1] * (region[1] - region[0]),
    line.box[2],
    line.box[3] * (region[1] - region[0]),
  ],
  closerLook: true,
});

/** Reads every shot's text, taking a closer look where a label is missing. */
const readText = async (dir, shots) => {
  const present = shots.filter((shot) => existsSync(join(dir, shot.file)));
  const text = ocr(present.map((shot) => ({
    file: join(dir, shot.file),
    languages: OCR_LANGUAGES[shot.settings.language],
  })));

  const workDir = mkdtempSync(join(tmpdir(), 'screens-'));
  const strips = [];
  for (const shot of present) {
    const file = join(dir, shot.file);
    for (const [regionName, labels] of expectedLabels(shot)) {
      const region = REGIONS[regionName];
      if (labels.every((label) => showsLabel(text[file] || [], label, region))) continue;
      const strip = join(workDir, `${shot.name}-${regionName}.png`);
      await cropStrip(file, region, strip);
      strips.push({ file, strip, region, languages: OCR_LANGUAGES[shot.settings.language] });
    }
  }
  if (strips.length) {
    const stripText = ocr(strips.map(({ strip, languages }) => ({ file: strip, languages })));
    for (const { file, strip, region } of strips) {
      const lines = (stripText[strip] || []).map((line) => fromStrip(line, region));
      text[file] = [...(text[file] || []), ...lines];
    }
  }
  return text;
};

const main = async () => {
  const dirIndex = process.argv.indexOf('--dir');
  const dir = dirIndex === -1 ? undefined : resolve(process.argv[dirIndex + 1]);
  if (!dir) {
    console.error('Usage: node scripts/check-screens.cjs --dir <screens folder>');
    process.exit(2);
  }
  const shots = planChecks(loadConfig());
  const text = await readText(dir, shots);
  writeFileSync(join(dir, 'ocr.json'), JSON.stringify(text, null, 1));

  const results = shots.map((shot) => {
    const lines = text[join(dir, shot.file)];
    return { file: shot.file, problems: lines ? checkShot(shot, lines) : ['no screenshot'] };
  });
  writeFileSync(join(dir, 'checks.json'), JSON.stringify(results, null, 1));
  const failed = results.filter((result) => result.problems.length);
  const summary = [
    '### Key-screen text checks',
    '',
    `${results.length - failed.length} of ${results.length} screenshots pass.`,
    ...failed.map((result) => `- ❌ ${result.file}: ${result.problems.join('; ')}`),
    '',
  ].join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  console.log(summary);
  if (failed.length) process.exitCode = 1;
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  OCR_LANGUAGES,
  TAB_LABELS,
  VERSE_BUTTON,
  REGIONS,
  NEVER_SHOWN,
  showsLabel,
  checkShot,
  planChecks,
  fromStrip,
};
