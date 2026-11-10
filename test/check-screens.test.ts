import { describeChineseMissionSpotlight } from '@/features/sabbath-school/ChineseMissionSpotlight';

const {
  checkAdvance,
  checkShot,
  fromStrip,
  planChecks,
  REGIONS,
} = require('../scripts/check-screens.cjs');
const { loadConfig } = require('../scripts/capture-ios-screens.cjs');
const samples = require('./screens/ocr-samples.json');

type Line = { text: string; box: number[] };

const shots = planChecks(loadConfig());
const shot = (name: string) => shots.find((candidate: { name: string }) => candidate.name === name);
const line = (text: string, y: number): Line => ({ text, box: [0.1, y, 0.3, 0.02] });

describe('key-screen text checks on real screenshots', () => {
  it('passes a good Bible screen', () => {
    expect(checkShot(shot('bible-dual-default'), samples.clean['bible-dual-default'])).toEqual([]);
  });

  it('passes a good Home screen', () => {
    expect(checkShot(shot('home-default'), samples.clean['home-default'])).toEqual([]);
  });

  it('passes the Bible while reading, with no tab bar and its verse numbers intact', () => {
    expect(checkShot(shot('bible-scrolled-default'), samples.clean['bible-scrolled-default'])).toEqual([]);
  });

  it('ignores text Vision garbles elsewhere on a good screen', () => {
    // Small print in a book cover image, and a superscript footnote number.
    const text = (sample: string) => (samples.clean[sample] as Line[]).map((each) => each.text);
    expect(text('library-zh')).toEqual(expect.arrayContaining(['ANDKPW MUKKA', 'Andrew Murray']));
    expect(text('bible-scrolled-default')).toContain('eternal life4.');
    expect(checkShot(shot('library-zh'), samples.clean['library-zh'])).toEqual([]);
    expect(checkShot(shot('bible-scrolled-default'), samples.clean['bible-scrolled-default'])).toEqual([]);
  });

  it('catches a screen covered by the "Open in" prompt', () => {
    const problems = checkShot(shot('bible-dual-default'), samples.openPrompt['bible-dual-default']);
    expect(problems).toContain('shows "Open in"');
    // Home behind the prompt says "Read Verse", but not in the chapter controls.
    expect(problems).toContain("the verse button doesn't show \"Verse\"");
  });
});

describe('popup shots (#372)', () => {
  const verse = samples.clean['bible-verse-popup-default'] as Line[];
  const textSize = samples.clean['text-size-xl'] as Line[];

  it("don't need the tab bar or the verse button, which the popup covers or dims", () => {
    expect(checkShot(shot('bible-verse-popup-default'), verse)).toEqual([]);
    expect(checkShot(shot('text-size-xl'), textSize)).toEqual([]);
  });

  it('catch the audio settings popup back at the bottom of the screen', () => {
    // What Vision read on the 1.3.2 release PR, where the popup still sat at
    // the bottom, its title 47% of the way down, and the Listen offline
    // row added since (#556).
    const atBottom = [
      ...(samples.bottomSheet['bible-audio-settings-zh'] as Line[]),
      line('離線收聽', 0.9),
      line('離線聖經音訊', 0.94),
    ];
    expect(checkShot(shot('bible-audio-settings-zh'), atBottom)).toEqual([
      '/^有聲書設定$/ is 47% of the way down, not at most 40%',
    ]);
    // Centred like the others: everything about 20% higher.
    const centred = atBottom.map(({ text, box }) => ({ text, box: [box[0], box[1] - 0.2, box[2], box[3]] }));
    expect(checkShot(shot('bible-audio-settings-zh'), centred)).toEqual([]);
  });

  it('catch a Close or Apply button coming back', () => {
    expect(checkShot(shot('bible-verse-popup-default'), [...verse, line('Close', 0.8)])).toEqual([
      '"Close" matches /^Close$/, which must not show',
    ]);
    expect(checkShot(shot('text-size-xl'), [...textSize, line('Apply', 0.9)])).toEqual([
      '"Apply" matches /^Apply$/, which must not show',
    ]);
  });
});

