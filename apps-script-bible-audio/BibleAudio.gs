/**
 * Looks up Cantonese Bible audio for the church app in Faith Comes By Hearing's
 * Bible Brain API (#241). The app can't carry the API key, since anyone could pull
 * it out of the compiled app, so this web app holds it and answers three narrow
 * requests:
 *
 *   ?fileset=<id>&chapters=MAT.1,MAT.2   Each chapter's audio link:
 *                                        { links: { "MAT.1": { url, duration } } }
 *   ?copyright=<id>                      FCBH's notice for a fileset: { notice }
 *   ?health                              { ok: true, configured }, without calling FCBH
 *
 * A chapter FCBH doesn't have comes back as null. Anything else comes back as
 * { error }, since a web app can't set an HTTP status.
 *
 * Its settings are Script Properties (Project Settings → Script Properties), never
 * this file, because the repository is public:
 *
 *   BIBLE_BRAIN_KEY    FCBH's API key
 *   ALLOWED_FILESETS   the fileset IDs the app uses, separated by commas
 *
 * FCBH's API License Agreement shapes the rest (docs/LEGAL.md):
 * - It must not become "a proxy distribution network": it answers only these
 *   requests, only for ALLOWED_FILESETS and real chapters, 30 chapters at most.
 * - "No DBP Content may be downloaded or made available for offline use": it
 *   never fetches or stores audio, only the signed links FCBH returns. The app
 *   streams the audio from FCBH's servers.
 * - The key is never returned or put in an error. Errors from UrlFetchApp can
 *   include the request, and with it the key, so they're never passed on.
 *
 * Deploying, and turning it on and off: docs/operations/bible-brain-audio.md.
 */

var BIBLE_BRAIN_API = 'https://4.dbt.io/api';
var MAX_CHAPTERS_PER_REQUEST = 30;

// USFM codes Bible Brain uses, with each book's chapter count.
var BIBLE_BRAIN_CHAPTERS = {
  GEN: 50, EXO: 40, LEV: 27, NUM: 36, DEU: 34, JOS: 24, JDG: 21, RUT: 4, '1SA': 31, '2SA': 24,
  '1KI': 22, '2KI': 25, '1CH': 29, '2CH': 36, EZR: 10, NEH: 13, EST: 10, JOB: 42, PSA: 150,
  PRO: 31, ECC: 12, SNG: 8, ISA: 66, JER: 52, LAM: 5, EZK: 48, DAN: 12, HOS: 14, JOL: 3, AMO: 9,
  OBA: 1, JON: 4, MIC: 7, NAM: 3, HAB: 3, ZEP: 3, HAG: 2, ZEC: 14, MAL: 4, MAT: 28, MRK: 16,
  LUK: 24, JHN: 21, ACT: 28, ROM: 16, '1CO': 16, '2CO': 13, GAL: 6, EPH: 6, PHP: 4, COL: 4,
  '1TH': 5, '2TH': 3, '1TI': 6, '2TI': 4, TIT: 3, PHM: 1, HEB: 13, JAS: 5, '1PE': 5, '2PE': 3,
  '1JN': 5, '2JN': 1, '3JN': 1, JUD: 1, REV: 22,
};

