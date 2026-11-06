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
 *   such as the Bible header's names, required on the Android phone at 100% only;
 * - a screen with a `later` shot and `mustAdvance` shows a time, as minutes
 *   and seconds, that moved on by at least half the time between the shots,
 *   such as Bible audio's elapsed time while it plays (#551);
 * - on the iPad (#324), a page's text stays in the centred content column,
 *   no text touches the screen's left or right edge, and a popup is no wider
 *   than POPUP_MAX_WIDTH, measured from its surface's colour, since on iOS a
 *   popup could fill the screen with its text still in the middle. A screen
 *   with `wideContent`, such as a web page the app shows, skips the first two;
 * - at the iPad's split window widths on Android, no Bible card control
 *   crosses the card's edge (#681), and a screen's `variantRules` for that
 *   window, such as `w320`, apply, such as the book's name in its pill.
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
 *   node scripts/check-screens.cjs --dir <screens folder> --platform ipad
 *                                                         Checks the iPad shots, ipad/*.png (#324)
 *   node scripts/check-screens.cjs --dir <screens folder> --platform all
 *                                                         Checks them all, as in the joined artifacts
 *   node scripts/check-screens.cjs --dir <screens folder> --split 504
 *                                                         Checks the Android shots at an iPad's split
 *                                                         window 504 points wide, android/*-w504.png (#324)
 *
 * Writes ocr.json and checks.json into that folder, and a summary to the step
 * summary. Exits 1 if any rule fails.
 */
const { execFileSync } = require('node:child_process');
const { appendFileSync, existsSync, mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { PLATFORMS, loadConfig, planCaptures, planSplitCaptures, screenOf, takeGroup, variantsOn } = require('./capture-ios-screens.cjs');

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
  // The 13-inch iPad in portrait, 3:4 (#324): the tab labels at 96% of the
  // way down, and the chapter controls at 91%, or 96% while reading.
  // A page's content runs from below the header, which ends 88 points down,
  // to the tab bar: the column check looks there.
  ipad: {
    tabs: [0.92, 0.99],
    chapterControls: [0.85, 0.94],
    chapterControlsReading: [0.92, 0.99],
    content: [0.068, 0.92],
  },
  // And in landscape, 4:3: the tab labels at 95%, the chapter controls at 89%.
  'ipad-landscape': {
    tabs: [0.91, 0.99],
    chapterControls: [0.83, 0.93],
    chapterControlsReading: [0.9, 0.99],
    content: [0.09, 0.91],
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
  ipad: NEVER_SHOWN,
  android: [...NEVER_SHOWN, "isn't responding", 'keeps stopping', 'has stopped'],
};

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isChinese = (text) => /\p{Script=Han}/u.test(text);

/**
 * Whether a label appears as a whole word, with its top inside the region.
 * "Verse" doesn't count inside "Verses". Chinese has no spaces between words,
 * so any occurrence counts there. Case doesn't count: Vision read the iPad
 * tab bar's "Inicio" as "InIcIo" (#589), and a label cut short is still short
 * in any case.
 */
const showsLabel = (lines, label, region) => {
  // A label given as a list shows if any of its forms does.
  if (Array.isArray(label)) return label.some((form) => showsLabel(lines, form, region));
  const pattern = isChinese(label)
    ? new RegExp(escape(label), 'u')
    : new RegExp(`(^|[^\\p{L}])${escape(label)}($|[^\\p{L}])`, 'iu');
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

/**
 * Where the labels sit in an Android split window (#324), measured in points
 * from its bottom on the emulators at each width: the tab labels about 58 up,
 * the chapter controls about 148, or 72 while reading. A page's content runs
 * from below the status bar to the tab bar.
 */
const splitRegions = ({ height }) => {
  const up = (points) => 1 - points / height;
  return {
    tabs: [up(80), up(8)],
    chapterControls: [up(175), up(120)],
    chapterControlsReading: [up(100), up(50)],
    content: [40 / height, up(80)],
  };
};

/** Where a shot's labels belong: its device's regions, turned as the shot was. */
const regionsFor = (shot) => (shot.split ? splitRegions(shot.split) : REGIONS_BY_PLATFORM[screenOf(shot)]);

/** Returns what's wrong with one shot, given the lines of text read from it. */
const checkShot = (shot, lines) => {
  const problems = [];
  const regions = regionsFor(shot);
  for (const [region, labels] of expectedLabels(shot)) {
    const missing = labels.filter((label) => !showsLabel(lines, label, regions[region]));
    if (!missing.length) continue;
    problems.push(
      region === 'tabs'
        ? `tab labels missing: ${missing.join(', ')}`
        : `the verse button doesn't show "${[missing[0]].flat()[0]}"`,
    );
  }
  // Setup's own shots, which open before setup is done, show its Get Started
  // on its last step on purpose (#669).
  const setupShot = shot.settings?.setupDone === false;
  for (const text of NEVER_SHOWN_BY_PLATFORM[shot.platform]) {
    if (setupShot && text === 'Get Started') continue;
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

/** A time read as minutes and seconds, such as 1:05, in seconds. */
const secondsOf = (match) => Number(match[1]) * 60 + Number(match[2]);

/**
 * Whether the time a shot shows moved on in its later shot (`later` seconds
 * after it) by at least half that long. The time is the leftmost line matching
 * `mustAdvance`, a regular expression whose first two groups are its minutes
 * and seconds: the audio player's elapsed time, left of its length.
 */
const checkAdvance = (shot, lines, laterLines) => {
  if (!shot.mustAdvance || !shot.later) return [];
  const pattern = new RegExp(shot.mustAdvance, 'u');
  const timeIn = (read) =>
    [...(read || [])]
      .sort((a, b) => a.box[0] - b.box[0])
      .map((line) => pattern.exec(line.text.trim()))
      .find(Boolean);
  if (!laterLines) return ['no later screenshot'];
  const [before, after] = [timeIn(lines), timeIn(laterLines)];
  if (!before || !after) {
    return [`no time matching /${shot.mustAdvance}/ in ${before ? 'the later screenshot' : 'the screenshot'}`];
  }
  const moved = secondsOf(after) - secondsOf(before);
  return moved >= shot.later / 2
    ? []
    : [`the time shown went from ${before[0]} to ${after[0]} in ${shot.later} seconds, not on by at least ${shot.later / 2}`];
};

/**
 * The app's layout sizes the iPad checks expect, from constants/Layout.ts,
 * constants/AppPreferences.ts, and styles/PopupStyles.ts, which
 * test/screens.test.ts keeps in step: the content column is CONTENT_MAX_WIDTH
 * points wide at the default text size and wider in proportion above it; a
 * tablet starts at TABLET_TEXT_SCALE; and a popup is at most POPUP_MAX_WIDTH.
 */
const CONTENT_MAX_WIDTH = 720;
const DEFAULT_TEXT_SCALE = 1.25;
const TABLET_TEXT_SCALE = 1.5;
const POPUP_MAX_WIDTH = 560;

// The iPad's own text size, as the app sees it (fontScale). The iPad shots
// use its default; at a larger one the column is about as wide as the screen,
// so the column check skips it.
const IOS_FONT_SCALES = { large: 1 };

// How far, as a fraction of the width, text may stray past the column or come
// to the screen's edge: Vision's boxes are a few points loose, and a line's
// box can include a chevron or icon beside it.
const COLUMN_SLACK = 0.01;
const EDGE = 0.004;
// Below the status bar, whose clock sits near the left edge.
const BELOW_STATUS_BAR = 0.025;

// A popup's surface, the light theme's canvas (constants/Themes.ts), which
// the dimmed page behind it never matches.
const POPUP_SURFACE = [0xf2, 0xe6, 0xdf];

const percent = (fraction) => `${Math.round(fraction * 100)}%`;

/** The iPad's width in points, as the shot was turned, or a split window's. */
const widthInPoints = (shot) => {
  if (shot.split) return shot.split.width;
  return screenOf(shot) === 'ipad-landscape' ? shot.points.height : shot.points.width;
};

/** The content column's left and right edges, as fractions of the width, or null to skip. */
const columnEdges = (shot) => {
  const fontScale = shot.split ? shot.settings.fontScale : IOS_FONT_SCALES[shot.settings.iosTextSize];
  if (!fontScale) return null;
  const width = widthInPoints(shot);
  const scale = (shot.settings.textScale ?? TABLET_TEXT_SCALE) * fontScale;
  const column = Math.min(width, Math.round(CONTENT_MAX_WIDTH * Math.max(1, scale / DEFAULT_TEXT_SCALE)));
  return [(width - column) / 2 / width, (width + column) / 2 / width];
};

/**
 * What's wrong with an iPad shot's layout, from its text's positions (#324):
 * text outside the content column, between the header and the tab bar, and
 * text touching the screen's left or right edge, as when landscape cuts a page
 * off.
 */
const checkIpadLayout = (shot, lines) => {
  if ((shot.platform !== 'ipad' && !shot.split) || shot.wideContent) return [];
  const problems = [];
  // Words and numbers only: iPadOS draws its window's resize grip in the
  // bottom-right corner, which Vision reads as "/".
  const read = lines.filter((line) => !line.closerLook && /[\p{L}\p{N}]/u.test(line.text));
  const edges = columnEdges(shot);
  if (edges) {
    const [left, right] = [edges[0] - COLUMN_SLACK, edges[1] + COLUMN_SLACK];
    const [top, bottom] = regionsFor(shot).content;
    const outside = read.filter(
      (line) => line.box[1] >= top && line.box[1] <= bottom && (line.box[0] < left || line.box[0] + line.box[2] > right),
    );
    if (outside.length) {
      problems.push(
        `text outside the content column, ${percent(edges[0])} to ${percent(edges[1])} of the way across: ` +
          outside
            .slice(0, 3)
            .map((line) => `"${line.text.trim()}" at ${percent(line.box[0])} to ${percent(line.box[0] + line.box[2])}`)
            .join(', '),
      );
    }
  }
  // RapidOCR, which reads the Android split windows, boxes a banner's title
  // with some of its photo, out to the edge, so they skip this.
  const touching = shot.split ? [] : read.filter(
    (line) => line.box[1] >= BELOW_STATUS_BAR && (line.box[0] < EDGE || line.box[0] + line.box[2] > 1 - EDGE),
  );
  if (touching.length) {
    problems.push(`text at the screen's edge, likely cut off: ${touching.slice(0, 3).map((line) => `"${line.text.trim()}"`).join(', ')}`);
  }
  return problems;
};

/** Whether a shot shows a popup: popup= in its path (#372), or a screen marked `popup`, such as setup. */
const showsPopup = (shot) => Boolean(shot.popup) || /[?&]popup=/.test(shot.route);

/**
 * The widest run of `color` through the screen's middle, as a fraction of the
 * width: a popup's surface, which is centred. Runs bridge gaps of up to `gap`
 * of the width, such as a line of text, and each row starts from the middle,
 * or the nearest surface pixel within a gap of it. A page without a dimmed
 * popup over it is the same colour edge to edge, 1.
 */
const surfaceWidth = async (file, color = POPUP_SURFACE, { tolerance = 10, gap = 0.012 } = {}) => {
  const sharp = require('sharp');
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const isSurface = (x, y) => {
    const index = (y * width + x) * 3;
    return color.every((value, channel) => Math.abs(data[index + channel] - value) <= tolerance);
  };
  const maxGap = Math.round(width * gap);
  const middle = Math.round(width / 2);
  let widest = 0;
  for (let y = Math.round(height * 0.1); y < height * 0.9; y += 4) {
    let start = -1;
    for (let dx = 0; dx <= maxGap && start < 0; dx++) {
      if (isSurface(middle + dx, y)) start = middle + dx;
      else if (isSurface(middle - dx, y)) start = middle - dx;
    }
    if (start < 0) continue;
    const edge = (step) => {
      let last = start;
      for (let x = start; x >= 0 && x < width; x += step) {
        if (isSurface(x, y)) last = x;
        else if (Math.abs(x - last) > maxGap) break;
      }
      return last;
    };
    widest = Math.max(widest, (edge(1) - edge(-1) + 1) / width);
  }
  return widest;
};

/**
 * Whether an iPad popup is at most POPUP_MAX_WIDTH wide (#324). On iOS, a
 * popup given a percentage width filled 90% of the iPad with its text in only
 * the middle, so its text alone can't tell. Light theme only: in dark mode the
 * dimmed page is too close to the surface's colour.
 */
const checkPopupWidth = async (shot, file) => {
  if ((shot.platform !== 'ipad' && !shot.split) || shot.wideContent || !showsPopup(shot) || shot.settings.theme === 'dark') {
    return [];
  }
  const width = widthInPoints(shot);
  const measured = await surfaceWidth(file);
  return measured > POPUP_MAX_WIDTH / width + COLUMN_SLACK
    ? [`the popup is about ${Math.round(measured * width)} points wide, more than ${POPUP_MAX_WIDTH}`]
    : [];
};

// The Bible card's widest, DOCK_CARD_MAX_WIDTH in app/(tabs)/bible/index.tsx,
// which test/screens.test.ts keeps in step. In a split window it's the window
// less 16 points a side, up to that.
const DOCK_CARD_MAX_WIDTH = 640;

/**
 * Whether a control crosses the Bible card's left or right edge in an Android
 * split window (#681): at 320 points the audio row's sleep timer ran past the
 * card's right edge, which cut it off. The card is white, and what's around it
 * warm or grey, so blue just inside an edge, a control's fill or icon, means
 * one crosses it. It looks from 110 to 300 points up from the window's bottom,
 * where the card sits with or without the tab bar below it. Light theme only,
 * as the split shots are.
 */
const checkDockCard = async (shot, file) => {
  if (!shot.split || !shot.route.startsWith('bible') || showsPopup(shot) || shot.settings.theme === 'dark') return [];
  const sharp = require('sharp');
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = shot.split;
  const scale = info.width / width;
  const card = Math.min(width - 32, DOCK_CARD_MAX_WIDTH);
  const left = (width - card) / 2;
  const insides = { left: [left + 1.5, left + 2.5], right: [left + card - 2.5, left + card - 1.5] };
  const problems = [];
  for (const [side, columns] of Object.entries(insides)) {
    let blue = 0;
    for (let up = 300; up >= 110; up--) {
      const y = Math.round((height - up) * scale);
      for (const x of columns) {
        const index = (y * info.width + Math.round(x * scale)) * 3;
        if (data[index + 2] - data[index] > 16) blue++;
      }
    }
    if (blue >= 4) problems.push(`a Bible card control crosses the card's ${side} edge`);
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
      variantsOn(candidate, platform).some((variant) => `${candidate.name}-${variant}` === shot.name),
    );
    const variant = shot.name.slice(screen.name.length + 1);
    const forVariant = screen.variantRules?.[variant] || {};
    return {
      ...shot,
      tabs: screen.tabs,
      ...(screen.wideContent ? { wideContent: true } : {}),
      ...(screen.popup ? { popup: true } : {}),
      ...(platform === 'ipad' ? { points: config.ipad.points } : {}),
      mustAdvance: screen.mustAdvance,
      mustShowLines: joinRules(screen.mustShowLines, forVariant.mustShowLines),
      mustNotShowLines: joinRules(screen.mustNotShowLines, forVariant.mustNotShowLines),
    };
  });

/**
 * The Android shots at a split window `width` points wide (#324), with what
 * doesn't depend on the window's size: the tab labels, the verse button, the
 * screen's mustNotShowLines (no word cut short), and the layout checks. Its
 * mustShowLines are written for the phone, where a narrower window may leave
 * a line below the fold, so they're left out; its `variantRules` for the
 * window, such as `w320`, add rules of its own (#681).
 */
const planSplitChecks = (config, width) =>
  planSplitCaptures(config, width).map((shot) => {
    const screen = config.screens.find((candidate) => candidate.name === shot.screen);
    const forWindow = screen.variantRules?.[`w${width}`] || {};
    return {
      ...shot,
      tabs: screen.tabs,
      ...(screen.wideContent ? { wideContent: true } : {}),
      ...(screen.popup ? { popup: true } : {}),
      mustShowLines: forWindow.mustShowLines,
      mustNotShowLines: joinRules(screen.mustNotShowLines, forWindow.mustNotShowLines),
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
 * Reads each image's text with its platform's reader: Vision for the iPhone
 * and iPad, on a Mac, and RapidOCR for Android, on Linux.
 */
const ocr = (jobs) => {
  const android = jobs.filter((job) => job.platform === 'android');
  const apple = jobs.filter((job) => job.platform !== 'android');
  return { ...(apple.length ? ocrVision(apple) : {}), ...ocrRapid(android) };
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
  // With each shot's later screenshot, if it has one.
  const files = present.flatMap((shot) =>
    [shot.file, shot.laterFile].filter((file) => file && existsSync(join(dir, file))).map((file) => ({ shot, file })),
  );
  const text = ocr(files.map(({ shot, file }) => ({
    file: join(dir, file),
    platform: shot.platform,
    languages: OCR_LANGUAGES[shot.settings.language],
  })));

  const workDir = mkdtempSync(join(tmpdir(), 'screens-'));
  const strips = [];
  for (const shot of present) {
    const file = join(dir, shot.file);
    for (const [regionName, labels] of expectedLabels(shot)) {
      const region = regionsFor(shot)[regionName];
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
    console.error('Usage: node scripts/check-screens.cjs --dir <screens folder> [--platform ios|ipad|android|all] [--group <group>]');
    process.exit(2);
  }
  const config = loadConfig();
  // all: every platform's shots in one folder, as in the joined artifacts.
  const split = argument('--split') && Number(argument('--split'));
  const platform = split ? 'android' : argument('--platform') || 'ios';
  const platforms = platform === 'all' ? PLATFORMS : [platform];
  const shots = split
    ? planSplitChecks(config, split)
    : takeGroup(platforms.flatMap((each) => planChecks(config, each)), argument('--group'), config);
  const text = await readText(dir, shots);
  writeFileSync(join(dir, 'ocr.json'), JSON.stringify(text, null, 1));

  const results = [];
  for (const shot of shots) {
    const file = join(dir, shot.file);
    const lines = text[file];
    const later = shot.laterFile && text[join(dir, shot.laterFile)];
    results.push({
      file: shot.file,
      problems: lines
        ? [
            ...checkShot(shot, lines),
            ...checkAdvance(shot, lines, later),
            ...checkIpadLayout(shot, lines),
            ...(await checkPopupWidth(shot, file)),
            ...(await checkDockCard(shot, file)),
          ]
        : ['no screenshot'],
    });
  }
  writeFileSync(join(dir, 'checks.json'), JSON.stringify(results, null, 1));
  const failed = results.filter((result) => result.problems.length);
  const summary = [
    `### Key-screen text checks (${split ? `Android, ${split}-point split window` : { ios: 'iPhone', ipad: 'iPad', android: 'Android', all: 'iPhone, iPad, and Android' }[platform]})`,
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
  regionsFor,
  NEVER_SHOWN,
  NEVER_SHOWN_BY_PLATFORM,
  showsLabel,
  checkShot,
  checkAdvance,
  checkIpadLayout,
  checkPopupWidth,
  checkDockCard,
  columnEdges,
  surfaceWidth,
  CONTENT_MAX_WIDTH,
  DEFAULT_TEXT_SCALE,
  TABLET_TEXT_SCALE,
  POPUP_MAX_WIDTH,
  POPUP_SURFACE,
  DOCK_CARD_MAX_WIDTH,
  planChecks,
  planSplitChecks,
  splitRegions,
  fromStrip,
};