describe("the Bible's search results page (#544)", () => {
  // What the page shows for Moriah with Genesis 22 open: the results, over
  // the tab bar and the chapter controls.
  const results = [
    line('This chapter · 1 verse', 0.15),
    line('Genesis 22:2', 0.2),
    line('Whole Bible · 2 verses', 0.4),
    line('Genesis · 1', 0.45),
  ];

  it("doesn't need the tab bar or the verse button, which the page covers", () => {
    expect(checkShot(shot('bible-search-default'), results)).toEqual([]);
  });

  it('catches the chapter controls or tab bar showing through again', () => {
    expect(checkShot(shot('bible-search-default'), [...results, line('Verse', 0.86), line('Explore', 0.95)])).toEqual([
      '"Verse" matches /^Verse$/, which must not show',
      '"Explore" matches /^Explore$/, which must not show',
    ]);
  });
});

describe('the bugs fixed in 0.42.0', () => {
  const bible = samples.clean['bible-dual-default'] as Line[];

  it('catches a verse button cut off to "V"', () => {
    const cutOff = bible.map((each) => (each.text === 'Verse v' ? { ...each, text: 'V v' } : each));
    expect(checkShot(shot('bible-dual-default'), cutOff)).toEqual(["the verse button doesn't show \"Verse\""]);
  });

  it('catches a verse number split across two lines', () => {
    const split = (samples.clean['bible-scrolled-default'] as Line[]).map((each) =>
      each.text.startsWith('14 ') ? { ...each, text: each.text.replace('14 ', '1 ') } : each,
    );
    split.push(line('4 the wilderness, so the Son of Man', 0.12));
    expect(checkShot(shot('bible-scrolled-default'), split)).toEqual(['no line matches /^14\\b/']);
  });

  it('catches a screen in the wrong language', () => {
    const englishTabs = [line('Home', 0.944), line('Bible', 0.944), line('Explore', 0.944), line('You', 0.944)];
    // The Chinese Explore cards' own checks catch it too (#554).
    expect(checkShot(shot('explore-zh'), englishTabs)).toEqual([
      'tab labels missing: 首頁, 聖經, 探索',
      'no line matches /^精選書庫/',
      'no line matches /^深入研經/',
    ]);
  });

  it('catches the setup dialog and unfilled values', () => {
    const problems = checkShot(shot('home-default'), [
      ...(samples.clean['home-default'] as Line[]),
      line('Get Started', 0.8),
      line('Sabbath starts in undefined', 0.3),
    ]);
    expect(problems).toEqual(['shows "Get Started"', 'shows "undefined"']);
  });

  it("lets setup's own last step show Get Started, and nothing else it shouldn't (#669)", () => {
    const last = shot('setup-contrast-dark-default');
    expect(last.settings.setupDone).toBe(false);
    const lines = ['Which is easier to read in', 'High contrast', 'Standard', 'Get Started'].map((text, index) =>
      line(text, 0.2 + index * 0.1),
    );
    expect(checkShot(last, lines)).toEqual([]);
    expect(checkShot(last, [...lines, line('undefined', 0.9)])).toEqual(['shows "undefined"']);
  });
});

describe('closer look at a strip', () => {
  it('maps a line read from a strip back onto the screenshot', () => {
    const fromCloserLook = fromStrip({ text: 'Explore', box: [0.58, 0.5, 0.2, 0.2] }, REGIONS.tabs);
    expect(fromCloserLook.box[1]).toBeCloseTo(0.945, 3);
    expect(fromCloserLook.box[3]).toBeCloseTo(0.018, 3);
  });

  it('doesn’t require one-character labels, which Vision often misses', () => {
    // The first pass missed 您 here; the other three labels still show Chinese.
    const lines = samples.clean['library-zh'] as Line[];
    expect(checkShot(shot('library-zh'), lines)).toEqual([]);
    expect(
      checkShot(shot('bible-pinyin-zh'), [line('約翰福音', 0.86), line('首頁', 0.944), line('聖經', 0.944), line('探索', 0.944)]),
    ).toEqual([]);
  });
});

