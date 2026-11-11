import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

// The week's announcements (#562): typed in Weekly Data's English
// Announcements and Chinese Announcements cells, one per line, and sent to the
// app and the printed bulletin in English, Chinese and Spanish, with a side
// staff left blank machine-translated.

type Announcement = { english: string; chinese: string; spanish: string };

const loadBulletinApi = (globals: Record<string, unknown> = {}) => {
  const context = createContext(globals);
  runInContext(readFileSync(join(process.cwd(), 'google-apps-script/BulletinApi.gs'), 'utf8'), context);
  return context;
};

const run = <T,>(context: object, code: string): T =>
  JSON.parse(runInContext(`JSON.stringify(${code})`, context) as string) as T;

// A translator that tags each line with its target, and records each request.
const fakeTranslator = (options: { fail?: (target: string) => boolean; mergeLines?: boolean } = {}) => {
  const requests: { text: string; source: string; target: string }[] = [];
  return {
    requests,
    LanguageApp: {
      translate: (text: string, source: string, target: string) => {
        requests.push({ text, source, target });
        if (options.fail?.(target)) throw new Error('Service invoked too many times for one day: translate.');
        const lines = text.split('\n').map((line) => `[${target}] ${line}`);
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

const pair = (context: object, english: string, chinese: string) =>
  run<Announcement[]>(
    context,
    `pairBulletinAnnouncementLines_(${JSON.stringify({ english, chinese })})`,
  );

const translate = (context: object, announcements: Partial<Announcement>[]) =>
  run<Announcement[]>(
    context,
    `translateBulletinAnnouncements_(${JSON.stringify(
      announcements.map((announcement) => ({ english: '', chinese: '', spanish: '', ...announcement })),
    )})`,
  );

describe('Weekly Data announcements (#562)', () => {
  it('pairs the two cells line by line, one announcement each', () => {
    const context = loadBulletinApi();
    expect(pair(context, 'Fellowship lunch after the service.\nChoir practice at 2 pm.', '崇拜後有愛筵。\n下午兩點詩班練習。')).toEqual([
      { english: 'Fellowship lunch after the service.', chinese: '崇拜後有愛筵。', spanish: '' },
      { english: 'Choir practice at 2 pm.', chinese: '下午兩點詩班練習。', spanish: '' },
    ]);
    // A side with fewer lines leaves the rest blank, for the translator.
    expect(pair(context, 'One\nTwo', '一')).toEqual([
      { english: 'One', chinese: '一', spanish: '' },
      { english: 'Two', chinese: '', spanish: '' },
    ]);
    expect(pair(context, '', '')).toEqual([]);
    expect(pair(context, 'TBD', ' ')).toEqual([]);
  });

  it('drops blank lines and the numbers or bullets staff type, but not a number in the text', () => {
    const context = loadBulletinApi();
    const lines = [
      '1. Fellowship lunch',
      '',
      '2) Choir practice',
      '  - Youth hike  ',
      '• Prayer meeting',
      '3.Bible study',
      '1.5 hours of cleanup on Sunday',
      '10:30 am: deacons meet',
      '2026 calendars are here',
      'tbd',
    ].join('\r\n');
    expect(pair(context, lines, '一、崇拜後有愛筵\n二、詩班練習\n3、查經').map((announcement) => [announcement.english, announcement.chinese])).toEqual([
      ['Fellowship lunch', '崇拜後有愛筵'],
      ['Choir practice', '詩班練習'],
      ['Youth hike', '查經'],
      ['Prayer meeting', ''],
      ['Bible study', ''],
      ['1.5 hours of cleanup on Sunday', ''],
      ['10:30 am: deacons meet', ''],
      ['2026 calendars are here', ''],
    ]);
  });

  it('translates only a blank side, and Spanish from what staff typed, one request per language', () => {
    const { LanguageApp, requests } = fakeTranslator();
    const context = loadBulletinApi({ LanguageApp });
    const output = translate(context, [
      { english: 'Fellowship lunch.', chinese: '崇拜後有愛筵。' },
      { english: 'Choir practice.' },
      { english: 'Youth hike.' },
      { chinese: '查經班。' },
    ]);
    expect(output).toEqual([
      // Both typed: only Spanish, from the English.
      { english: 'Fellowship lunch.', chinese: '崇拜後有愛筵。', spanish: '[es] Fellowship lunch.' },
      // Machine-made Chinese is Traditional, as the bulletin prints it.
      { english: 'Choir practice.', chinese: '[zh-TW] Choir practice.', spanish: '[es] Choir practice.' },
      { english: 'Youth hike.', chinese: '[zh-TW] Youth hike.', spanish: '[es] Youth hike.' },
      // Chinese only: English and Spanish both from the Chinese, whichever script it's in.
      { english: '[en] 查經班。', chinese: '查經班。', spanish: '[es] 查經班。' },
    ]);
    expect(requests).toEqual([
      { text: 'Fellowship lunch.\nChoir practice.\nYouth hike.', source: 'en', target: 'es' },
      { text: '查經班。', source: '', target: 'es' },
      { text: 'Choir practice.\nYouth hike.', source: 'en', target: 'zh-TW' },
      { text: '查經班。', source: '', target: 'en' },
    ]);
  });

  it('asks line by line when one request runs the lines together', () => {
    const { LanguageApp, requests } = fakeTranslator({ mergeLines: true });
    const context = loadBulletinApi({ LanguageApp });
    const output = translate(context, [{ english: 'One.', chinese: '一。' }, { english: 'Two.', chinese: '二。' }]);
    expect(output.map((announcement) => announcement.spanish)).toEqual(['[es] One.', '[es] Two.']);
    expect(requests.map((request) => request.text)).toEqual(['One.\nTwo.', 'One.', 'Two.']);
  });

  it('leaves a side blank when the translation fails, and stops asking', () => {
    const logs: string[] = [];
    const { LanguageApp, requests } = fakeTranslator({ fail: (target) => target !== 'en' });
    const context = loadBulletinApi({ LanguageApp, Logger: { log: (message: string) => logs.push(message) } });
    const output = translate(context, [{ english: 'One.' }, { english: 'Two.' }, { chinese: '三。' }]);
    expect(output).toEqual([
      { english: 'One.', chinese: '', spanish: '' },
      { english: 'Two.', chinese: '', spanish: '' },
      { english: '[en] 三。', chinese: '三。', spanish: '' },
    ]);
    // One failed request per language, not one per line.
    expect(requests.map((request) => request.target)).toEqual(['es', 'es', 'zh-TW', 'en']);
    expect(logs[0]).toContain('Announcement translation to es failed');
  });

  it('remembers each translation, so the next reader costs no request', () => {
    const { LanguageApp, requests } = fakeTranslator();
    const cache = fakeCache();
    const context = loadBulletinApi({ LanguageApp, CacheService: cache.CacheService, Utilities: cache.Utilities });
    const first = translate(context, [{ english: 'Fellowship lunch.' }]);
    const count = requests.length;
    expect(count).toBe(2);
    expect(translate(context, [{ english: 'Fellowship lunch.' }])).toEqual(first);
    expect(requests).toHaveLength(count);
    // A line added later is the only one asked for.
    translate(context, [{ english: 'Fellowship lunch.' }, { english: 'Choir practice.' }]);
    expect(requests.slice(count).map((request) => request.text)).toEqual(['Choir practice.', 'Choir practice.']);
    // Each is kept under its languages and its text's digest.
    expect([...cache.store.keys()].map((key) => key.split(':').slice(0, 4).join(':')).sort()).toEqual([
      'translation:v1:en:es',
      'translation:v1:en:es',
      'translation:v1:en:zh-TW',
      'translation:v1:en:zh-TW',
    ]);
  });

  it('keeps the typed text when there is no translator, as in a test', () => {
    const context = loadBulletinApi();
    expect(translate(context, [{ english: 'Fellowship lunch.' }])).toEqual([
      { english: 'Fellowship lunch.', chinese: '', spanish: '' },
    ]);
  });
});
