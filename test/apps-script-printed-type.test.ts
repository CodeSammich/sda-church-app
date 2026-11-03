import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

// The printed bulletin's type rules (#603): every visible character at 10
// points or more, English in the Latin font, and each Chinese run in one
// Chinese font. These render whole layouts into a recording fake of Google
// Docs and check every character.

type Style = { size: number; font: string; bold: boolean; italic: boolean; underline: boolean };

const DEFAULT_STYLE: Style = { size: 11, font: 'Arial', bold: false, italic: false, underline: false };

class FakeParagraph {
  text = '';
  chars: Style[] = [];
  base: Style = { ...DEFAULT_STYLE };
  lineSpacing = 1.15;
  constructor(text: string, public parent: FakeContainer | null) {
    this.setText(text);
  }
  getType() { return 'PARAGRAPH'; }
  asParagraph() { return this; }
  getParent() { return this.parent; }
  getText() { return this.text; }
  setText(text: string) {
    this.text = String(text);
    this.chars = Array.from({ length: this.text.length }, () => ({ ...this.base }));
    return this;
  }
  setAlignment() { return this; }
  setLineSpacing(value: number) { this.lineSpacing = value; return this; }
  setSpacingBefore() { return this; }
  setSpacingAfter() { return this; }
  setAttributes(attributes: Record<string, number>) {
    if ('FONT_SIZE' in attributes) {
      this.base.size = attributes.FONT_SIZE;
      this.chars.forEach((style) => (style.size = attributes.FONT_SIZE));
    }
    return this;
  }
  editAsText() { return new FakeText(this); }
  appendPageBreak() { return { getParent: () => this }; }
  appendInlineImage() { return fakeImage(this); }
  removeFromParent() {
    if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
  }
}

class FakeText {
  constructor(private paragraph: FakeParagraph) {}
  getText() { return this.paragraph.text; }
  private apply(args: unknown[], key: keyof Style) {
    const paragraph = this.paragraph;
    if (args.length === 1) {
      (paragraph.base as Record<string, unknown>)[key] = args[0];
      paragraph.chars.forEach((style) => ((style as Record<string, unknown>)[key] = args[0]));
      return this;
    }
    const [start, end, value] = args as [number, number, unknown];
    if (!(start >= 0 && end >= start && end < paragraph.text.length)) {
      throw new Error(`range ${start}-${end} is outside "${paragraph.text}"`);
    }
    for (let index = start; index <= end; index += 1) {
      (paragraph.chars[index] as Record<string, unknown>)[key] = value;
    }
    return this;
  }
  setFontSize(...args: unknown[]) { return this.apply(args, 'size'); }
  setBold(...args: unknown[]) { return this.apply(args, 'bold'); }
  setItalic(...args: unknown[]) { return this.apply(args, 'italic'); }
  setUnderline(...args: unknown[]) { return this.apply(args, 'underline'); }
  setFontFamily(...args: unknown[]) { return this.apply(args, 'font'); }
}

function fakeImage(paragraph: FakeParagraph) {
  let width = 368;
  let height = 368;
  const image = {
    getWidth: () => width,
    getHeight: () => height,
    setWidth: (value: number) => { width = value; return image; },
    setHeight: (value: number) => { height = value; return image; },
    getParent: () => paragraph,
  };
  return image;
}

class FakeContainer {
  children: Array<FakeParagraph | FakeTable> = [];
  getNumChildren() { return this.children.length; }
  getChild(index: number) { return this.children[index]; }
  clear() { this.children = [new FakeParagraph('', this)]; return this; }
  appendParagraph(text: string) {
    const paragraph = new FakeParagraph(text, this);
    this.children.push(paragraph);
    return paragraph;
  }
  appendTable(rows: string[][]) {
    const table = new FakeTable(rows);
    this.children.push(table);
    return table;
  }
  appendHorizontalRule() {
    const paragraph = this.appendParagraph('');
    return { getParent: () => paragraph };
  }
  appendImage() { return fakeImage(this.appendParagraph('')); }
  appendPageBreak() { return this.appendParagraph('').appendPageBreak(); }
  setPaddingTop() { return this; }
  setPaddingBottom() { return this; }
  setPaddingLeft() { return this; }
  setPaddingRight() { return this; }
  setVerticalAlignment() { return this; }
  setPageWidth() { return this; }
  setPageHeight() { return this; }
  setMarginTop() { return this; }
  setMarginBottom() { return this; }
  setMarginLeft() { return this; }
  setMarginRight() { return this; }
}

class FakeCell extends FakeContainer {
  constructor(text: string) {
    super();
    this.children = [new FakeParagraph(text, this)];
  }
  getType() { return 'TABLE_CELL'; }
}

