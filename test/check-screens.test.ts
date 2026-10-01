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

  it("checks the Bible header's translation button: in full, or without its icon when tight (#376)", () => {
    // The real text of a good shot: "XA EN", "BSB +", "* CUV v" (XA is the 文A icon).
    const dual = samples.clean['bible-dual-default'] as Line[];
    expect(checkShot(shot('bible-dual-default'), dual)).toEqual([]);
    const withoutHeader = dual.filter((each) => each.box[1] > 0.12);
    expect(checkShot(shot('bible-dual-default'), withoutHeader)).toEqual([
      'no line matches /^XA\\b/',
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
      '"XA EN B... +* C..." matches /\\bXA\\b/, which must not show',
    ]);
    // At the default size the icon must still show.
    expect(checkShot(shot('bible-dual-back-default'), iconFirst)).toEqual(['no line matches /^XA\\b/']);
  });

  it('catches tab labels that wrap, or rise out of an overgrown tab bar, at about 4× text (#380)', () => {
    const tabs = (labels: string[], y: number) => labels.map((label) => line(label, y));
    expect(checkShot(shot('explore-xl-ios-large-text'), tabs(['Home', 'Bible', 'Explore', 'You'], 0.944))).toEqual([]);
    // "Explore" wrapped onto two lines, as on Android before #380.
    expect(
      checkShot(shot('explore-xl-ios-large-text'), [...tabs(['Home', 'Bible', 'Explor', 'You'], 0.93), line('e', 0.96)]),
    ).toEqual(['tab labels missing: Explore']);
    // An overgrown tab bar: the labels sit above the tab bar's area.
    expect(checkShot(shot('home-es-xl-ios-large-text'), tabs(['Inicio', 'Biblia', 'Explorar', 'Tú'], 0.86))).toEqual([
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

  it('reads each shot in its language', () => {
    const { OCR_LANGUAGES } = require('../scripts/check-screens.cjs');
    for (const each of shots) expect(OCR_LANGUAGES[each.settings.language]).toBeDefined();
  });
});
