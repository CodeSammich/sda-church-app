/**
 * Writes how big each book's recording is for each narrator a member can
 * download for listening offline (#556), so the app can show the size before
 * a download starts: constants/BibleAudioDownloadSizes.json, as
 * { narrator: { book: bytes } }.
 *
 * The church's copies (Mandarin, Cantonese, and Spanish) are measured already:
 * scripts/bible-audio-timing-sources/<narrator>.json has each chapter's size,
 * from the files the verse times were made from. HelloAO's English
 * recordings are asked for their size, one HEAD request a chapter (3,567 in
 * all, a few at a time). Gilbert isn't offered: his recordings are on
 * openbible.com, not HelloAO, and HelloAO no longer lists him.
 *
 * It needs the network:
 *   node scripts/build-bible-audio-download-sizes.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHURCH_NARRATORS = ['cuv-mandarin', 'cuv-cantonese', 'rv1909'];
export const HELLOAO_DOWNLOAD_NARRATORS = ['souer', 'hays', 'david'];
const CONCURRENT_REQUESTS = 6;

/** The address the app downloads a HelloAO narrator's chapter from. */
export const helloAoChapterUrl = (narrator, bookId, chapter) =>
  `https://audio.bible.helloao.org/api/BSB/${bookId}/${chapter}/audio/${narrator}.mp3`;

const chapterSizes = (narrator) =>
  JSON.parse(readFileSync(join(root, 'scripts/bible-audio-timing-sources', `${narrator}.json`), 'utf8'));

const byBook = (entries) => {
  const books = {};
  for (const [chapter, bytes] of entries) {
    const book = chapter.split(' ')[0];
    books[book] = (books[book] ?? 0) + bytes;
  }
  return books;
};

const contentLength = async (url) => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const length = Number(response.headers.get('content-length'));
      if (response.ok && length > 0) return length;
      throw new Error(`HTTP ${response.status}, content-length ${response.headers.get('content-length')}`);
    } catch (error) {
      if (attempt === 3) throw new Error(`${url}: ${error.message}`);
      await new Promise((done) => setTimeout(done, 2000 * attempt));
    }
  }
};

const measure = async (urls) => {
  const sizes = new Array(urls.length);
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const index = next++;
      sizes[index] = await contentLength(urls[index]);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENT_REQUESTS }, worker));
  return sizes;
};

const main = async () => {
  const sizes = {};
  for (const narrator of CHURCH_NARRATORS) {
    sizes[narrator] = byBook(Object.entries(chapterSizes(narrator)).map(([chapter, { bytes }]) => [chapter, bytes]));
  }
  // Every narrator records the same 1,189 chapters.
  const chapters = Object.keys(chapterSizes(CHURCH_NARRATORS[0]));
  for (const narrator of HELLOAO_DOWNLOAD_NARRATORS) {
    const urls = chapters.map((chapter) => {
      const [book, number] = chapter.split(' ');
      return helloAoChapterUrl(narrator, book, number);
    });
    const measured = await measure(urls);
    sizes[narrator] = byBook(chapters.map((chapter, index) => [chapter, measured[index]]));
    console.log(`${narrator}: ${(Object.values(sizes[narrator]).reduce((a, b) => a + b) / 1e9).toFixed(2)} GB`);
  }
  writeFileSync(join(root, 'constants/BibleAudioDownloadSizes.json'), `${JSON.stringify(sizes, null, 2)}\n`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
