/**
 * @jest-environment node
 */
import worker, { pickChapter, pickCopyright } from '../cloudflare-workers/bible-brain-audio/src/index.js';

const KEY = 'test-key-never-leaks';
const env = (overrides: Record<string, unknown> = {}) => ({
  BIBLE_BRAIN_KEY: KEY,
  ALLOWED_FILESETS: 'YUHUNVN2DA, YUEUN2N2DA',
  ALLOWED_ORIGINS: 'https://app.nyccsda.org',
  ...overrides,
});
const get = (path: string, headers: Record<string, string> = {}, method = 'GET') =>
  new Request(`https://proxy.example${path}`, { method, headers });
const chapterBody = {
  data: [
    {
      book_id: 'MAT',
      chapter_start: 1,
      path: 'https://cdn.example/audio/MAT_01.mp3?Signature=abc',
      duration: 312,
      filesize: 999,
    },
  ],
};

let fetchMock: jest.Mock;
beforeEach(() => {
  fetchMock = jest.fn(async () => new Response(JSON.stringify(chapterBody), { status: 200 }));
  global.fetch = fetchMock as unknown as typeof fetch;
});

const body = async (response: Response) => JSON.parse(await response.text());

describe('Bible Brain proxy', () => {
  it('answers a health check without calling Bible Brain', async () => {
    const response = await worker.fetch(get('/v1/health'), env({ BIBLE_BRAIN_KEY: undefined }));
    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('redirects an allowed chapter to a freshly signed audio link', async () => {
    const response = await worker.fetch(get('/v1/audio/YUHUNVN2DA/mat/1'), env());
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('https://cdn.example/audio/MAT_01.mp3?Signature=abc');
    expect(await response.text()).toBe('');
    const called = new URL(fetchMock.mock.calls[0][0]);
    expect(called.origin + called.pathname).toBe('https://4.dbt.io/api/bibles/filesets/YUHUNVN2DA/MAT/1');
    expect(called.searchParams.get('key')).toBe(KEY);
    expect(called.searchParams.get('v')).toBe('4');
  });

  it('never lets a response be cached', async () => {
    const response = await worker.fetch(get('/v1/audio/YUHUNVN2DA/MAT/1'), env());
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('refuses filesets outside the allowlist without calling Bible Brain', async () => {
    const response = await worker.fetch(get('/v1/audio/ENGESVN2DA/MAT/1'), env());
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses everything when the allowlist is empty', async () => {
    const response = await worker.fetch(get('/v1/audio/YUHUNVN2DA/MAT/1'), env({ ALLOWED_FILESETS: '' }));
    expect(response.status).toBe(404);
  });

  it.each([
    ['an unknown book', '/v1/audio/YUHUNVN2DA/XYZ/1'],
    ['a chapter past the end of the book', '/v1/audio/YUHUNVN2DA/MAT/29'],
    ['chapter zero', '/v1/audio/YUHUNVN2DA/MAT/0'],
    ['a fractional chapter', '/v1/audio/YUHUNVN2DA/MAT/1.5'],
    ['a path trying to reach another endpoint', '/v1/audio/YUHUNVN2DA/MAT/..%2F..%2Flanguages'],
  ])('rejects %s', async (_label, path) => {
    const response = await worker.fetch(get(path), env());
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards no other Bible Brain endpoint', async () => {
    for (const path of ['/v1/bibles', '/v1/chapters/YUHUNVN2DA/MAT/1', '/v1/audio/YUHUNVN2DA/MAT', '/api/bibles', '/']) {
      const response = await worker.fetch(get(path), env());
      expect(response.status).toBe(404);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers only GET, and HEAD for players that check a link first', async () => {
    const post = await worker.fetch(get('/v1/audio/YUHUNVN2DA/MAT/1', {}, 'POST'), env());
    expect(post.status).toBe(405);
    const head = await worker.fetch(get('/v1/audio/YUHUNVN2DA/MAT/1', {}, 'HEAD'), env());
    expect(head.status).toBe(302);
  });

  it('asks Bible Brain for a new link on every request, so a queued chapter never goes stale', async () => {
    await worker.fetch(get('/v1/audio/YUHUNVN2DA/MAT/1'), env());
    await worker.fetch(get('/v1/audio/YUHUNVN2DA/MAT/1'), env());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sends CORS headers only to the church website', async () => {
    const allowed = await worker.fetch(
      get('/v1/audio/YUHUNVN2DA/MAT/1', { Origin: 'https://app.nyccsda.org' }),
      env(),
    );
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('https://app.nyccsda.org');

    const other = await worker.fetch(get('/v1/audio/YUHUNVN2DA/MAT/1', { Origin: 'https://evil.example' }), env());
    expect(other.status).toBe(403);
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull();

    const native = await worker.fetch(get('/v1/audio/YUHUNVN2DA/MAT/1'), env());
    expect(native.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('answers a preflight only from the church website', async () => {
    const allowed = await worker.fetch(get('/v1/health', { Origin: 'https://app.nyccsda.org' }, 'OPTIONS'), env());
    expect(allowed.status).toBe(204);
    const other = await worker.fetch(get('/v1/health', { Origin: 'https://evil.example' }, 'OPTIONS'), env());
    expect(other.status).toBe(403);
  });

  it('turns an address away once it passes the rate limit', async () => {
    const limit = jest.fn(async () => ({ success: false }));
    const response = await worker.fetch(
      get('/v1/audio/YUHUNVN2DA/MAT/1', { 'CF-Connecting-IP': '203.0.113.9' }),
      env({ RATE_LIMITER: { limit } }),
    );
    expect(response.status).toBe(429);
    expect(limit).toHaveBeenCalledWith({ key: '203.0.113.9' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('says so when it has no key yet', async () => {
    const response = await worker.fetch(get('/v1/audio/YUHUNVN2DA/MAT/1'), env({ BIBLE_BRAIN_KEY: '' }));
    expect(response.status).toBe(503);
  });

  it('never puts the key in an error', async () => {
    fetchMock.mockRejectedValueOnce(new Error(`failed https://4.dbt.io/api/x?key=${KEY}`));
    const response = await worker.fetch(get('/v1/audio/YUHUNVN2DA/MAT/1'), env());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain(KEY);
  });

  it('reports a chapter Bible Brain has no audio for', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    const response = await worker.fetch(get('/v1/audio/YUHUNVN2DA/GEN/1'), env());
    expect(response.status).toBe(404);
  });

  it('returns FCBH’s copyright notice for an allowed fileset', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ copyright: { copyright: '℗ Hosanna', copyright_description: 'Used by permission.' } }),
        { status: 200 },
      ),
    );
    const response = await worker.fetch(get('/v1/copyright/YUHUNVN2DA'), env());
    expect(await body(response)).toEqual({ notice: '℗ Hosanna\nUsed by permission.' });
    expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe('/api/bibles/filesets/YUHUNVN2DA/copyright');
  });
});

describe('response parsing', () => {
  it('ignores files for other chapters and links that are not HTTPS', () => {
    expect(pickChapter(chapterBody, 'MAT', 2)).toBeNull();
    expect(
      pickChapter({ data: [{ book_id: 'MAT', chapter_start: 1, path: 'http://cdn.example/a.mp3' }] }, 'MAT', 1),
    ).toBeNull();
  });

  it('keeps the copyright lines that are present', () => {
    expect(pickCopyright({ copyright: { copyright: 'Text' } })).toEqual({ notice: 'Text' });
    expect(pickCopyright({})).toBeNull();
  });
});
