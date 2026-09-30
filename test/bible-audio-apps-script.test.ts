import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

// A made-up key: the tests check it never leaves the script.
const KEY = 'test-key-123';

type Answer = Record<string, any>;
type FakeResponse = { status: number; body: unknown };

/** Runs apps-script-bible-audio/BibleAudio.gs against fake Apps Script services. */
const loadScript = ({
  key = KEY,
  filesets = 'YUHUNVN2DA',
  respond = (): FakeResponse => ({ status: 404, body: null }),
  fail,
}: {
  key?: string | null;
  filesets?: string;
  respond?: (url: string) => FakeResponse;
  fail?: Error;
} = {}) => {
  const requests: Array<{ url: string; muteHttpExceptions?: boolean }> = [];
  const toResponse = (url: string) => {
    if (fail) throw fail;
    const { status, body } = respond(url);
    return {
      getResponseCode: () => status,
      getContentText: () => (typeof body === 'string' ? body : JSON.stringify(body)),
    };
  };
  const context = createContext({
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (name: string) =>
          ({ BIBLE_BRAIN_KEY: key, ALLOWED_FILESETS: filesets } as Record<string, string | null>)[name],
      }),
    },
    UrlFetchApp: {
      fetch: (url: string, options: { muteHttpExceptions?: boolean }) => {
        requests.push({ url, ...options });
        return toResponse(url);
      },
      fetchAll: (list: Array<{ url: string; muteHttpExceptions?: boolean }>) =>
        list.map((request) => {
          requests.push(request);
          return toResponse(request.url);
        }),
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => ({
        text,
        mimeType: '',
        setMimeType(type: string) {
          this.mimeType = type;
          return this;
        },
      }),
    },
  });
  runInContext(
    readFileSync(join(process.cwd(), 'apps-script-bible-audio/BibleAudio.gs'), 'utf8'),
    context,
  );
  const get = (parameter: Record<string, string>) => {
    const output = (context as any).doGet({ parameter });
    expect(output.mimeType).toBe('application/json');
    return { answer: JSON.parse(output.text) as Answer, text: output.text as string };
  };
  return { get, requests };
};

// Bible Brain's answer for a chapter, shaped like its real responses.
const chapterFile = (book: string, chapter: number) => ({
  status: 200,
  body: {
    data: [
      {
        book_id: book,
        chapter_start: chapter,
        duration: 312,
        path: `https://cdn.example.org/${book}${chapter}.mp3?Expires=1790000000&Signature=s`,
      },
    ],
  },
});

describe('the Bible Brain Apps Script', () => {
  it('answers a health check without calling Bible Brain', () => {
    const { get, requests } = loadScript();
    expect(get({ health: '' }).answer).toEqual({ ok: true, configured: true });
    expect(loadScript({ key: null }).get({ health: '' }).answer).toEqual({ ok: true, configured: false });
    expect(requests).toEqual([]);
  });

  it('looks up each chapter asked for, and returns only its link and length', () => {
    const { get, requests } = loadScript({
      respond: (url) => (url.includes('/MAT/2?') ? { status: 404, body: null } : chapterFile('MAT', 1)),
    });
    expect(get({ fileset: 'YUHUNVN2DA', chapters: 'MAT.1,MAT.2' }).answer).toEqual({
      links: {
        'MAT.1': {
          url: 'https://cdn.example.org/MAT1.mp3?Expires=1790000000&Signature=s',
          duration: 312,
        },
        'MAT.2': null,
      },
    });
    expect(requests.map(({ url }) => url)).toEqual([
      `https://4.dbt.io/api/bibles/filesets/YUHUNVN2DA/MAT/1?v=4&key=${KEY}`,
      `https://4.dbt.io/api/bibles/filesets/YUHUNVN2DA/MAT/2?v=4&key=${KEY}`,
    ]);
    expect(requests.every(({ muteHttpExceptions }) => muteHttpExceptions)).toBe(true);
  });

  it('ignores a file for another chapter, or one not on https', () => {
    const { get } = loadScript({
      respond: () => ({
        status: 200,
        body: {
          data: [
            { book_id: 'MAT', chapter_start: 3, path: 'https://cdn.example.org/MAT3.mp3' },
            { book_id: 'MAT', chapter_start: 1, path: 'http://cdn.example.org/MAT1.mp3' },
          ],
        },
      }),
    });
    expect(get({ fileset: 'YUHUNVN2DA', chapters: 'MAT.1' }).answer).toEqual({ links: { 'MAT.1': null } });
  });

  it('answers only for allowed filesets and real chapters, 30 at a time', () => {
    const { get, requests } = loadScript({ respond: () => chapterFile('MAT', 1) });
    expect(get({ fileset: 'ENGESVN2DA', chapters: 'MAT.1' }).answer).toEqual({ error: 'Unknown fileset.' });
    expect(get({ fileset: 'YUHUNVN2DA', chapters: 'MAT.29' }).answer).toEqual({
      error: 'Unknown book or chapter.',
    });
    expect(get({ fileset: 'YUHUNVN2DA', chapters: '../bibles' }).answer).toEqual({
      error: 'Unknown book or chapter.',
    });
    const psalms = Array.from({ length: 31 }, (_, index) => `PSA.${index + 1}`).join(',');
    expect(get({ fileset: 'YUHUNVN2DA', chapters: psalms }).answer).toEqual({
      error: 'Unknown book or chapter.',
    });
    expect(loadScript({ filesets: '' }).get({ fileset: '', chapters: 'MAT.1' }).answer).toEqual({
      error: 'Unknown fileset.',
    });
    expect(requests).toEqual([]);
  });

  it('refuses everything but the health check until the key is set', () => {
    expect(loadScript({ key: null }).get({ fileset: 'YUHUNVN2DA', chapters: 'MAT.1' }).answer).toEqual({
      error: 'The script has no API key yet.',
    });
  });

  it('never passes on an error, which could contain the key', () => {
    const { get } = loadScript({
      fail: new Error(`Address unavailable: https://4.dbt.io/api/bibles/filesets/YUHUNVN2DA/MAT/1?v=4&key=${KEY}`),
    });
    const { answer, text } = get({ fileset: 'YUHUNVN2DA', chapters: 'MAT.1' });
    expect(answer).toEqual({ error: 'Bible Brain did not answer.' });
    expect(text).not.toContain(KEY);
  });

  it('returns FCBH’s copyright notice for an allowed fileset', () => {
    const { get } = loadScript({
      respond: () => ({
        status: 200,
        body: { copyright: { copyright: '℗ Hosanna', copyright_description: 'Used by permission.' } },
      }),
    });
    expect(get({ copyright: 'YUHUNVN2DA' }).answer).toEqual({ notice: '℗ Hosanna\nUsed by permission.' });
    expect(get({ copyright: 'ENGESVN2DA' }).answer).toEqual({ error: 'Unknown fileset.' });
  });

  it('asks Google only for permission to reach other websites', () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), 'apps-script-bible-audio/appsscript.json'), 'utf8'),
    );
    expect(manifest.oauthScopes).toEqual(['https://www.googleapis.com/auth/script.external_request']);
    expect(manifest.webapp).toEqual({ executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' });
  });
});
