const {
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

  it('catch a Close or Apply button coming back', () => {
    expect(checkShot(shot('bible-verse-popup-default'), [...verse, line('Close', 0.8)])).toEqual([
      '"Close" matches /^Close$/, which must not show',
    ]);
    expect(checkShot(shot('text-size-xl'), [...textSize, line('Apply', 0.9)])).toEqual([
      '"Apply" matches /^Apply$/, which must not show',
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
    expect(checkShot(shot('explore-zh'), englishTabs)).toEqual(['tab labels missing: 首頁, 聖經, 探索']);
  });

  it('catches the setup dialog and unfilled values', () => {
    const problems = checkShot(shot('home-default'), [
      ...(samples.clean['home-default'] as Line[]),
      line('Get Started', 0.8),
      line('Sabbath starts in undefined', 0.3),
    ]);
    expect(problems).toEqual(['shows "Get Started"', 'shows "undefined"']);
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
    expect(checkShot(shot('bible-pinyin-zh'), [line('首頁', 0.944), line('聖經', 0.944), line('探索', 0.944)])).toEqual([]);
  });
});

describe('screen rules', () => {
  it('uses each screen’s own rules, even when names share a start', () => {
    // "bible-dual-default" starts with "bible-", but belongs to bible-dual.
    expect(shot('bible-scrolled-default').tabs).toBe(false);
    expect(shot('bible-scrolled-default').mustShowLines).toEqual(['^14\\b', '^15\\b', '^John\\b', '^16\\b']);
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

  it("checks the Bible header's translation button: in full, or without its icon when tight (#376)", () => {
    // The real text of a good shot: "XA EN", "BSB +", "* CUV v" (XA is the 文A icon).
    const dual = samples.clean['bible-dual-default'] as Line[];
    expect(checkShot(shot('bible-dual-default'), dual)).toEqual([]);
    const withoutHeader = dual.filter((each) => each.box[1] > 0.12);
    expect(checkShot(shot('bible-dual-default'), withoutHeader)).toEqual([
      'no line matches /^(XA|文A)\\b/',
      'no line matches /\\bEN\\b/',
      'no line matches /BSB/',
      'no line matches /CUV/',
    ]);

    // With a back arrow at 200%: the icon gives way first, so the names stay whole.
    const body = withoutHeader;
    const iconFirst = [...body, line('EN BSB + * CUV v', 0.05)];
    expect(checkShot(shot('bible-dual-back-xl'), iconFirst)).toEqual([]);
    // What the 0.43.0 preview showed before: the icon kept, the names cut short.
    const namesCut = [...body, line('XA EN B... +* C...', 0.05)];
    expect(checkShot(shot('bible-dual-back-xl'), namesCut)).toEqual([
      'no line matches /BSB/',
      'no line matches /CUV/',
      '"XA EN B... +* C..." matches /(\\bXA|文A)\\b/, which must not show',
    ]);
    // At the default size the icon must still show.
    expect(checkShot(shot('bible-dual-back-default'), iconFirst)).toEqual(['no line matches /^(XA|文A)\\b/']);
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
      'tab labels missing: Inicio, Biblia, Explorar, Tú',
    ]);
  });

  it("catches the previous Bible's book names after a link opens the CUV (#373)", () => {
    const tabs = ['Home', 'Bible', 'Explore', 'You'].map((label) => line(label, 0.944));
    const after = shot('bible-cuv-after-spanish-default');
    // What the release run read: Vision, reading English first, misses 詩篇.
    expect(checkShot(after, [...tabs, line('23 v', 0.86), line('Verse v', 0.86)])).toEqual([]);
    expect(checkShot(after, [...tabs, line('Salmos v', 0.86), line('Verse v', 0.86)])).toEqual([
      '"Salmos v" matches /Salmos/, which must not show',
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
      mustShowLines: ['^14\\b', '^15\\b', '^John\\b', '^16\\b'],
    });
    expect(androidShot('home-xl-android-font-max').mustShowLines).toEqual(['^Today.s Verse$']);
  });

  it("look for the tab bar where the emulator's shorter screen puts it", () => {
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

  it("skip a line the emulator's shorter screen leaves below the fold, and keep it on the iPhone", () => {
    expect(checkShot(androidShot('sabbath-school-default'), tabs)).toEqual([]);
    expect(checkShot(shot('sabbath-school-default'), tabs.map((each) => ({ ...each, box: [0.1, 0.944, 0.3, 0.02] })))).toEqual([
      'no line matches /^Beginner \\(ages 1-3\\)/',
    ]);
  });

  it('accept the 文A icon as either reader reads it', () => {
    const header = (icon: string) => [line(`${icon} EN BSB + 繁 CUV`, 0.05), line('Psalms', 0.86), line('Verse', 0.86)];
    expect(checkShot(androidShot('bible-dual-default'), [...tabs, ...header('文A')])).toEqual([]);
    expect(checkShot(androidShot('bible-dual-back-large'), [...tabs, ...header('文A')])).toEqual([
      '"文A EN BSB + 繁 CUV" matches /(\\bXA|文A)\\b/, which must not show',
    ]);
  });
});
