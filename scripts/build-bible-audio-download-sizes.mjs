/**
 * Writes how big each chapter's recording is for each narrator a member can
 * download for listening offline (#556): constants/BibleAudioDownloadSizes.json,
 * as { narrator: { book: [chapter 1's bytes, chapter 2's, …] } }. The app shows
 * the size before a download starts, and keeps a downloaded chapter only at
 * about its recording's size (services/BibleAudioDownloadSizes.ts), so a
 * Wi-Fi's sign-in page or a file cut off part way is tried again.
 *
 * Run it again whenever a host replaces a recording, or the app would turn
 * the new one down.
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

// In chapter order: the sources list each book's chapters in order.
const byBook = (entries) => {
  const books = {};
  for (const [chapter, bytes] of entries) {
    const [book, number] = chapter.split(' ');
    (books[book] ??= [])[Number(number) - 1] = bytes;
  }
  return books;
};

const total = (books) => Object.values(books).flat().reduce((a, b) => a + b, 0);

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
    console.log(`${narrator}: ${(total(sizes[narrator]) / 1e9).toFixed(2)} GB`);
  }
  // A book a line, so a replaced recording shows in a diff.
  const lines = Object.entries(sizes).map(
    ([narrator, books]) =>
      `  ${JSON.stringify(narrator)}: {\n${Object.entries(books)
        .map(([book, chapters]) => `    ${JSON.stringify(book)}: ${JSON.stringify(chapters)}`)
        .join(',\n')}\n  }`,
  );
  writeFileSync(join(root, 'constants/BibleAudioDownloadSizes.json'), `{\n${lines.join(',\n')}\n}\n`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