describe('screen rules', () => {
  it('uses each screen’s own rules, even when names share a start', () => {
    // "bible-dual-default" starts with "bible-", but belongs to bible-dual.
    expect(shot('bible-scrolled-default').tabs).toBe(false);
    expect(shot('bible-scrolled-default').mustShowLines).toEqual(['^14\\b', '^15\\b', '^16\\b', '^John\\b']);
    expect(shot('explore-default').mustShowLines).toBeUndefined();
    expect(shot('bible-default').tabs).toBeUndefined();
  });

  it('checks the spoken language on the CUV audio button', () => {
    // The dock's book pill reads 詩篇 too.
    const tabs = [line('首頁', 0.944), line('聖經', 0.944), line('探索', 0.944), line('詩篇', 0.86)];
    expect(checkShot(shot('bible-cuv-cantonese-zh'), [...tabs, line('粵語', 0.88)])).toEqual([]);
    expect(checkShot(shot('bible-cuv-cantonese-zh'), [...tabs, line('國語', 0.88)])).toEqual(['no line matches /粵語/']);
    // Simplified characters for the Simplified edition.
    expect(checkShot(shot('bible-cuvs-zh-cn'), [line('首页', 0.944), line('圣经', 0.944), line('探索', 0.944), line('诗篇', 0.86), line('國語', 0.88)]))
      .toEqual(['no line matches /国语/']);
  });

  it("checks the Bible header's translation button: badges and names, cut short only with a back arrow (#376)", () => {
    // The real text of a good shot from before 1.7.0: "XA EN", "BSB +", "* CUV v"
    // (XA was the 文A icon, which 1.7.0 removed; nothing requires it now).
    const dual = samples.clean['bible-dual-default'] as Line[];
    expect(checkShot(shot('bible-dual-default'), dual)).toEqual([]);
    const withoutHeader = dual.filter((each) => each.box[1] > 0.12);
    expect(checkShot(shot('bible-dual-default'), withoutHeader)).toEqual([
      'no line matches /\\bEN\\b/',
      'no line matches /BSB/',
      'no line matches /[Cc]UV/',
    ]);
    // 1.7.0's header, with no icon.
    const badges = [...withoutHeader, line('EN BSB + * CUV v', 0.05)];
    expect(checkShot(shot('bible-dual-default'), badges)).toEqual([]);
    expect(checkShot(shot('bible-dual-dark'), badges)).toEqual([]);

    // With a back arrow, the iPhone has room for both names at every size.
    expect(checkShot(shot('bible-dual-back-default'), badges)).toEqual([]);
    expect(checkShot(shot('bible-dual-back-xl'), badges)).toEqual([]);
    // What the 0.43.0 preview showed: the names cut short.
    const namesCut = [...withoutHeader, line('EN B... +* C...', 0.05)];
    expect(checkShot(shot('bible-dual-back-default'), namesCut)).toEqual(['no line matches /BSB/', 'no line matches /[Cc]UV/']);
    expect(checkShot(shot('bible-dual-back-xl'), namesCut)).toEqual(['no line matches /BSB/', 'no line matches /[Cc]UV/']);
  });

  it('catches tab labels that wrap, or rise out of an overgrown tab bar, at about 4× text (#380)', () => {
    const tabs = (labels: string[], y: number) => labels.map((label) => line(label, y));
    expect(checkShot(shot('explore-xl-ios-large-text'), tabs(['Home', 'Bible', 'Explore', 'You'], 0.944))).toEqual([]);
    // "Explore" wrapped onto two lines, as on Android before #380.
    expect(
      checkShot(shot('explore-xl-ios-large-text'), [...tabs(['Home', 'Bible', 'Explor', 'You'], 0.93), line('e', 0.96)]),
    ).toEqual(['tab labels missing: Explore']);
    // An overgrown tab bar: the labels sit above the tab bar's area.
    expect(checkShot(shot('explore-es-xl-ios-large-text'), tabs(['Inicio', 'Biblia', 'Explorar', 'Tú'], 0.86))).toEqual([
      // Tú is too short to require: OCR misses it alone under its icon.
      'tab labels missing: Inicio, Biblia, Explorar',
    ]);
  });

  it("catches the previous Bible's book names after a link opens the CUV (#373)", () => {
    // The book list, which names the CUV's books with the app's English in
    // parentheses since #723; the pill names the book in English whichever
    // names are loaded.
    const after = shot('bible-cuv-after-spanish-default');
    const list = (names: string[]) => names.map((name, index) => line(name, 0.3 + index * 0.06));
    expect(checkShot(after, list(['創世記 (Genesis)', '出埃及記 (Exodus)', '利未記 (Leviticus)']))).toEqual([]);
    // Vision, reading English first, may miss the Chinese.
    expect(checkShot(after, list(['(Genesis)', '(Exodus)', '(Leviticus)', '(Numbers)']))).toEqual([]);
    // The Spanish names, kept after the link.
    expect(checkShot(after, list(['Génesis (Genesis)', 'Éxodo (Exodus)', 'Levítico (Leviticus)']))).toEqual([
      '"Éxodo (Exodus)" matches /^[EÉ]xodo\\b/, which must not show',
      '"Levítico (Leviticus)" matches /^Lev[ií]tico\\b/, which must not show',
    ]);
    // The list before #723, with no English.
    expect(checkShot(after, list(['創世記', '出埃及記', '利未記']))).toEqual([
      'no line matches /[(（]Genesis\\b/',
      'no line matches /[(（]Exodus\\b/',
      'no line matches /[(（]Leviticus\\b/',
    ]);
  });

  it("catches the Home verse card's cut-off buttons and broken heading at 3.2× (#385)", () => {
    const tabs = ['Inicio', 'Biblia', 'Explorar', 'Tú'].map((label) => line(label, 0.944));
    const homeEs = shot('home-es-xl-ios-large-text');
    expect(checkShot(homeEs, [...tabs, line('Versículo de', 0.09), line('hoy', 0.17)])).toEqual([]);
    // What the 0.43.0 run showed: the heading broken mid-word.
    expect(checkShot(homeEs, [...tabs, line('Versícul', 0.08), line('o de hoy', 0.12)]))
      .toEqual(['no line matches /^Vers[ií]culo\\b/']);
    // Vision can drop the accent when the photo's cross runs behind the heading.
    expect(checkShot(homeEs, [...tabs, line('Versiculo de', 0.08), line('hoy', 0.12)])).toEqual([]);
    // English: Vision reads each button's icon as a character before its label.
    const homeEn = shot('home-xl-ios-large-text');
    const enTabs = ['Home', 'Bible', 'Explore', 'You'].map((label) => line(label, 0.94));
    const heading = line("Today's Verse", 0.09);
    expect(checkShot(homeEn, [...enTabs, heading, line('‹ Share Verse', 0.69), line('a Read Verse', 0.8)]))
      .toEqual([]);
    // A long daily verse pushes Read Verse below the shot, as John 1:1 does, or
    // both buttons, as Genesis 1:27 does.
    expect(checkShot(homeEn, [...enTabs, heading, line('‹ Share Verse', 0.78)])).toEqual([]);
    expect(checkShot(homeEn, [...enTabs, heading, line('male and female', 0.65), line('them.', 0.81)]))
      .toEqual([]);
    // What the 0.43.0 run showed: the buttons cut off.
    const cutOff = '/\\b(Sh|Sha|Shar|Re|Rea|Ve|Ver|Vers)$/, which must not show';
    expect(checkShot(homeEn, [...enTabs, heading, line('‹ Shar', 0.69), line('a Rea', 0.7)])).toEqual([
      `"‹ Shar" matches ${cutOff}`,
    ]);
    expect(checkShot(homeEn, [...enTabs, heading, line('a Rea', 0.7)])).toEqual([`"a Rea" matches ${cutOff}`]);
    expect(checkShot(homeEn, [...enTabs, line("Today's Vers", 0.09), line('e', 0.15)])).toEqual([
      "no line matches /^Today.s Verse$/",
      `"Today's Vers" matches ${cutOff}`,
    ]);
  });

  it("checks Psalm 9's Higgaion Selah and Selah sit on the right, in the BSB", () => {
    const at16 = shot('bible-higgaion-selah-default');
    const at20 = shot('bible-selah-default');
    const verse = line('Verse v', 0.95);
    // A line at a given left edge, as a fraction of the screen's width.
    const at = (text: string, y: number, left: number): Line => ({ text, box: [left, y, 0.3, 0.02] });
    const verse16 = at('16 The LORD is known by the justice', 0.2, 0.05);
    const verse20 = at('20 Lay terror upon them, O LORD;', 0.2, 0.05);
    // Right-aligned, as the reader shows them at the default text size.
    expect(checkShot(at16, [verse16, at('Higgaion Selah2', 0.3, 0.68), verse])).toEqual([]);
    expect(checkShot(at20, [verse20, at('Selah', 0.3, 0.86), verse])).toEqual([]);
    // Left-aligned, or missing.
    expect(checkShot(at16, [verse16, at('Higgaion Selah2', 0.3, 0.1), verse])).toEqual([
      '/\\bHiggaion Selah/ starts 10% of the way across, not at least 50%',
    ]);
    expect(checkShot(at20, [verse20, at('Selah', 0.3, 0.12), verse])).toEqual([
      '/^Selah\\b/ starts 12% of the way across, not at least 50%',
    ]);
    expect(checkShot(at16, [verse16, verse])).toEqual(['no line matches /\\bHiggaion Selah/']);
    // 9:16's line can't stand in for 9:20's lone Selah.
    expect(checkShot(at20, [verse20, at('Higgaion Selah', 0.1, 0.68), verse])).toEqual(['no line matches /^Selah\\b/']);
  });

  it('reads each shot in its language', () => {
    const { OCR_LANGUAGES } = require('../scripts/check-screens.cjs');
    for (const each of shots) expect(OCR_LANGUAGES[each.settings.language]).toBeDefined();
  });
});

