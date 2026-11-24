import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

// The week's announcement (#562): typed in Weekly Data's Announcements cell,
// one, in any language, and sent to the app and the printed bulletin in each of
// the API's languages, machine-translated line by line.

type Announcement = { english: string; chinese: string; spanish: string };

const loadBulletinApi = (globals: Record<string, unknown> = {}) => {
  const context = createContext(globals);
  runInContext(readFileSync(join(process.cwd(), 'google-apps-script/BulletinApi.gs'), 'utf8'), context);
  return context;
};

const run = <T,>(context: object, code: string): T =>
  JSON.parse(runInContext(`JSON.stringify(${code})`, context) as string) as T;

// A translator that tags each line with its target, and records each request.
// Like Google's, it gives English back unchanged when asked for English.
const fakeTranslator = (options: { fail?: (target: string) => boolean; mergeLines?: boolean } = {}) => {
  const requests: { text: string; source: string; target: string }[] = [];
  return {
    requests,
    LanguageApp: {
      translate: (text: string, source: string, target: string) => {
        requests.push({ text, source, target });
        if (options.fail?.(target)) throw new Error('Service invoked too many times for one day: translate.');
        const lines = text
          .split('\n')
          .map((line) => (target === 'en' && /^[\x20-\x7e]*$/.test(line) ? line : `[${target}] ${line}`));
        return options.mergeLines ? lines.join(' ') : lines.join('\n');
      },
    },
  };
};

// A script cache like Apps Script's, and a digest that names its text.
const fakeCache = () => {
  const store = new Map<string, string>();
  return {
    store,
    CacheService: {
      getScriptCache: () => ({
        getAll: (keys: string[]) =>
          Object.fromEntries(keys.filter((key) => store.has(key)).map((key) => [key, store.get(key)])),
        putAll: (values: Record<string, string>) =>
          Object.entries(values).forEach(([key, value]) => store.set(key, value)),
      }),
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: (_algorithm: string, text: string) => [...Buffer.from(text, 'utf8')],
      base64EncodeWebSafe: (bytes: number[]) => Buffer.from(bytes).toString('base64url'),
    },
  };
};

const lines = (context: object, cell: string) =>
  run<string[]>(context, `splitBulletinAnnouncementLines_(${JSON.stringify(cell)})`);

// Each line of an announcement, in every language.
const translate = (context: object, typed: string[]) =>
  run<Announcement[]>(context, `translateBulletinAnnouncementLines_(${JSON.stringify(typed)})`);

// The announcement the API sends for a cell's lines.
const announce = (context: object, typed: string[]) =>
  run<Announcement[]>(context, `translateBulletinAnnouncements_(${JSON.stringify(typed)})`);

