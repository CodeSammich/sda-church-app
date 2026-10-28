#!/usr/bin/env node
/**
 * Checks the key-screen screenshots for things every screen must show, by
 * reading their text with Apple's Vision framework (scripts/ocr-screens.swift,
 * macOS only) and applying rules (#331). The Android shots get the same rules,
 * read on Linux by RapidOCR (scripts/ocr-screens.py, #372):
 *
 * - every screen with a tab bar shows the four tab labels, in the shot's
 *   language, in the tab bar;
 * - no screen shows a system prompt, the setup dialog, or a code value such as
 *   "undefined";
 * - Bible screens show the verse button's whole label in the chapter controls,
 *   not a cut-off "V";
 * - a screen's own `mustShowLines` in test/screens/screens.json match the start
 *   of some line, which catches a verse number split across two lines (a rule
 *   with `minLeft` also needs the line to start that far across, for
 *   right-aligned text, and one with `maxTop` no farther down than that, such
 *   as a popup's title), and its
 *   `mustNotShowLines` match no line. `variantRules` adds rules for one variant,
 *   such as the Bible header without its 文A icon at a large text size.
 *
 * Where a label is missing, it takes a closer look at that strip of the screen,
 * enlarged and with more contrast, before reporting it.
 *
 *   node scripts/check-screens.cjs --dir <screens folder>   The folder holding ios/*.png
 *   node scripts/check-screens.cjs --dir <screens folder> --group bible-reading
 *                                                         Checks only that group's shots, as captured by
 *                                                         capture-ios-screens.cjs --group bible-reading
 *   node scripts/check-screens.cjs --dir <screens folder> --platform android
 *                                                         Checks the Android shots, android/*.png
 *   node scripts/check-screens.cjs --dir <screens folder> --platform all
 *                                                         Checks both, as in the joined artifact
 *
 * Writes ocr.json and checks.json into that folder, and a summary to the step
 * summary. Exits 1 if any rule fails.
 */
