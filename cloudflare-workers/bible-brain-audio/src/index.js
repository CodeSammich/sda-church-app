/**
 * The church's private proxy for Faith Comes By Hearing's Bible Brain API (#241).
 *
 * The app can't carry the Bible Brain API key: anyone could pull it out of the
 * compiled app. This Worker keeps the key as an encrypted secret and answers two
 * narrow requests, both for filesets the church allowlists:
 *
 *   GET /v1/audio/<fileset>/<book>/<chapter>  a redirect to that chapter's audio
 *   GET /v1/copyright/<fileset>               FCBH's copyright notice for a fileset
 *   GET /v1/health                            "ok", without calling Bible Brain
 *
 * The audio address never changes, so the app can queue chapters ahead of time
 * as it does for other recordings. Bible Brain's links expire, so the Worker asks
 * for a fresh one only when the player requests the chapter, and redirects to it.
 *
 * FCBH's API License Agreement shapes the rest (docs/LEGAL.md):
 * - It must not become "a proxy distribution network": it forwards only these
 *   requests, only for ALLOWED_FILESETS, with a per-address rate limit, and
 *   sends CORS headers only to the church's own website.
 * - "No DBP Content may be downloaded or made available for offline use": it
 *   never fetches or stores audio. The app streams from FCBH's CDN through the
 *   signed link, and every response says Cache-Control: no-store.
 * - The key is never logged, returned, or put in an error message.
 */

const API_BASE = 'https://4.dbt.io/api';

// USFM codes Bible Brain uses, with each book's chapter count.
const CHAPTERS = {
  GEN: 50, EXO: 40, LEV: 27, NUM: 36, DEU: 34, JOS: 24, JDG: 21, RUT: 4, '1SA': 31, '2SA': 24,
  '1KI': 22, '2KI': 25, '1CH': 29, '2CH': 36, EZR: 10, NEH: 13, EST: 10, JOB: 42, PSA: 150,
  PRO: 31, ECC: 12, SNG: 8, ISA: 66, JER: 52, LAM: 5, EZK: 48, DAN: 12, HOS: 14, JOL: 3, AMO: 9,
  OBA: 1, JON: 4, MIC: 7, NAM: 3, HAB: 3, ZEP: 3, HAG: 2, ZEC: 14, MAL: 4, MAT: 28, MRK: 16,
  LUK: 24, JHN: 21, ACT: 28, ROM: 16, '1CO': 16, '2CO': 13, GAL: 6, EPH: 6, PHP: 4, COL: 4,
  '1TH': 5, '2TH': 3, '1TI': 6, '2TI': 4, TIT: 3, PHM: 1, HEB: 13, JAS: 5, '1PE': 5, '2PE': 3,
  '1JN': 5, '2JN': 1, '3JN': 1, JUD: 1, REV: 22,
};

const list = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const respond = (status, body, origin) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }
  return new Response(JSON.stringify(body), { status, headers });
};

const fail = (status, error, origin) => respond(status, { error }, origin);

/** Calls Bible Brain with the key attached, returning its JSON or null. */
const upstream = async (env, path) => {
  const url = new URL(`${API_BASE}/${path}`);
  url.searchParams.set('v', '4');
  url.searchParams.set('key', env.BIBLE_BRAIN_KEY);
  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    cf: { cacheTtl: 0, cacheEverything: false },
  });
  if (!response.ok) return { status: response.status, body: null };
  return { status: response.status, body: await response.json() };
};

/** Picks the chapter's file from Bible Brain's answer, keeping only what the app needs. */
export const pickChapter = (body, book, chapter) => {
  const files = Array.isArray(body?.data) ? body.data : [];
  const file =
    files.find(
      (item) =>
        item &&
        String(item.book_id).toUpperCase() === book &&
        Number(item.chapter_start) === chapter &&
        typeof item.path === 'string',
    ) || null;
  if (!file || !/^https:\/\//.test(file.path)) return null;
  return {
    url: file.path,
    duration: Number.isFinite(Number(file.duration)) ? Number(file.duration) : null,
  };
};

/** Returns FCBH's copyright text for the fileset, as plain strings. */
export const pickCopyright = (body) => {
  const copyright = body?.copyright || body?.data?.copyright || body;
  const text = [copyright?.copyright, copyright?.copyright_description]
    .filter((line) => typeof line === 'string' && line.trim())
    .map((line) => line.trim());
  return text.length ? { notice: text.join('\n') } : null;
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const requestOrigin = request.headers.get('Origin');
    const origin = requestOrigin && list(env.ALLOWED_ORIGINS).includes(requestOrigin)
      ? requestOrigin
      : null;

    if (request.method === 'OPTIONS') {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, HEAD',
          'Access-Control-Max-Age': '86400',
          Vary: 'Origin',
        },
      });
    }
    // Media players sometimes check a link with HEAD before fetching it.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return fail(405, 'Only GET is supported.', origin);
    }
    // A browser page on any other site gets no answer it could read.
    if (requestOrigin && !origin) return fail(403, 'Origin not allowed.', null);

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'v1') return fail(404, 'Not found.', origin);
    if (parts[1] === 'health' && parts.length === 2) return respond(200, { ok: true }, origin);

    if (!env.BIBLE_BRAIN_KEY) return fail(503, 'The Worker has no API key yet.', origin);

    if (env.RATE_LIMITER) {
      const address = request.headers.get('CF-Connecting-IP') || 'unknown';
      const { success } = await env.RATE_LIMITER.limit({ key: address });
      if (!success) return fail(429, 'Too many requests. Try again in a minute.', origin);
    }

    const allowed = list(env.ALLOWED_FILESETS);
    const fileset = parts[2];
    if (!fileset || !allowed.includes(fileset)) return fail(404, 'Unknown fileset.', origin);

    try {
      if (parts[1] === 'copyright' && parts.length === 3) {
        const { status, body } = await upstream(env, `bibles/filesets/${fileset}/copyright`);
        const copyright = body && pickCopyright(body);
        if (!copyright) return fail(status === 404 ? 404 : 502, 'No copyright notice.', origin);
        return respond(200, copyright, origin);
      }

      if (parts[1] === 'audio' && parts.length === 5) {
        const book = String(parts[3]).toUpperCase();
        const chapter = Number(parts[4]);
        if (!CHAPTERS[book] || !Number.isInteger(chapter) || chapter < 1 || chapter > CHAPTERS[book]) {
          return fail(400, 'Unknown book or chapter.', origin);
        }
        const { status, body } = await upstream(env, `bibles/filesets/${fileset}/${book}/${chapter}`);
        const file = body && pickChapter(body, book, chapter);
        if (!file) return fail(status === 404 || body ? 404 : 502, 'No audio for this chapter.', origin);
        const headers = { Location: file.url, 'Cache-Control': 'no-store' };
        if (origin) Object.assign(headers, { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' });
        return new Response(null, { status: 302, headers });
      }
    } catch {
      // Never include the error: it could carry the upstream URL, and with it the key.
      return fail(502, 'Bible Brain did not answer.', origin);
    }

    return fail(404, 'Not found.', origin);
  },
};
