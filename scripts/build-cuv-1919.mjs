/**
 * Builds the app's Chinese Union Version text, the public-domain 1919 edition
 * (官話和合譯本, 神 edition), from WordProject's Traditional Chinese download.
 *
 * Why 1919: the 1988 New Punctuation edition (新標點和合本) the app showed before
 * is © United Bible Societies, and the Hong Kong Bible Society didn't grant
 * permission (#517). WordProject's Traditional text is the 1919 text: the 1919
 * names (流便, 希底結), punctuation (、 ．), notes in 〔〕, spellings (他 for every
 * gender, 喫, 阿, 麼), no section headings, and the respectful full-width space
 * (U+3000) before each 神 that means God. WordProject's terms allow adapting its
 * text ("text format only"); see docs/LEGAL.md.
 *
 * Its Simplified Chinese download is a later edition (modern punctuation, 她), so
 * Simplified is converted from the Traditional text with opencc-js instead.
 *
 * WordProject's copy has some copying errors. scripts/cuv-1919-corrections.json
 * fixes each one, and every fix names the text it replaces, so this script fails
 * if WordProject's copy ever changes under it.
 *
 * Usage:
 *   1. Download https://www.wordpocket.org/bibles/download_zip/big5_new.zip
 *      (listed at https://www.wordproject.org/download/bibles/index.htm).
 *   2. Unzip it, then run:
 *        node scripts/build-cuv-1919.mjs <path to the big5_new folder>
 *
 * It writes assets/bible/cuv1919/{hant,hans}/<book>.biblejson in fetch(bible)'s
 * plain-text book format, { book, contents[chapter][verse] = [text, heading, or note] },
 * which services/BibleService.ts already reads, and books.biblejson, each book's
 * name and size. The names come from HelloAO's CUV book lists (facts, not text),
 * so the build needs the network. Then it rewrites assets/bible/index.ts.
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenCC from 'opencc-js/t2cn';

import { writeBibleAssetIndex } from './write-bible-asset-index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const BOOK_IDS = [
  'gen', 'exo', 'lev', 'num', 'deu', 'jos', 'jdg', 'rut', '1sa', '2sa', '1ki', '2ki',
  '1ch', '2ch', 'ezr', 'neh', 'est', 'job', 'psa', 'pro', 'ecc', 'sng', 'isa', 'jer',
  'lam', 'ezk', 'dan', 'hos', 'jol', 'amo', 'oba', 'jon', 'mic', 'nam', 'hab', 'zep',
  'hag', 'zec', 'mal', 'mat', 'mrk', 'luk', 'jhn', 'act', 'rom', '1co', '2co', 'gal',
  'eph', 'php', 'col', '1th', '2th', '1ti', '2ti', 'tit', 'phm', 'heb', 'jas', '1pe',
  '2pe', '1jn', '2jn', '3jn', 'jud', 'rev',
];

const VERSE_MARK = /<span class="verse" id="(\d+)">\s*\d+\s*<\/span>/;
// Names and places are wrapped in spans that carry a trailing ASCII space.
const NAME_SPANS = /<span class="(?:person|place|other|dimmed)">([\s\S]*?)[ \t]*<\/span>/g;

const decodeEntities = (text) =>
  text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');

/**
 * Cleans one piece of WordProject's text: drops tags and ASCII whitespace, which
 * is only HTML layout, but keeps U+3000, the 1919 text's space before 神.
 */
export const cleanText = (html) =>
  decodeEntities(html.replace(NAME_SPANS, '$1').replace(/<[^>]+>/g, ''))
    .replace(/[ \t\r\n ]+/g, '')
    .replace(/^　+|　+$/g, '');

/**
 * Parses one WordProject chapter page into its superscription (a Psalm title
 * such as 〔大衛的詩。〕, or '') and its verses, numbered from 1.
 */
