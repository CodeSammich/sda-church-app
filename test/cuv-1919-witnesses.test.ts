import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The app's 1919 Chinese Union Version, checked word for word against two
// other copies of the 1919 text that it wasn't built from (#517): Wikisource's
// transcription and open-bibles'. Both are in test/fixtures/cuv-1919-witnesses,
// as scripts/cuv-1919-witnesses.mjs downloads them. Neither copy is perfect, so
// a verse passes when its wording matches either one: a copying error in the
// app's text would have to be the same error, in the same verse, in a copy
// made separately. scripts/cuv-1919-fold.cjs says what counts as wording.
const { foldSimplified, foldTraditional } = require('../scripts/cuv-1919-fold.cjs');
const { toSimplified } = require('../scripts/cuv-1919-simplified.cjs');

type Part = string | { type: string; contents: string; level?: number };
type Copy = Record<string, string>;
interface Verse {
  ref: string;
  book: string;
  chapter: number;
  verse: number;
  parts: Part[];
  text: string;
}

const readBook = (script: string, name: string) =>
  JSON.parse(readFileSync(join(process.cwd(), 'assets/bible/cuv1919', script, `${name}.biblejson`), 'utf8'));
const readCopy = (name: string): Copy =>
  JSON.parse(readFileSync(join(process.cwd(), 'test/fixtures/cuv-1919-witnesses', `${name}.json`), 'utf8')).verses;

const BOOKS: string[] = readBook('hant', 'books').map((book: { id: string }) => book.id.toLowerCase());

// A verse as the copies print it, with its notes in 〔〕. Psalm titles are
// headings, which the copies keep apart from the verses.
const verseText = (parts: Part[]) =>
  parts.map((part) => (typeof part === 'string' ? part : part.type === 'note' ? `〔${part.contents}〕` : '')).join('');

const versesOf = (script: string): Verse[] =>
  BOOKS.flatMap((book) =>
    (readBook(script, book).contents as Part[][][]).flatMap((chapterVerses, chapter) =>
      chapterVerses.flatMap((parts, verse) =>
        parts.length ? [{ ref: `${book} ${chapter}:${verse}`, book, chapter, verse, parts, text: verseText(parts) }] : [],
      ),
    ),
  );

const TRADITIONAL = versesOf('hant');
const SIMPLIFIED = versesOf('hans');
const COPIES: Record<string, Copy> = { Wikisource: readCopy('wikisource'), 'open-bibles': readCopy('open-bibles') };
const OPEN_BIBLES_SIMPLIFIED = readCopy('open-bibles-simplified');

const position = (ref: string) => {
  const [book, cv] = ref.split(' ');
  const [chapter, verse] = cv.split(':').map(Number);
  return { book, at: chapter * 1000 + verse };
};

// The words of the verses from one reference to another, in order, without
// the notes saying a verse is joined to the one before (見上節).
const wordsAcross = (verses: [string, string][], from: string, to: string) => {
  const start = position(from);
  const end = position(to);
  return verses
    .filter(([ref]) => {
      const { book, at } = position(ref);
      return book === start.book && at >= start.at && at <= end.at;
    })
    .sort(([a], [b]) => position(a).at - position(b).at)
    .map(([, text]) => foldTraditional(text))
    .filter((words) => words !== '見上節')
    .join('');
};
const appAcross = (from: string, to: string) => wordsAcross(TRADITIONAL.map(({ ref, text }) => [ref, text]), from, to);
const copyAcross = (copy: Copy, from: string, to: string) => wordsAcross(Object.entries(copy), from, to);

// Verses the copies divide differently from the app, which divides them as the
// 1988 text and the BSB do, so verses pair with the BSB. Across each range, the
// words must still match a copy, in order.
const DIVIDED_DIFFERENTLY = [
  ['1ch 21:30', '1ch 22:19', 'Both copies number 1 Chronicles 22 one verse later: their 21:31 is 22:1 here.'],
  ['psa 76:8', 'psa 76:9', '1919 translates the two verses as one, which each copy puts in a different verse.'],
  ['psa 92:2', 'psa 92:3', '1919 translates the two verses as one, which each copy puts in a different verse.'],
  ['psa 105:5', 'psa 105:6', '1919 translates the two verses as one, which each copy puts in a different verse.'],
  ['psa 116:18', 'psa 116:19', '1919 translates the two verses as one, which each copy puts in a different verse.'],
  ['jhn 7:53', 'jhn 8:1', 'Both copies start 8:1 with the words of 7:53.'],
  ['rev 12:17', 'rev 12:18', 'Both copies end 12:17 with the words of 12:18.'],
] as const;
const dividedDifferently = (ref: string) =>
  DIVIDED_DIFFERENTLY.some(([from, to]) => {
    const { book, at } = position(ref);
    return book === position(from).book && at >= position(from).at && at <= position(to).at;
  });

const matchesACopy = ({ ref, text }: Verse) =>
  Object.values(COPIES).some((copy) => foldTraditional(copy[ref] ?? '') === foldTraditional(text));

// Whether the verse, or one beside it, is a note that two verses are one.
const besideMergedVerse = (index: number) =>
  [index - 1, index, index + 1].some((i) => TRADITIONAL[i] && foldTraditional(TRADITIONAL[i].text) === '見上節');