describe('Android shots (#372)', () => {
  const androidShots = planChecks(loadConfig(), 'android');
  const androidShot = (name: string) => androidShots.find((candidate: { name: string }) => candidate.name === name);
  const tabs = (y: number) => ['Home', 'Bible', 'Explore', 'You'].map((label) => line(label, y));

  it("get the same screen's rules, under android/", () => {
    expect(androidShot('bible-scrolled-default')).toMatchObject({
      file: 'android/bible-scrolled-default.png',
      platform: 'android',
      tabs: false,
      mustShowLines: ['^14\\b', '^15\\b', '^16\\b', '^John\\b'],
    });
    // The phone's narrower screen may wrap the heading between its words.
    expect(androidShot('home-xl-android-font-max').mustShowLines).toEqual(['^Today.s( Verse)?$']);
  });

  it("look for the tab bar where the Android phone's screen puts it", () => {
    expect(checkShot(androidShot('explore-default'), tabs(0.95))).toEqual([]);
    expect(checkShot(androidShot('explore-default'), tabs(0.8))).toEqual(['tab labels missing: Home, Bible, Explore, You']);
  });

  it("catch Android's crash and not-responding dialogs", () => {
    expect(checkShot(androidShot('explore-default'), [...tabs(0.95), line("NYCCSDA Preview isn't responding", 0.5)])).toEqual([
      'shows "isn\'t responding"',
    ]);
    expect(checkShot(androidShot('explore-default'), [...tabs(0.95), line('NYCCSDA Preview keeps stopping', 0.5)])).toEqual([
      'shows "keeps stopping"',
    ]);
  });
});