describe('Weekly Data announcements (#562)', () => {
  it('reads the cell as one announcement, kept as written, without blank lines or a TBD', () => {
    const context = loadBulletinApi();
    // A number typed in it stays: the cell holds one announcement.
    expect(lines(context, '1. Fellowship lunch after the service.\r\n\r\n  Everyone is welcome.  ')).toEqual([
      '1. Fellowship lunch after the service.',
      'Everyone is welcome.',
    ]);
    expect(lines(context, '')).toEqual([]);
    expect(lines(context, 'TBD\n ')).toEqual([]);
  });

  it('sends one announcement for the cell, its lines joined again in each language', () => {
    const { LanguageApp, requests } = fakeTranslator();
    const context = loadBulletinApi({ LanguageApp });
    expect(announce(context, ['Fellowship lunch after the service.', 'Everyone is welcome.'])).toEqual([
      {
        english: 'Fellowship lunch after the service.\nEveryone is welcome.',
        chinese: '[zh-TW] Fellowship lunch after the service.\n[zh-TW] Everyone is welcome.',
        spanish: '[es] Fellowship lunch after the service.\n[es] Everyone is welcome.',
      },
    ]);
    // One request per language for the whole announcement.
    expect(requests.map((request) => request.target)).toEqual(['en', 'zh-TW', 'es']);
    expect(announce(context, [])).toEqual([]);
  });

  it('sends a language only when every line has it, and the typed text when neither English nor Chinese came out whole', () => {
    const { LanguageApp } = fakeTranslator({ fail: (target) => target !== 'es' });
    const context = loadBulletinApi({ LanguageApp, Logger: { log: () => undefined } });
    // Typed half in English, half in Chinese, with the translator down for
    // both: the line in Chinese has no English, and the other no Chinese.
    expect(announce(context, ['Fellowship lunch.', '歡迎大家。'])).toEqual([
      {
        english: 'Fellowship lunch.\n歡迎大家。',
        chinese: '',
        spanish: '[es] Fellowship lunch.\n[es] 歡迎大家。',
      },
    ]);
  });

  it('counts a line as Chinese only when it has more Chinese characters than words in Latin letters', () => {
    const context = loadBulletinApi();
    const chinese = (line: string) => run<boolean>(context, `isChineseBulletinAnnouncement_(${JSON.stringify(line)})`);
    // An English line with a name in Chinese isn't, so it isn't printed on
    // the Chinese line as typed.
    expect(chinese("Please pray for 黃姊妹's family")).toBe(false);
    expect(chinese('11月28日感恩節愛筵 Thanksgiving potluck')).toBe(true);
    expect(chinese('AH 73 詩歌練習')).toBe(true);
    expect(chinese('下午两点诗班练习。')).toBe(true);
    expect(chinese('10:30')).toBe(false);
  });

  it('sends each line in every language, keeping one typed in Chinese, one request per language', () => {
    const { LanguageApp, requests } = fakeTranslator();
    const context = loadBulletinApi({ LanguageApp });
    expect(translate(context, ['Choir practice.', 'Youth hike.', '查經班。', '下午两点诗班练习。'])).toEqual([
      // Machine-made Chinese is Traditional, as the bulletin prints it.
      { english: 'Choir practice.', chinese: '[zh-TW] Choir practice.', spanish: '[es] Choir practice.' },
      { english: 'Youth hike.', chinese: '[zh-TW] Youth hike.', spanish: '[es] Youth hike.' },
      // Chinese stays as typed, in either script.
      { english: '[en] 查經班。', chinese: '查經班。', spanish: '[es] 查經班。' },
      { english: '[en] 下午两点诗班练习。', chinese: '下午两点诗班练习。', spanish: '[es] 下午两点诗班练习。' },
    ]);
    // The translator detects what each request is in, so the lines in Chinese
    // go apart from the rest.
    expect(requests).toEqual([
      { text: '查經班。\n下午两点诗班练习。', source: '', target: 'en' },
      { text: 'Choir practice.\nYouth hike.', source: '', target: 'en' },
      { text: 'Choir practice.\nYouth hike.', source: '', target: 'zh-TW' },
      { text: '查經班。\n下午两点诗班练习。', source: '', target: 'es' },
      { text: 'Choir practice.\nYouth hike.', source: '', target: 'es' },
    ]);
  });

  it('takes a line in any language, and a language is one more entry in the list', () => {
    const { LanguageApp } = fakeTranslator();
    const context = loadBulletinApi({ LanguageApp });
    runInContext(
      "BULLETIN_ANNOUNCEMENT_LANGUAGES = BULLETIN_ANNOUNCEMENT_LANGUAGES.concat([{ field: 'korean', code: 'ko' }])",
      context,
    );
    // Typed in Spanish: its English is the translator's.
    expect(translate(context, ['Almuerzo después del culto.'])).toEqual([
      {
        english: '[en] Almuerzo después del culto.',
        chinese: '[zh-TW] Almuerzo después del culto.',
        spanish: '[es] Almuerzo después del culto.',
        korean: '[ko] Almuerzo después del culto.',
      },
    ]);
  });

  it('asks line by line when one request runs the lines together', () => {
    const { LanguageApp, requests } = fakeTranslator({ mergeLines: true });
    const context = loadBulletinApi({ LanguageApp });
    const output = translate(context, ['One.', 'Two.']);
    expect(output.map((announcement) => announcement.spanish)).toEqual(['[es] One.', '[es] Two.']);
    expect(output.map((announcement) => announcement.chinese)).toEqual(['[zh-TW] One.', '[zh-TW] Two.']);
    expect(requests.filter((request) => request.target === 'es').map((request) => request.text)).toEqual([
      'One.\nTwo.',
      'One.',
      'Two.',
    ]);
  });

  it('leaves a language blank when its translation fails, and stops asking for it', () => {
    const logs: string[] = [];
    const { LanguageApp, requests } = fakeTranslator({ fail: (target) => target !== 'en' });
    const context = loadBulletinApi({ LanguageApp, Logger: { log: (message: string) => logs.push(message) } });
    expect(translate(context, ['One.', 'Two.', '三。'])).toEqual([
      { english: 'One.', chinese: '', spanish: '' },
      { english: 'Two.', chinese: '', spanish: '' },
      { english: '[en] 三。', chinese: '三。', spanish: '' },
    ]);
    // One failed request for each language and group, not one per line.
    expect(requests.map((request) => request.target)).toEqual(['en', 'en', 'zh-TW', 'es', 'es']);
    expect(logs[0]).toContain('Announcement translation to zh-TW failed');
  });

  it('sends a line as typed when its English fails, so English readers and the print still have it', () => {
    const { LanguageApp } = fakeTranslator({ fail: (target) => target === 'en' });
    const context = loadBulletinApi({ LanguageApp, Logger: { log: () => undefined } });
    expect(translate(context, ['Almuerzo después del culto.', '三。'])).toEqual([
      {
        english: 'Almuerzo después del culto.',
        chinese: '[zh-TW] Almuerzo después del culto.',
        spanish: '[es] Almuerzo después del culto.',
      },
      // The app shows a Chinese line's Chinese to English readers instead.
      { english: '', chinese: '三。', spanish: '[es] 三。' },
    ]);
  });

  it('remembers each translation, so the next reader costs no request', () => {
    const { LanguageApp, requests } = fakeTranslator();
    const cache = fakeCache();
    const context = loadBulletinApi({ LanguageApp, CacheService: cache.CacheService, Utilities: cache.Utilities });
    const first = translate(context, ['Fellowship lunch.']);
    expect(requests).toHaveLength(3);
    expect(translate(context, ['Fellowship lunch.'])).toEqual(first);
    expect(requests).toHaveLength(3);
    // A line added later is the only one asked for.
    translate(context, ['Fellowship lunch.', 'Choir practice.']);
    expect(requests.slice(3).map((request) => request.text)).toEqual(['Choir practice.', 'Choir practice.', 'Choir practice.']);
    // Each is kept under its languages and its text's digest.
    expect([...cache.store.keys()].map((key) => key.split(':').slice(0, 4).join(':')).sort()).toEqual([
      'translation:v1:auto:en',
      'translation:v1:auto:en',
      'translation:v1:auto:es',
      'translation:v1:auto:es',
      'translation:v1:auto:zh-TW',
      'translation:v1:auto:zh-TW',
    ]);
  });

  it('sends the typed text when there is no translator, as in a test', () => {
    const context = loadBulletinApi();
    expect(translate(context, ['Fellowship lunch.', '愛筵。'])).toEqual([
      { english: 'Fellowship lunch.', chinese: '', spanish: '' },
      { english: '', chinese: '愛筵。', spanish: '' },
    ]);
    expect(translate(context, [])).toEqual([]);
  });
});