describe('the 1919 Chinese Union Version against other copies of the 1919 text', () => {
  it('has every verse in the wording of Wikisource or open-bibles', () => {
    const differences = TRADITIONAL.flatMap((verse, index) => {
      if (matchesACopy(verse) || dividedDifferently(verse.ref)) return [];
      // Where 1919 translates two verses as one, the copies put the words in
      // the first verse or the second, so compare the pair.
      for (const [from, to] of [
        [TRADITIONAL[index - 1], verse],
        [verse, TRADITIONAL[index + 1]],
      ]) {
        if (!from || !to || from.book !== to.book) continue;
        const words = appAcross(from.ref, to.ref);
        if (Object.values(COPIES).some((copy) => copyAcross(copy, from.ref, to.ref) === words)) return [];
      }
      return [
        {
          ref: verse.ref,
          app: verse.text,
          ...Object.fromEntries(Object.entries(COPIES).map(([name, copy]) => [name, copy[verse.ref] ?? null])),
        },
      ];
    });
    expect(differences).toEqual([]);
  });

  it.each(DIVIDED_DIFFERENTLY)('has the words of %s to %s in a copy, in order (%s)', (from, to) => {
    const words = appAcross(from, to);
    expect(Object.values(COPIES).some((copy) => copyAcross(copy, from, to) === words)).toBe(true);
    // Each range is still needed: some verse in it differs from both copies.
    expect(TRADITIONAL.some((verse) => dividedDifferently(verse.ref) && position(verse.ref).book === position(from).book && !matchesACopy(verse))).toBe(true);
  });

  it('agrees with both copies wherever the two agree with each other', () => {
    const outvoted = TRADITIONAL.flatMap((verse, index) => {
      const [a, b] = Object.values(COPIES).map((copy) => copy[verse.ref]);
      if (a === undefined || b === undefined || dividedDifferently(verse.ref)) return [];
      const agreed = foldTraditional(a);
      return agreed === foldTraditional(b) && agreed !== foldTraditional(verse.text) && !besideMergedVerse(index)
        ? [verse.ref]
        : [];
    });
    // Apart from merged verses, where the app puts the words in the other verse.
    expect(outvoted).toEqual([]);
  });
});

// open-bibles' Simplified copy keeps some older forms, where the app's
// conversion gives the standard Simplified one. Each was checked by hand.
const OLDER_SIMPLIFIED_FORMS = new Set(
  ['毗毘', '丘邱', '够彀', '窑窰', '秸稭', '翻繙', '冈岗', '提题', '姪侄', '扇搧', '拼拚', '糟蹧', '麃麅', '煖暖', '帚箒', '绒羢', '铺舖', '镕融', '陈𫈟', '鐏𨱔', '着𤏲', '喂𫗪'].map((pair) => [...pair].join('→')),
);

// Where open-bibles' Simplified copy is wrong: 着 (zhe) for 著 (zhù) in 著名
// (famous) and 著書 (writing books).
const OPEN_BIBLES_SIMPLIFIED_ERRORS = new Set(
  ['1ch 8:28', '1ch 9:34', '1ch 12:30', 'ecc 12:12', 'amo 6:1'].map((ref) => `${ref}: 著 became 著, open-bibles has 着`),
);

describe('the Simplified 1919 Chinese Union Version', () => {
  it('is the Traditional text converted, verse by verse', () => {
    expect(SIMPLIFIED.map(({ ref }) => ref)).toEqual(TRADITIONAL.map(({ ref }) => ref));
    const different = TRADITIONAL.filter((verse, index) => toSimplified(verse.text) !== SIMPLIFIED[index].text).map(({ ref }) => ref);
    expect(different).toEqual([]);
    const titles = TRADITIONAL.flatMap((verse, index) =>
      verse.parts.flatMap((part, p) =>
        typeof part !== 'string' && part.type === 'heading' && toSimplified(part.contents) !== (SIMPLIFIED[index].parts[p] as { contents: string }).contents
          ? [verse.ref]
          : [],
      ),
    );
    expect(titles).toEqual([]);
  });

  it("converts each character as open-bibles' Simplified copy does, where the Traditional copies agree", () => {
    const han = (text: string) => [...text.replace(/［[^］]*］/gu, '')].filter((ch) => /\p{Script=Han}/u.test(ch));
    const differences: string[] = [];
    let compared = 0;
    TRADITIONAL.forEach((verse, index) => {
      const traditional = COPIES['open-bibles'][verse.ref];
      const simplified = OPEN_BIBLES_SIMPLIFIED[verse.ref];
      if (traditional === undefined || simplified === undefined) return;
      if (foldTraditional(traditional) !== foldTraditional(verse.text)) return;
      const [ours, theirs, appTraditional, theirTraditional] = [SIMPLIFIED[index].text, simplified, verse.text, traditional].map(han);
      if (new Set([ours.length, theirs.length, appTraditional.length, theirTraditional.length]).size > 1) return;
      compared += 1;
      ours.forEach((ch, i) => {
        if (foldSimplified(ch) === foldSimplified(theirs[i])) return;
        if (foldTraditional(appTraditional[i]) !== foldTraditional(theirTraditional[i])) return;
        if (!OLDER_SIMPLIFIED_FORMS.has(`${ch}→${theirs[i]}`)) differences.push(`${verse.ref}: ${appTraditional[i]} became ${ch}, open-bibles has ${theirs[i]}`);
      });
    });
    expect(compared).toBeGreaterThan(30000);
    expect(differences.filter((difference) => !OPEN_BIBLES_SIMPLIFIED_ERRORS.has(difference))).toEqual([]);
    // Each is still there, so the list stays true.
    expect(differences.filter((difference) => OPEN_BIBLES_SIMPLIFIED_ERRORS.has(difference))).toHaveLength(OPEN_BIBLES_SIMPLIFIED_ERRORS.size);
  });
});