describe('rules for one platform (#372)', () => {
  const androidShots = planChecks(loadConfig(), 'android');
  const androidShot = (name: string) => androidShots.find((candidate: { name: string }) => candidate.name === name);
  const tabs = ['Home', 'Bible', 'Explore', 'You'].map((label) => line(label, 0.95));

  it("skip a line only the iPhone's reader can read, and keep it on the iPhone", () => {
    // RapidOCR reads setup's Next button as "Net" on the Android phone.
    const setup = [line('Welcome', 0.3), line('Language', 0.4), line('English', 0.5), line('Net', 0.9)];
    expect(checkShot(androidShot('setup-default'), setup)).toEqual([]);
    expect(checkShot(shot('setup-default'), setup)).toEqual(['no line matches /^Next$/']);
  });

  it("require the Bible header's names on the Android phone only where they fit", () => {
    const header = (text: string) => [line(text, 0.05), line('Psalms', 0.86), line('Verse', 0.86)];
    const namesGone = [...tabs, ...header('EN + 繁')];
    expect(checkShot(androidShot('bible-dual-default'), [...tabs, ...header('EN BSB + 繁 CUV')])).toEqual([]);
    // With a back arrow, both names fit at 100%; at 150% its narrower screen
    // leaves only the badges, where the iPhone keeps the names.
    expect(checkShot(androidShot('bible-dual-back-default'), namesGone)).toEqual(['no line matches /BSB/', 'no line matches /[Cc]UV/']);
    expect(checkShot(androidShot('bible-dual-back-large'), namesGone)).toEqual([]);
    expect(checkShot(shot('bible-dual-back-large'), namesGone)).toEqual(['no line matches /BSB/', 'no line matches /[Cc]UV/']);
  });
});