class FakeTable {
  rows: FakeCell[][];
  constructor(rows: string[][]) {
    this.rows = rows.map((row) => row.map((text) => new FakeCell(text)));
  }
  getType() { return 'TABLE'; }
  setBorderWidth() { return this; }
  setBorderColor() { return this; }
  setColumnWidth() { return this; }
  getCell(row: number, column: number) { return this.rows[row][column]; }
  getRow(row: number) { return { getCell: (column: number) => this.rows[row][column] }; }
}

function paragraphsOf(container: FakeContainer): FakeParagraph[] {
  return container.children.flatMap((child) =>
    child instanceof FakeTable
      ? child.rows.flatMap((row) => row.flatMap((cell) => paragraphsOf(cell)))
      : [child],
  );
}

const CJK = /[⺀-⿟　-〿㐀-鿿豈-﫿︰-﹏﻿＀-￯\ud800-\udfff]/;

const loadPrintedBulletin = (properties: Record<string, string> = {}) => {
  const context = createContext({
    DocumentApp: {
      ElementType: { PARAGRAPH: 'PARAGRAPH', TABLE: 'TABLE', TABLE_CELL: 'TABLE_CELL' },
      HorizontalAlignment: { LEFT: 'LEFT', CENTER: 'CENTER', RIGHT: 'RIGHT' },
      VerticalAlignment: { TOP: 'TOP' },
      Attribute: {
        FONT_SIZE: 'FONT_SIZE',
        LINE_SPACING: 'LINE_SPACING',
        SPACING_BEFORE: 'SPACING_BEFORE',
        SPACING_AFTER: 'SPACING_AFTER',
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (name: string) => properties[name] || null }),
    },
    // The English Sabbath Encouragement comes from the cache, so no
    // translation runs.
    CacheService: {
      getScriptCache: () => ({
        get: (key: string) =>
          key.startsWith('sabbath-encouragement-en') ? 'The Sabbath is a day of rest.' : null,
        put: () => undefined,
      }),
    },
    DriveApp: {
      getFileById: () => ({ getBlob: () => ({}), isTrashed: () => false }),
      getFolderById: () => ({
        getFilesByName: () => {
          let found = false;
          return {
            hasNext: () => !found,
            next: () => {
              found = true;
              return { isTrashed: () => false, getId: () => 'qr-file' };
            },
          };
        },
      }),
    },
    Logger: { log: () => undefined },
  });
  runInContext(
    [
      'BulletinApi.gs',
      'SabbathEncouragement.gs',
      'PrintedBulletin.gs',
      'PrintedHymnLookup.gs',
      'PrintedCommunionBulletin.gs',
      'PrintedQueensBulletin.gs',
      'PrintedBrooklynBulletin.gs',
    ]
      .map((file) => readFileSync(join(process.cwd(), 'google-apps-script', file), 'utf8'))
      .join('\n'),
    context,
  );
  return context;
};