function doGet(e) {
  var answer;
  try {
    answer = answerBibleAudio(e && e.parameter ? e.parameter : {});
  } catch (error) {
    // Never pass the error on: it could carry the request, and with it the key.
    answer = { error: 'Bible Brain did not answer.' };
  }
  return ContentService.createTextOutput(JSON.stringify(answer)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function answerBibleAudio(params) {
  var properties = PropertiesService.getScriptProperties();
  var key = properties.getProperty('BIBLE_BRAIN_KEY');
  if (Object.prototype.hasOwnProperty.call(params, 'health')) {
    return { ok: true, configured: Boolean(key) };
  }
  if (!key) return { error: 'The script has no API key yet.' };

  var allowed = splitList(properties.getProperty('ALLOWED_FILESETS'));
  if (params.copyright !== undefined) {
    if (allowed.indexOf(params.copyright) === -1) return { error: 'Unknown fileset.' };
    var response = fetchBibleBrain('bibles/filesets/' + params.copyright + '/copyright', key);
    var copyright = pickBibleBrainCopyright(parseBibleBrainJson(response));
    return copyright || { error: 'No copyright notice.' };
  }

  if (allowed.indexOf(params.fileset) === -1) return { error: 'Unknown fileset.' };
  var chapters = parseBibleBrainChapters(params.chapters);
  if (!chapters) return { error: 'Unknown book or chapter.' };

  var responses = UrlFetchApp.fetchAll(
    chapters.map(function (each) {
      return bibleBrainRequest(
        'bibles/filesets/' + params.fileset + '/' + each.book + '/' + each.chapter,
        key,
      );
    }),
  );
  var links = {};
  chapters.forEach(function (each, index) {
    links[each.id] = pickBibleBrainChapter(
      parseBibleBrainJson(responses[index]),
      each.book,
      each.chapter,
    );
  });
  return { links: links };
}

function splitList(value) {
  return String(value || '')
    .split(',')
    .map(function (item) { return item.trim(); })
    .filter(Boolean);
}

/** "MAT.1,MAT.2" as [{ id, book, chapter }], or null if any isn't a real chapter. */
function parseBibleBrainChapters(value) {
  var ids = splitList(value);
  if (!ids.length || ids.length > MAX_CHAPTERS_PER_REQUEST) return null;
  var chapters = [];
  for (var i = 0; i < ids.length; i += 1) {
    var match = /^([1-3A-Z]{3})\.(\d{1,3})$/.exec(ids[i]);
    var count = match && Object.prototype.hasOwnProperty.call(BIBLE_BRAIN_CHAPTERS, match[1])
      ? BIBLE_BRAIN_CHAPTERS[match[1]]
      : 0;
    var chapter = match ? Number(match[2]) : 0;
    if (!count || chapter < 1 || chapter > count) return null;
    chapters.push({ id: ids[i], book: match[1], chapter: chapter });
  }
  return chapters;
}

function bibleBrainRequest(path, key) {
  return {
    url: BIBLE_BRAIN_API + '/' + path + '?v=4&key=' + encodeURIComponent(key),
    headers: { Accept: 'application/json' },
    muteHttpExceptions: true,
  };
}

function fetchBibleBrain(path, key) {
  var request = bibleBrainRequest(path, key);
  return UrlFetchApp.fetch(request.url, request);
}

function parseBibleBrainJson(response) {
  if (!response || response.getResponseCode() !== 200) return null;
  try {
    return JSON.parse(response.getContentText());
  } catch (error) {
    return null;
  }
}

/** The chapter's file from Bible Brain's answer, keeping only what the app needs. */
function pickBibleBrainChapter(body, book, chapter) {
  var files = body && Array.isArray(body.data) ? body.data : [];
  var file = files.filter(function (item) {
    return (
      item &&
      String(item.book_id).toUpperCase() === book &&
      Number(item.chapter_start) === chapter &&
      typeof item.path === 'string' &&
      /^https:\/\//.test(item.path)
    );
  })[0];
  if (!file) return null;
  var duration = Number(file.duration);
  return { url: file.path, duration: isFinite(duration) && duration > 0 ? duration : null };
}

/** FCBH's copyright text for a fileset, as plain strings. */
function pickBibleBrainCopyright(body) {
  var copyright = (body && (body.copyright || (body.data && body.data.copyright))) || body;
  var text = [copyright && copyright.copyright, copyright && copyright.copyright_description]
    .filter(function (line) { return typeof line === 'string' && line.trim(); })
    .map(function (line) { return line.trim(); });
  return text.length ? { notice: text.join('\n') } : null;
}