describe('the verse button’s short label (#372)', () => {
  const androidShots = planChecks(loadConfig(), 'android');
  const longChapter = androidShots.find((candidate: { name: string }) => candidate.name === 'bible-long-chapter-android-font-max');
  const verses = ['100 I discern', '101 I have kept', '102I have not departed', 'Psalms'].map((text, index) => line(text, 0.1 + index * 0.2));

  it('passes "Vs.", which the app shows when the chapter controls are tight, but not a cut-off "V"', () => {
    expect(checkShot(longChapter, [...verses, line('Vs.', 0.92)])).toEqual([]);
    expect(checkShot(longChapter, [...verses, line('V', 0.92)])).toEqual(["the verse button doesn't show \"Verse\""]);
  });

  it('accepts a verse number read without the space after it, but not a longer number', () => {
    expect(checkShot(longChapter, [...verses, line('Vs.', 0.92)])).toEqual([]);
    const split = verses.map((each) => (each.text.startsWith('102') ? { ...each, text: '1020 have not departed' } : each));
    expect(checkShot(longChapter, [...split, line('Vs.', 0.92)])).toEqual(['no line matches /^102(?!\\d)/']);
  });
});

describe('audio that keeps playing (#551)', () => {
  const playing = shot('bible-audio-playing-default');
  // As Vision reads the audio dock: the elapsed time with the slider's thumb
  // after it, the length at the right, and the status bar's clock.
  const dock = (elapsed: string, length = '1:07') => [
    { text: '9:41', box: [0.15, 0.03, 0.09, 0.02] },
    { text: `${elapsed} 0`, box: [0.025, 0.818, 0.098, 0.013] },
    { text: length, box: [0.915, 0.82, 0.057, 0.012] },
  ];

  it('takes a later shot of it, and checks its elapsed time there', () => {
    expect(playing).toMatchObject({ later: 10, laterFile: 'ios/bible-audio-playing-default-later.png' });
    expect(playing.mustAdvance).toBeDefined();
  });

  it('passes an elapsed time that moved on by at least half the time between the shots', () => {
    expect(checkAdvance(playing, dock('0:04'), dock('0:14'))).toEqual([]);
    expect(checkAdvance(playing, dock('0:58'), dock('1:03'))).toEqual([]);
  });

  it('fails one that stood still or barely moved, reading the elapsed time, not the clock or length', () => {
    expect(checkAdvance(playing, dock('0:04'), dock('0:04', '1:20'))).toEqual([
      'the time shown went from 0:04 to 0:04 in 10 seconds, not on by at least 5',
    ]);
    expect(checkAdvance(playing, dock('0:04'), dock('0:07'))).toHaveLength(1);
  });

  it('fails when the later shot or its time is missing', () => {
    expect(checkAdvance(playing, dock('0:04'), undefined)).toEqual(['no later screenshot']);
    const noTime = [{ text: 'Psalms v', box: [0.24, 0.865, 0.158, 0.015] }];
    expect(checkAdvance(playing, noTime, dock('0:14'))[0]).toMatch(/in the screenshot$/);
    expect(checkAdvance(playing, dock('0:04'), noTime)[0]).toMatch(/in the later screenshot$/);
  });

  it('leaves other shots alone', () => {
    expect(checkAdvance(shot('bible-default'), dock('0:00'), undefined)).toEqual([]);
  });
});

describe('tab labels in any case (#589)', () => {
  const { showsLabel } = require('../scripts/check-screens.cjs');
  const line = (text: string) => ({ text, box: [0.35, 0.955, 0.05, 0.02] });
  const tabs = [0.91, 0.99];

  it("finds a Latin label Vision read with the wrong case, as the iPad's capsule's \"Inicio\" as \"InIcIo\"", () => {
    expect(showsLabel([line('InIcIo')], 'Inicio', tabs)).toBe(true);
    expect(showsLabel([line('HOME')], 'Home', tabs)).toBe(true);
  });

  it('still fails a label cut short, or one inside a longer word', () => {
    expect(showsLabel([line('Inici')], 'Inicio', tabs)).toBe(false);
    expect(showsLabel([line('Verses')], 'Verse', tabs)).toBe(false);
  });
});