// Made-up people and a long week. 张美玲 is typed in Simplified, as some
// schedule entries are.
const person = (chinese: string, english: string) => `${chinese}\n${english}`;
const location = () => ({
  ssChair: person('王明德', 'Mingde Wang'),
  ssOpeningPrayer: person('陳美玲', 'Meiling Chen'),
  sabbathSchoolHymns: ['SDAH 100', 'SDAH 206'],
  closingPrayer: person('李國華', 'Guohua Li'),
  chairPastoralPrayer: person('張志強', 'Zhiqiang Zhang'),
  hymnOfPraise: { english: 'SDAH 100', chinese: '' },
  bibleVerses: 'Isaiah 53:5',
  bibleVerseText: {
    chinese: '他為我們的過犯受害，為我們的罪孽壓傷。',
    english: 'But He was pierced for our transgressions, He was crushed for our iniquities.',
  },
  offeringPrayer: person('劉曉紅', 'Xiaohong Liu'),
  specialMusicTitle: '我心堅定於你\nMy Heart Is Steadfast',
  specialMusic: person('张美玲', 'Meiling Zhang'),
  sermonTitle: { english: 'Watchmen on the Walls', chinese: '城牆上的守望者' },
  sermon: '林志遠牧師\nPastor Zhiyuan Lin',
  hymnOfResponse: { english: 'SDAH 336', chinese: '' },
  pianist: person('周雅琴', 'Yaqin Zhou'),
  englishTeacher: person('吳建平', 'Jianping Wu'),
  chineseTeacher: person('鄭麗華', 'Lihua Zheng'),
  translation: person('黃子豪', 'Zihao Huang'),
  flowerOffering: person('許家欣', 'Jiaxin Xu'),
  chair: person('王明德', 'Mingde Wang'),
  technician: person('馬志明', 'Zhiming Ma'),
  encouragement: person('陳美玲', 'Meiling Chen'),
  sabbathMessageTitle: '安息日的祝福\nThe Blessing of the Sabbath',
  sabbathSchool: person('李國華', 'Guohua Li'),
  sunsetTime: '4:28 PM',
});
const bulletin = (overrides: Record<string, unknown> = {}) => ({
  date: '2026-11-14',
  queens: location(),
  brooklyn: location(),
  tithePurpose: '基督復臨安息日會社區服務\nAdventist Community Services',
  sunsetTime: '4:28 PM',
  sabbathSchoolLesson: { english: 'Lesson 7: The Faith of Abraham', chinese: '第七課：亞伯拉罕的信心' },
  hasPrintedAnnouncements: true,
  printedAnnouncements: [
    {
      scope: 'all',
      chinese: '本教會將於十二月二十日舉行聖誕慶祝聚會，歡迎大家參加。',
      english: 'Our church will hold a Christmas celebration on December 20. Everyone is welcome.',
    },
  ],
  communionPastor: '林志遠牧師\nPastor Zhiyuan Lin',
  physicalCommunionPassageText: { chinese: '這是我的身體，為你們捨的。', english: 'This is My body, which is for you.' },
  physicalFootWashingPassageText: {
    chineseVerses: ['耶穌知道自己離世歸父的時候到了。'],
    englishVerses: ['Jesus knew that His hour had come.'],
  },
  ...overrides,
});
// Without this Sabbath's schedule every roster entry prints as TBD (#580).
const noSchedule = () => ({
  ...bulletin(),
  queens: { sunsetTime: '4:28 PM' },
  brooklyn: { sunsetTime: '4:28 PM' },
});

const render = (
  data: Record<string, unknown>,
  format: string,
  place: string,
  properties: Record<string, string> = {},
) => {
  const context = loadPrintedBulletin(properties);
  const body = new FakeContainer();
  Object.assign(context, { testBody: body, testBulletin: data, testNext: bulletin() });
  runInContext(
    `renderPrintedBulletinDocument_({ getBody: function () { return testBody; } }, testBulletin, testNext, '${format}', '${place}')`,
    context,
  );
  return { context, paragraphs: paragraphsOf(body) };
};

const LAYOUTS: Array<[string, () => Record<string, unknown>, string, string]> = [
  ['Queens regular', bulletin, 'regular', 'queens'],
  ['Queens Communion', bulletin, 'communion', 'queens'],
  ['Brooklyn regular, with the Sabbath Encouragement', bulletin, 'regular', 'brooklyn'],
  ['Queens regular without a schedule', noSchedule, 'regular', 'queens'],
  ['Brooklyn regular without a schedule', noSchedule, 'regular', 'brooklyn'],
];