export const parseChapter = (html, label = 'chapter') => {
  const start = html.indexOf('<div class="textBody" id="textBody">');
  const end = html.indexOf('<!-- /textBody -->', start);
  if (start === -1 || end === -1) {
    throw new Error(`${label}: no text body`);
  }
  let body = html.slice(start, end).replace(/<h3>[\s\S]*?<\/h3>/, '');

  let superscription = '';
  const dimver = /<span class="dimver">([\s\S]*?)<\/span>\s*(?=<p>|<span class="verse")/.exec(body);
  if (dimver) {
    superscription = cleanText(dimver[1]);
    body = body.slice(0, dimver.index) + body.slice(dimver.index + dimver[0].length);
  }

  const parts = body.split(VERSE_MARK);
  const verses = [];
  for (let index = 1; index < parts.length; index += 2) {
    const number = Number(parts[index]);
    if (number !== verses.length + 1) {
      throw new Error(`${label}: verse ${number} follows verse ${verses.length}`);
    }
    verses.push(cleanText(parts[index + 1]));
  }
  if (verses.length === 0) {
    throw new Error(`${label}: no verses`);
  }
  return { superscription, verses };
};

/**
 * Applies the reviewed corrections. Each names the exact text it replaces, so a
 * correction that no longer matches fails the build instead of being skipped.
 *
 * - `to` as a string replaces the verse.
 * - `to` as an array splits the verse into that many verses, numbered on from
 *   it. This is only for the verse divisions the other editions use; the words
 *   don't change.
 * - `part: "superscription"` corrects the chapter's title instead.
 *
 * Splits are applied last, from the end of each chapter, so every other
 * reference still means WordProject's numbering.
 */
export const applyCorrections = (books, corrections) => {
  const locate = (ref) => {
    const match = /^([1-3]?[a-z]{2,3}) (\d+):(\d+)$/.exec(ref);
    if (!match) {
      throw new Error(`Correction ${ref}: use a reference such as "gen 1:10"`);
    }
    const [, book, chapter, verse] = match;
    const found = books.get(book)?.[Number(chapter)];
    if (!found || found.verses[Number(verse) - 1] === undefined) {
      throw new Error(`Correction ${ref}: no such verse`);
    }
    return { chapter: found, index: Number(verse) - 1 };
  };
  const splits = [];
  for (const correction of corrections) {
    const { ref, from, to, part } = correction;
    const { chapter, index } = locate(ref);
    const current = part === 'superscription' ? chapter.superscription : chapter.verses[index];
    if (current !== from) {
      throw new Error(`Correction ${ref}: WordProject's text no longer matches "from"`);
    }
    if (part === 'superscription') {
      chapter.superscription = to;
    } else if (Array.isArray(to)) {
      splits.push({ chapter, index, to });
    } else {
      chapter.verses[index] = to;
    }
  }
  splits
    .sort((a, b) => b.index - a.index)
    .forEach(({ chapter, index, to }) => chapter.verses.splice(index, 1, ...to));
};

// A Selah at the end of a verse goes on its own line, where the reader shows it
// right-aligned, as it did for the 1988 text. One inside a verse (Habakkuk 3)
// stays where it is.
const SELAH_AT_END = /(〔細拉〕|〔细拉〕)$/u;
export const placeSelah = (text) => text.replace(SELAH_AT_END, '\n$1').replace(/^\n/, '');