const { execFileSync } = require('node:child_process');
const { appendFileSync, existsSync, mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { PLATFORMS, loadConfig, planCaptures, takeGroup } = require('./capture-ios-screens.cjs');

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

// Its short label, which it shows instead when the chapter controls are tight,
// as on Android's largest font (verseShort in app/(tabs)/bible/index.tsx). A
// whole short label passes; a cut-off one, such as "V", still fails.
const VERSE_BUTTON_SHORT = { en: 'Vs.', es: 'Vers.' };

// Where each label belongs, as fractions of the screenshot's height from the
// top, measured on each platform's phone in screens.json. A label elsewhere,
// such as "Read Verse" on Home, doesn't count.
const REGIONS_BY_PLATFORM = {
  ios: {
    tabs: [0.9, 0.99],
    chapterControls: [0.82, 0.91],
    // While reading, the tab bar hides and the chapter controls move down.
    chapterControlsReading: [0.88, 0.99],
  },
  // The Galaxy A07's screen, 20:9, with Android's gesture bar below the tabs.
  android: {
    tabs: [0.88, 0.99],
    chapterControls: [0.79, 0.92],
    chapterControlsReading: [0.86, 0.99],
  },
};
const REGIONS = REGIONS_BY_PLATFORM.ios;

// Text that means something went wrong: a system prompt over the app, the
// first-launch setup, or a value the app failed to fill in. On Android, also
// the system's crash and not-responding dialogs.
const NEVER_SHOWN = ['Open in', 'Get Started', 'undefined', 'NaN', '[object Object]'];
const NEVER_SHOWN_BY_PLATFORM = {
  ios: NEVER_SHOWN,
  android: [...NEVER_SHOWN, "isn't responding", 'keeps stopping', 'has stopped'],
};

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isChinese = (text) => /\p{Script=Han}/u.test(text);

/**
 * Whether a label appears as a whole word, with its top inside the region.
 * "Verse" doesn't count inside "Verses". Chinese has no spaces between words,
 * so any occurrence counts there.
 */
const showsLabel = (lines, label, region) => {
  // A label given as a list shows if any of its forms does.
  if (Array.isArray(label)) return label.some((form) => showsLabel(lines, form, region));
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
// closer look, and RapidOCR a two-letter one, such as Spanish's Tú under its
// icon on Android. A label that short can't be cut short the way "Verse" became
// "V", and the other labels still show the language, so these aren't required.
const required = (labels) =>
  labels.filter((label) => {
    const text = Array.isArray(label) ? label[0] : label;
    return [...text].length > (isChinese(text) ? 1 : 2);
  });

/**
 * The labels a shot must show, by region. A popup (popup= in its path, #372)
 * covers or dims the tab bar and the chapter controls, and so does the Bible's
 * search results page (search=, #544), so their own mustShowLines check them
 * instead.
 */
const expectedLabels = (shot) => {
  const language = shot.settings.language;
  const expected = [];
  if (/[?&](?:popup|search)=/.test(shot.route)) return expected;
  if (shot.tabs !== false) expected.push(['tabs', required(TAB_LABELS[language])]);
  if (shot.route.startsWith('bible')) {
    const controls = shot.tabs === false ? 'chapterControlsReading' : 'chapterControls';
    const short = VERSE_BUTTON_SHORT[language];
    const labels = required([short ? [VERSE_BUTTON[language], short] : VERSE_BUTTON[language]]);
    if (labels.length) expected.push([controls, labels]);
  }
  return expected;
};

/**
 * The rules for one platform: every plain rule, and those whose `platforms`
 * name it, such as a line the Android phone's screen leaves below the fold.
 */
const forPlatform = (rules, platform) =>
  (rules || []).filter((rule) => typeof rule === 'string' || !rule.platforms || rule.platforms.includes(platform));

/** Returns what's wrong with one shot, given the lines of text read from it. */
const checkShot = (shot, lines) => {
  const problems = [];
  const regions = REGIONS_BY_PLATFORM[shot.platform];
  for (const [region, labels] of expectedLabels(shot)) {
    const missing = labels.filter((label) => !showsLabel(lines, label, regions[region]));
    if (!missing.length) continue;
    problems.push(
      region === 'tabs'
        ? `tab labels missing: ${missing.join(', ')}`
        : `the verse button doesn't show "${[missing[0]].flat()[0]}"`,
    );
  }
  for (const text of NEVER_SHOWN_BY_PLATFORM[shot.platform]) {
    if (lines.some((line) => line.text.includes(text))) problems.push(`shows "${text}"`);
  }
  for (const rule of forPlatform(shot.mustShowLines, shot.platform)) {
    // A rule is a regular expression, or { line, minLeft, maxTop } for a line
    // that must also start at least minLeft of the way across, such as
    // right-aligned text, or have its top no more than maxTop of the way down,
    // such as a popup's title, which sits high when the popup is centred.
    const { line: pattern, minLeft, maxTop } = typeof rule === 'string' ? { line: rule } : rule;
    const matches = lines.filter((line) => new RegExp(pattern, 'u').test(line.text.trim()));
    if (!matches.length) {
      problems.push(`no line matches /${pattern}/`);
    } else if (minLeft !== undefined && !matches.some((line) => line.box[0] >= minLeft)) {
      const farthest = Math.max(...matches.map((line) => line.box[0]));
      problems.push(
        `/${pattern}/ starts ${Math.round(farthest * 100)}% of the way across, not at least ${Math.round(minLeft * 100)}%`,
      );
    } else if (maxTop !== undefined && !matches.some((line) => line.box[1] <= maxTop)) {
      const highest = Math.min(...matches.map((line) => line.box[1]));
      problems.push(
        `/${pattern}/ is ${Math.round(highest * 100)}% of the way down, not at most ${Math.round(maxTop * 100)}%`,
      );
    }
  }
  for (const rule of forPlatform(shot.mustNotShowLines, shot.platform)) {
    const pattern = typeof rule === 'string' ? rule : rule.line;
    const shown = lines.find((line) => new RegExp(pattern, 'u').test(line.text.trim()));
    if (shown) problems.push(`"${shown.text.trim()}" matches /${pattern}/, which must not show`);
  }
  return problems;
};

/** Both lists of rules, or undefined when neither has any. */
const joinRules = (screenRules, variantRules) =>
  screenRules || variantRules ? [...(screenRules || []), ...(variantRules || [])] : undefined;

/** Adds each screen's rules, and its variant's, to one platform's shots. */
const planChecks = (config, platform = 'ios') =>
  planCaptures(config, platform).map((shot) => {
    const screen = config.screens.find((candidate) =>
      candidate.variants.some((variant) => `${candidate.name}-${variant}` === shot.name),
    );
    const variant = shot.name.slice(screen.name.length + 1);
    const forVariant = screen.variantRules?.[variant] || {};
    return {
      ...shot,
      tabs: screen.tabs,
      mustShowLines: joinRules(screen.mustShowLines, forVariant.mustShowLines),
      mustNotShowLines: joinRules(screen.mustNotShowLines, forVariant.mustNotShowLines),
    };
  });

/** Runs Vision on images, one call per language set: { [file]: lines }. */
const ocrVision = (jobs) => {
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
 * Runs RapidOCR on images, for the Android shots, which are read on Linux
 * (scripts/ocr-screens.py, #372): Vision runs only on a Mac. Its models read
 * every app language at once. OCR_PYTHON names the Python that has it
 * installed (default python3).
 */
const ocrRapid = (jobs) => {
  if (!jobs.length) return {};
  const output = execFileSync(
    process.env.OCR_PYTHON || 'python3',
    ['-I', join(__dirname, 'ocr-screens.py'), ...jobs.map((job) => job.file)],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(output);
};

/**
 * Reads each image's text with its platform's reader: Vision for the iPhone,
 * on a Mac, and RapidOCR for Android, on Linux.
 */
const ocr = (jobs) => {
  const android = jobs.filter((job) => job.platform === 'android');
  const iphone = jobs.filter((job) => job.platform !== 'android');
  return { ...(iphone.length ? ocrVision(iphone) : {}), ...ocrRapid(android) };
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
    platform: shot.platform,
    languages: OCR_LANGUAGES[shot.settings.language],
  })));

  const workDir = mkdtempSync(join(tmpdir(), 'screens-'));
  const strips = [];
  for (const shot of present) {
    const file = join(dir, shot.file);
    for (const [regionName, labels] of expectedLabels(shot)) {
      const region = REGIONS_BY_PLATFORM[shot.platform][regionName];
      if (labels.every((label) => showsLabel(text[file] || [], label, region))) continue;
      const strip = join(workDir, `${shot.name}-${regionName}.png`);
      await cropStrip(file, region, strip);
      strips.push({ file, strip, region, platform: shot.platform, languages: OCR_LANGUAGES[shot.settings.language] });
    }
  }
  if (strips.length) {
    const stripText = ocr(strips.map(({ strip, platform, languages }) => ({ file: strip, platform, languages })));
    for (const { file, strip, region } of strips) {
      const lines = (stripText[strip] || []).map((line) => fromStrip(line, region));
      text[file] = [...(text[file] || []), ...lines];
    }
  }
  return text;
};

const main = async () => {
  const argument = (name) => {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : process.argv[index + 1];
  };
  const dir = argument('--dir') && resolve(argument('--dir'));
  if (!dir) {
    console.error('Usage: node scripts/check-screens.cjs --dir <screens folder> [--platform ios|android|all] [--group <group>]');
    process.exit(2);
  }
  const config = loadConfig();
  // all: both platforms' shots in one folder, as in the joined artifact.
  const platform = argument('--platform') || 'ios';
  const platforms = platform === 'all' ? PLATFORMS : [platform];
  const shots = takeGroup(platforms.flatMap((each) => planChecks(config, each)), argument('--group'), config);
  const text = await readText(dir, shots);
  writeFileSync(join(dir, 'ocr.json'), JSON.stringify(text, null, 1));

  const results = shots.map((shot) => {
    const lines = text[join(dir, shot.file)];
    return { file: shot.file, problems: lines ? checkShot(shot, lines) : ['no screenshot'] };
  });
  writeFileSync(join(dir, 'checks.json'), JSON.stringify(results, null, 1));
  const failed = results.filter((result) => result.problems.length);
  const summary = [
    `### Key-screen text checks (${{ ios: 'iPhone', android: 'Android', all: 'iPhone and Android' }[platform]})`,
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
  VERSE_BUTTON_SHORT,
  REGIONS,
  REGIONS_BY_PLATFORM,
  NEVER_SHOWN,
  NEVER_SHOWN_BY_PLATFORM,
  showsLabel,
  checkShot,
  planChecks,
  fromStrip,
};