describe('printed bulletin type (#603)', () => {
  it.each(LAYOUTS)('prints no visible text under 10 points: %s', (_name, data, format, place) => {
    const { paragraphs } = render(data(), format, place);
    const small = paragraphs.flatMap((paragraph) =>
      Array.from(paragraph.text)
        .map((character, index) => ({ character, size: paragraph.chars[index].size }))
        .filter(({ character, size }) => /\S/.test(character) && size < 10)
        .map(({ character, size }) => `${character} at ${size}pt in "${paragraph.text}"`),
    );

    expect(small).toEqual([]);
    expect(paragraphs.some((paragraph) => /THE CHURCH AT|SABBATH ENCOURAGEMENT|Announcements/.test(paragraph.text))).toBe(true);
  });

  it.each(LAYOUTS)('sets English in Times New Roman and each Chinese run in one Chinese font: %s', (_name, data, format, place) => {
    const { paragraphs } = render(data(), format, place);
    const wrong: string[] = [];
    paragraphs.forEach((paragraph) => {
      Array.from(paragraph.text).forEach((character, index) => {
        const font = paragraph.chars[index].font;
        const expected = CJK.test(character) ? ['UoqMunThenKhung', 'Noto Sans SC'] : ['Times New Roman'];
        if (/\S/.test(character) && !expected.includes(font)) {
          wrong.push(`${character} in ${font} in "${paragraph.text}"`);
        }
      });
    });

    expect(wrong).toEqual([]);
  });

  it('splits a mixed line into Latin and Chinese runs', () => {
    const { paragraphs } = render(bulletin(), 'regular', 'queens');
    const line = paragraphs.find((paragraph) => paragraph.text.includes('第497首 讚美上帝'));
    expect(line).toBeDefined();
    const text = line!.text;
    const fontAt = (needle: string) => line!.chars[text.indexOf(needle)].font;

    expect(fontAt('第')).toBe('UoqMunThenKhung');
    expect(fontAt('497')).toBe('Times New Roman');
    expect(fontAt('首')).toBe('UoqMunThenKhung');
    expect(fontAt(' 讚')).toBe('Times New Roman');
    expect(fontAt('讚美上帝')).toBe('UoqMunThenKhung');
  });

  it('prints only the characters the font lacks in the fallback font', () => {
    const { paragraphs } = render(bulletin(), 'regular', 'queens');
    const fontsOf = (name: string) => {
      const paragraph = paragraphs.find((candidate) => candidate.text.includes(name))!;
      const start = paragraph.text.indexOf(name);
      return paragraph.chars.slice(start, start + name.length).map((style) => style.font);
    };

    // 张 is Simplified and not in UoqMunThenKhung; the rest of the name is.
    expect(fontsOf('张美玲')).toEqual(['Noto Sans SC', 'UoqMunThenKhung', 'UoqMunThenKhung']);
    expect(fontsOf('陳美玲')).toEqual(['UoqMunThenKhung', 'UoqMunThenKhung', 'UoqMunThenKhung']);
  });

  it('takes the fonts from the Script Properties, without a deploy', () => {
    const { paragraphs } = render(bulletin(), 'regular', 'queens', {
      PRINTED_BULLETIN_LATIN_FONT: 'Georgia',
      PRINTED_BULLETIN_CJK_FONT: ' Noto Sans TC ',
    });
    const fonts = new Set(
      paragraphs.flatMap((paragraph) =>
        Array.from(paragraph.text)
          .map((character, index) => ({ character, font: paragraph.chars[index].font }))
          .filter(({ character }) => /\S/.test(character))
          .map(({ character, font }) => `${CJK.test(character) ? 'cjk' : 'latin'}:${font}`),
      ),
    );

    // Coverage is only known for the default Chinese font, so a font set here
    // is used for every Chinese run.
    expect(fonts).toEqual(new Set(['latin:Georgia', 'cjk:Noto Sans TC']));
  });

  it('keeps the Chinese and English panel titles close together', () => {
    const { paragraphs } = render(bulletin(), 'regular', 'queens');
    const titles = paragraphs.filter((paragraph) => ['崇拜聚會', 'THE CHURCH AT WORSHIP'].includes(paragraph.text));

    expect(titles.map((paragraph) => [paragraph.chars[0].size, paragraph.lineSpacing])).toEqual([
      [13, 1],
      [13, 1],
    ]);
  });
});

describe('the printed Sabbath Encouragement in Traditional Chinese (#565, #603)', () => {
  const context = loadPrintedBulletin();
  const pages = JSON.parse(
    runInContext(
      'JSON.stringify(SABBATH_ENCOURAGEMENT_PAGES.map(function (page) { return toPrintedTraditionalChinese_(normalizeSabbathEncouragementText_(page)); }))',
      context,
    ) as string,
  ) as string[];
  const simplified = runInContext('SABBATH_ENCOURAGEMENT_SIMPLIFIED_', context) as string;

  it('leaves no Simplified character from the snapshot on any of the 52 pages', () => {
    // 干 is also Traditional, as in 干犯 (to violate).
    const simplifiedOnly = Array.from(simplified).filter((character) => character !== '干');
    const found = pages.flatMap((page, index) =>
      simplifiedOnly.filter((character) => page.includes(character)).map((character) => `page ${index + 1}: ${character}`),
    );

    expect(pages).toHaveLength(52);
    expect(found).toEqual([]);
  });

  it('converts the words whose Traditional form depends on context', () => {
    const all = pages.join('\n');

    for (const word of ['關係', '聯繫', '牢繫', '干犯', '枯乾', '藉著', '讚美', '兩隻手', '大鬥爭', '並為', '貴價', '致力', '獸像']) {
      expect(all).toContain(word);
    }
    for (const word of ['關系', '幹犯', '大斗爭', '併為', '貴价', '緻力', '獸象']) {
      expect(all).not.toContain(word);
    }
  });

  it('prints the Chinese column in Traditional while the English still reads the snapshot', () => {
    const { paragraphs } = render(bulletin(), 'regular', 'brooklyn');
    const text = paragraphs.map((paragraph) => paragraph.text).join('\n');

    expect(runInContext(`getSabbathEncouragementPageText_('2026-11-14')`, context)).toContain('时');
    expect(text).toContain('安息日勉勵');
    expect(text).not.toMatch(/[们这说时为来]/);
  });
});