describe("the Chinese mission video card, this week's or the last one found (#726)", () => {
  const androidShots = planChecks(loadConfig(), 'android');
  const iphone = shot('sabbath-school-zh');
  const android = androidShots.find((candidate: { name: string }) => candidate.name === 'sabbath-school-zh');
  const at = (text: string, box: number[]): Line => ({ text, box });
  // The lines the checks look at, as Vision (the iPhone) and RapidOCR (the
  // Android phone) read them on real shots: the lesson card's title, the
  // mission video card, and the tab bar.
  const iphoneTabs = [
    at('首頁', [0.136, 0.959, 0.047, 0.012]),
    at('聖經', [0.363, 0.959, 0.047, 0.012]),
    at('探索', [0.587, 0.959, 0.05, 0.012]),
    at('您', [0.823, 0.959, 0.028, 0.012]),
  ];
  const androidTabs = [
    at('首頁', [0.132, 0.936, 0.071, 0.021]),
    at('聖經', [0.353, 0.936, 0.072, 0.021]),
    at('探索', [0.576, 0.936, 0.072, 0.021]),
    at('您', [0.817, 0.937, 0.04, 0.019]),
  ];
  // Monday 2026-11-09, before CHTV posted the 14th's video: the fork's iOS run
  // 42690519431 and Android run 42651426472, which the old check,
  // /^\d{1,2}月\d{1,2}日安息日/, failed. The note wraps at a different place
  // on each phone, and Vision read its last 上 as 〉.
  const lastWeekIphone = [
    at('本週', [0.192, 0.49, 0.082, 0.02]),
    at('11月7日聖工剪影', [0.192, 0.587, 0.309, 0.02]),
    at('不安歇的心（普通話）。本週的影片出來後會換〉', [0.192, 0.612, 0.704, 0.023]),
    at('上。', [0.192, 0.637, 0.05, 0.017]),
    ...iphoneTabs,
  ];
  const lastWeekAndroid = [
    at('本週', [0.212, 0.561, 0.113, 0.029]),
    at('11月7日聖工剪影', [0.218, 0.671, 0.372, 0.024]),
    at('不安歇的心（普通話)。本週的影片出', [0.218, 0.701, 0.626, 0.022]),
    at('來後會換上。', [0.217, 0.724, 0.212, 0.022]),
    ...androidTabs,
  ];
  // This week's, as the English page when the feed gave no video: the iPhone
  // on 2026-11-08 (run 42532995249), the Android phone on 2026-11-06 (run
  // 42146492850).
  const thisWeekIphone = [
    at('本週', [0.192, 0.49, 0.082, 0.02]),
    at('本週聖工剪影', [0.192, 0.587, 0.246, 0.02]),
    at('11月14日安息日的 Mission Spotlight（英文）', [0.192, 0.615, 0.621, 0.016]),
    ...iphoneTabs,
  ];
  const thisWeekAndroid = [
    at('本週', [0.212, 0.561, 0.113, 0.029]),
    at('本週聖工剪影', [0.218, 0.671, 0.293, 0.025]),
    at('11月7日安息日的 Mission Spotlight', [0.215, 0.7, 0.604, 0.023]),
    at('(英文)', [0.236, 0.722, 0.121, 0.026]),
    ...androidTabs,
  ];
  const titleRule = 'no line matches /^(本週|\\d{1,2}月\\d{1,2}日)聖工剪影$/';
  const dateRule = 'no line matches /^\\d{1,2}月\\d{1,2}日(安息日|聖工剪影$)/';

  it('passes the last video found, with its note, on both phones', () => {
    expect(checkShot(iphone, lastWeekIphone)).toEqual([]);
    expect(checkShot(android, lastWeekAndroid)).toEqual([]);
  });

  it("passes this week's English page on both phones", () => {
    expect(checkShot(iphone, thisWeekIphone)).toEqual([]);
    expect(checkShot(android, thisWeekAndroid)).toEqual([]);
  });

  it("passes the card as the app writes it, for this week's Mandarin video or an older one", () => {
    const card = (sabbath: string) =>
      describeChineseMissionSpotlight({ sabbath, id: 'aaaaaaaaaaa', story: '山上的學校' }, new Date(2026, 10, 14), 'zh');
    expect(card('2026-11-14').title).toBe('本週聖工剪影');
    expect(card('2026-11-07').title).toBe('11月7日聖工剪影');
    for (const { title, description } of [card('2026-11-14'), card('2026-11-07')]) {
      const lines = [at('本週', [0.192, 0.49, 0.082, 0.02]), line(title, 0.587), line(description, 0.612), ...iphoneTabs];
      expect(checkShot(iphone, lines)).toEqual([]);
    }
  });

  it('fails a date not written out in Chinese, or another screen', () => {
    const replaced = (lines: Line[], from: string, to: string) =>
      lines.map((each) => ({ ...each, text: each.text.replace(from, to) }));
    // formatAppDate's date in English, as Hermes once showed it on Android.
    expect(checkShot(iphone, replaced(lastWeekIphone, '11月7日', 'November 7'))).toEqual([titleRule, dateRule]);
    expect(checkShot(android, replaced(lastWeekAndroid, '11月7日', 'November 7'))).toEqual([titleRule, dateRule]);
    expect(checkShot(iphone, replaced(thisWeekIphone, '11月14日', 'November 14'))).toEqual([dateRule]);
    // A date that leads neither 安息日 nor the title doesn't count.
    expect(checkShot(iphone, replaced(thisWeekIphone, '安息日的', '的'))).toEqual([dateRule]);
    // The Library in Chinese, a real shot of another screen.
    expect(checkShot(iphone, samples.clean['library-zh'])).toEqual(['no line matches /^本週$/', titleRule, dateRule]);
  });
});