// The 1919 text's notes in 〔〕 (another reading, the original's wording, what a
// name means) become footnotes, as the 1988 text's were, each marked where the
// note stood. A Selah stays in the text. So does a verse that is all in 〔〕: a
// verse the oldest manuscripts lack, which 1919 prints in brackets (Matthew
// 18:11), or Exodus 16:36's note on the omer.
const NOTE = /〔(?!細拉〕|细拉〕)([^〕]*)〕/gu;
export const splitNotes = (text) => {
  if (!/\p{Script=Han}/u.test(text.replace(NOTE, ''))) return [text];
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(NOTE)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push({ type: 'note', contents: match[1] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

/** fetch(bible)'s plain-text book: contents[chapter][verse], index 0 empty. */
export const toBookJson = (book, chapters, convert = (text) => text) => ({
  book,
  contents: [
    [],
    ...chapters.slice(1).map(({ superscription, verses }) => [
      [],
      ...verses.map((text, index) => [
        ...(index === 0 && superscription
          ? [{ type: 'heading', contents: convert(superscription), level: 3 }]
          : []),
        ...splitNotes(placeSelah(convert(text))),
      ]),
    ]),
  ],
});

const readBooks = (source) => {
  const books = new Map();
  BOOK_IDS.forEach((book, index) => {
    const folder = join(source, String(index + 1).padStart(2, '0'));
    const numbers = readdirSync(folder)
      .map((file) => /^(\d+)\.htm$/.exec(file)?.[1])
      .filter(Boolean)
      .map(Number)
      .sort((a, b) => a - b);
    const chapters = [undefined];
    for (const number of numbers) {
      if (number !== chapters.length) {
        throw new Error(`${book}: chapter ${number} follows chapter ${chapters.length - 1}`);
      }
      chapters.push(parseChapter(readFileSync(join(folder, `${number}.htm`), 'utf8'), `${book} ${number}`));
    }
    books.set(book, chapters);
  });
  return books;
};

// HelloAO's book lists for the Traditional and Simplified CUV, for book names.
const BOOK_NAMES_FROM = { hant: 'cmn_cuv', hans: 'cmn_cu1' };

const bookList = async (script, books) => {
  const response = await fetch(`https://bible.helloao.org/api/${BOOK_NAMES_FROM[script]}/books.json`);
  if (!response.ok) {
    throw new Error(`HelloAO ${BOOK_NAMES_FROM[script]} book list: HTTP ${response.status}`);
  }
  const names = new Map((await response.json()).books.map((book) => [book.id.toLowerCase(), book]));
  return [...books].map(([book, chapters]) => {
    const named = names.get(book);
    if (!named) throw new Error(`HelloAO has no ${book} in ${BOOK_NAMES_FROM[script]}`);
    return {
      id: book.toUpperCase(),
      name: named.name,
      commonName: named.commonName,
      title: named.title,
      numberOfChapters: chapters.length - 1,
      totalNumberOfVerses: chapters.slice(1).reduce((sum, chapter) => sum + chapter.verses.length, 0),
    };
  });
};

const main = async () => {
  const source = process.argv[2];
  if (!source) {
    console.error('Usage: node scripts/build-cuv-1919.mjs <path to the big5_new folder>');
    process.exit(1);
  }
  const books = readBooks(resolve(source));
  const corrections = JSON.parse(readFileSync(join(root, 'scripts/cuv-1919-corrections.json'), 'utf8'));
  applyCorrections(books, corrections);

  const converter = OpenCC.Converter({ from: 'tw', to: 'cn' });
  // OpenCC simplifies two rare characters to forms outside the Basic Multilingual
  // Plane, which many phones can't display: 蔯 (茵蔯, wormwood) to 𫈟, where 茵陈 is
  // the usual simplified spelling, and 鐏 (the butt of a spear) to 𨱔, where the
  // traditional form is kept.
  const toSimplified = (text) => {
    const simplified = converter(text).replace(/𫈟/gu, '陈').replace(/𨱔/gu, '鐏');
    const rare = simplified.match(/[\u{10000}-\u{10ffff}]/u);
    if (rare) throw new Error(`Simplified text has ${rare[0]}, which many phones can't display: ${text}`);
    return simplified;
  };
  let verses = 0;
  for (const [script, convert] of [['hant', undefined], ['hans', toSimplified]]) {
    const folder = join(root, 'assets/bible/cuv1919', script);
    mkdirSync(folder, { recursive: true });
    for (const [book, chapters] of books) {
      writeFileSync(join(folder, `${book}.biblejson`), `${JSON.stringify(toBookJson(book, chapters, convert))}\n`);
    }
    writeFileSync(join(folder, 'books.biblejson'), `${JSON.stringify(await bookList(script, books))}\n`);
  }
  writeBibleAssetIndex();
  for (const chapters of books.values()) {
    for (const chapter of chapters.slice(1)) verses += chapter.verses.length;
  }
  console.log(`Wrote ${books.size} books, ${verses} verses, ${corrections.length} corrections, in Traditional and Simplified.`);
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
