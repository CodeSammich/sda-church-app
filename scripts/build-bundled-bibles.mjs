/**
 * Builds the English, Spanish, and original-language Bible texts that ship with
 * the app, so they open with no network, like the Chinese Union Version
 * (scripts/build-cuv-1919.mjs):
 *
 * - The BSB from HelloAO's complete translation, one file per book holding
 *   each chapter as HelloAO's chapter API returns it (text, footnotes, verse
 *   count, and the BSB's narrator links). The audio timings, which the app
 *   doesn't use, are left out.
 * - Reina-Valera 1909 from fetch(bible) (`spa_rv`), book by book in its
 *   plain-text format, with its translation notes.
 * - The verse popup's original-language texts from fetch(bible), in the same
 *   format: the Solid Rock Hebrew Bible (`hbo_sr`) for the Old Testament and
 *   the Statistical Restoration Greek New Testament (`grc_sr`) for the New.
 *   They have no book list; the app finds a verse by book, chapter, and verse.
 *
 * The BSB and Reina-Valera are public domain, and the Hebrew and Greek editions
 * are CC BY 4.0, which the popup credits; see docs/LEGAL.md. Book names and
 * sizes come from HelloAO's book lists. It downloads everything, so it needs the
 * network:
 *   node scripts/build-bundled-bibles.mjs
 *
 * It writes assets/bible/{bsb,rv1909}/<book>.biblejson and books.biblejson, and
 * assets/bible/original/{hbo_sr,grc_sr}/<book>.biblejson, then rewrites
 * assets/bible/index.ts.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeBibleAssetIndex } from './write-bible-asset-index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HELLOAO = 'https://bible.helloao.org/api';
const FETCH_BIBLE = 'https://v1.fetch.bible/bibles';

const download = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const text = await response.text();
  return { json: JSON.parse(text), sha256: createHash('sha256').update(text).digest('hex') };
};

const write = (collection, name, value) => {
  const folder = join(root, 'assets/bible', collection);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, `${name}.biblejson`), `${JSON.stringify(value)}\n`);
};

export const bookEntry = ({ id, name, commonName, title, numberOfChapters, totalNumberOfVerses }) => ({
  id,
  name,
  commonName,
  title,
  numberOfChapters,
  totalNumberOfVerses,
});

/** One book of a HelloAO complete translation, as the app reads it. */
export const helloaoBook = (translation, book) => ({
  translation,
  book: bookEntry(book),
  chapters: [
    null,
    ...book.chapters.map(({ numberOfVerses, thisChapterAudioLinks, chapter }) => ({
      numberOfVerses,
      ...(thisChapterAudioLinks && Object.keys(thisChapterAudioLinks).length ? { thisChapterAudioLinks } : {}),
      chapter,
    })),
  ],
});

const buildHelloao = async (translationId, collection) => {
  const { json, sha256 } = await download(`${HELLOAO}/${translationId}/complete.json`);
  if (json.books.length !== 66) throw new Error(`${translationId}: ${json.books.length} books`);
  for (const book of json.books) write(collection, book.id.toLowerCase(), helloaoBook(json.translation, book));
  write(collection, 'books', json.books.map(bookEntry));
  return `${translationId} complete.json sha256 ${sha256}`;
};

const buildFetchBible = async (resourceId, collection, booksFrom) => {
  const { json: list } = await download(`${HELLOAO}/${booksFrom}/books.json`);
  if (list.books.length !== 66) throw new Error(`${booksFrom}: ${list.books.length} books`);
  for (const book of list.books) {
    const { json } = await download(`${FETCH_BIBLE}/${resourceId}/txt/${book.id.toLowerCase()}.json`);
    write(collection, book.id.toLowerCase(), { book: json.book, contents: json.contents });
  }
  write(collection, 'books', list.books.map(bookEntry));
  return `${resourceId}: ${list.books.length} books`;
};

/** The Old Testament from `hbo_sr` and the New from `grc_sr`, book by book. */
const buildOriginalLanguages = async () => {
  const { json: list } = await download(`${HELLOAO}/BSB/books.json`);
  if (list.books.length !== 66) throw new Error(`BSB: ${list.books.length} books`);
  for (const [index, { id }] of list.books.entries()) {
    const resourceId = index < 39 ? 'hbo_sr' : 'grc_sr';
    const { json } = await download(`${FETCH_BIBLE}/${resourceId}/txt/${id.toLowerCase()}.json`);
    write(`original/${resourceId}`, id.toLowerCase(), { book: json.book, contents: json.contents });
  }
  return 'hbo_sr: 39 books, grc_sr: 27 books';
};

const main = async () => {
  const log = [
    await buildHelloao('BSB', 'bsb'),
    await buildFetchBible('spa_rv', 'rv1909', 'spa_r09'),
    await buildOriginalLanguages(),
  ];
  writeBibleAssetIndex();
  console.log(log.join('\n'));
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