describe("the lesson open in Quick Look, its title read with the iPad's dropdown arrow (#736)", () => {
  const iphone = shot('sabbath-school-lesson-viewer-default');
  const ipadShots = planChecks(loadConfig(), 'ipad');
  const ipad = ipadShots.find((candidate: { name: string }) => candidate.name === 'sabbath-school-lesson-viewer-landscape');
  const at = (text: string, box: number[]): Line => ({ text, box });
  // The lines the check looks at, as Vision read them: the title Quick Look
  // shows and the top of the PDF's first page under it. On release PR #731's
  // run 42759990060, the iPad read the title's dropdown arrow into its line as
  // " v", and the old check, /^Beginner \(ages 1.3\)$/, failed it. On the
  // fork's run 42690519431 the day before, it left the arrow out. The iPhone
  // shows no arrow.
  const pageIpad = [
    at('BIG IDEA: I can help others.', [0.313, 0.229, 0.376, 0.043]),
    at('Others', [0.298, 0.583, 0.473, 0.154]),
  ];
  const pageIphone = [
    at('BIG IDEA: I can help others.', [0.312, 0.172, 0.375, 0.015]),
    at('Others', [0.29, 0.29, 0.49, 0.059]),
  ];
  const withArrow = at('Beginner (ages 1-3) v', [0.007, 0.045, 0.132, 0.017]);
  const withoutArrow = at('Beginner (ages 1-3)', [0.006, 0.045, 0.118, 0.019]);
  const iphoneTitle = at('Beginner (ages 1-3)', [0.287, 0.081, 0.366, 0.019]);
  const titleRule = 'no line matches /^Beginner \\(ages 1.3\\)(\\s*[vV⌄˅∨﹀])?$|aliveinjesus\\.info/';
  const retitled = (text: string) => ({ ...withArrow, text });

  it('passes the title with or without the arrow read into its line', () => {
    expect(checkShot(ipad, [withArrow, ...pageIpad])).toEqual([]);
    expect(checkShot(ipad, [withoutArrow, ...pageIpad])).toEqual([]);
    expect(checkShot(iphone, [iphoneTitle, ...pageIphone])).toEqual([]);
  });

  it('fails a missing title, another lesson, or more text after the title', () => {
    expect(checkShot(ipad, pageIpad)).toEqual([titleRule]);
    expect(checkShot(iphone, pageIphone)).toEqual([titleRule]);
    expect(checkShot(ipad, [retitled('Kindergarten (ages 4-6) v'), ...pageIpad])).toEqual([titleRule]);
    expect(checkShot(ipad, [retitled('Beginner (ages 1-3) vv'), ...pageIpad])).toEqual([titleRule]);
    expect(checkShot(ipad, [retitled('Beginner (ages 1-3) Students'), ...pageIpad])).toEqual([titleRule]);
  });
});
