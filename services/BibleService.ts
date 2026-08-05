/**
 * Service for interacting with the HelloAO and fetch(bible) Bible collections.
 * Follows the design specs for multi-language, native-first rendering.
 *
 * Note: The `SupportedLanguage` type is imported from the global LanguageContext
 * to ensure consistency in language code mapping.
 *
 * Architectural Design: ../docs/feature_designs/bible_integration_design.md
 * API References:
 * - https://bible.helloao.org/docs/reference/
 * - https://fetch.bible/access/manual/
 */

export const API_BASE = 'https://bible.helloao.org/api';

/** Persisted Bible translation selected by the app language or the user. */
export const BIBLE_TRANSLATION_STORAGE_KEY = 'user-bible-translation';

/**
 * fetch(bible) supplies the original-language critical editions and the
 * Chinese Union Version / Reina-Valera 1909 reader text. Other translated
 * editions continue to use HelloAO.
 *
 * IMPORTANT LICENSING DISTINCTION:
 * - fetch(bible offers its CDN without an API key, usage fee, request quota, or
 *   provider-imposed caching limit.
 * - That free service access DOES NOT place every distributed work in the
 *   public domain and DOES NOT replace each work's individual license.
 * - The `hbo_sr` and `grc_sr` editions selected below are CC BY 4.0 works. CC BY
 *   4.0 permits copying, redistribution, adaptation, and commercial use, but
 *   requires appropriate attribution, a license link, and disclosure of
 *   changes. These obligations apply even though fetch(bible itself is free.
 *
 * Do not remove the edition/editor attribution from the verse-detail UI or the
 * source/license documentation in README.md. If either resource id changes,
 * review the replacement work's license rather than assuming that availability
 * through fetch(bible is sufficient permission to redistribute it.
 *
 * Service policy: https://fetch.bible/access/#no-limits-from-us
 * CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
 */
export const FETCH_BIBLE_BASE = 'https://v1.fetch.bible/bibles';

import { SupportedLanguage } from '@/constants/LanguageContext';

const OLD_TESTAMENT_BOOK_IDS = new Set([
  'GEN',
  'EXO',
  'LEV',
  'NUM',
  'DEU',
  'JOS',
  'JDG',
  'RUT',
  '1SA',
  '2SA',
  '1KI',
  '2KI',
  '1CH',
  '2CH',
  'EZR',
  'NEH',
  'EST',
  'JOB',
  'PSA',
  'PRO',
  'ECC',
  'SNG',
  'ISA',
  'JER',
  'LAM',
  'EZK',
  'DAN',
  'HOS',
  'JOL',
  'AMO',
  'OBA',
  'JON',
  'MIC',
  'NAH',
  'HAB',
  'ZEP',
  'HAG',
  'ZEC',
  'MAL',
]);

const ORIGINAL_LANGUAGE_EDITIONS = {
  // CC BY 4.0 source and required citation:
  // https://github.com/jjmccollum/solid-rock-hb#license-and-citation
  oldTestament: {
    id: 'hbo_sr',
    language: 'Hebrew / Aramaic',
    textDirection: 'rtl' as const,
    edition: 'Solid Rock Hebrew Bible',
    attribution: 'Edited by Stephen L. Brown. Licensed CC BY 4.0.',
    sourceUrl: 'https://github.com/jjmccollum/solid-rock-hb',
  },
  // CC BY 4.0 source and required attribution:
  // https://github.com/Center-for-New-Testament-Restoration/SR#license
  newTestament: {
    id: 'grc_sr',
    language: 'Koine Greek',
    textDirection: 'ltr' as const,
    edition: 'Statistical Restoration Greek New Testament',
    attribution:
      'Edited by Alan Bunning for the Center for New Testament Restoration. Licensed CC BY 4.0.',
    sourceUrl: 'https://github.com/Center-for-New-Testament-Restoration/SR',
  },
};

type FetchBibleTextPart =
  | string
  | {
      type: string;
      contents?: unknown;
    };

interface FetchBiblePlainTextBook {
  book: string;
  contents: FetchBibleTextPart[][][];
}

export interface OriginalLanguageVerse {
  text: string;
  language: string;
  textDirection: 'ltr' | 'rtl';
  edition: string;
  attribution: string;
  sourceUrl: string;
}

const originalLanguageBookCache = new Map<
  string,
  Promise<FetchBiblePlainTextBook>
>();

export const SUPPORTED_TRANSLATIONS = [
  { id: 'BSB', name: 'BSB', lang: 'en' },
  { id: 'eng_kjv', name: 'KJV', lang: 'en' },
  { id: 'cmn_cuv', name: '和合本', lang: 'zh' },
  { id: 'cmn_cu1', name: '和合本', lang: 'zh-cn' },
  { id: 'spa_r09', name: 'RVR09', lang: 'es' },
];

/**
 * Maps application language codes to their default Bible translation IDs.
 */
export const DEFAULT_TRANSLATION_MAP: Record<SupportedLanguage, string> = {
  en: 'BSB',
  zh: 'cmn_cuv',
  'zh-cn': 'cmn_cu1',
  es: 'spa_r09',
};

/**
 * Maps translation IDs to their specific liturgical/poetic marker detection patterns.
 *
 * The patterns are strictly anchored to ensure we only identify standalone tokens
 * as liturgical markers. This prevents an entire verse from being right-aligned
 * just because it contains a specific word.
 *
 * Regex Breakdown:
 * - ^\s* ... \s*$: Matches the start and end of the string to isolate the token.
 * - [\uff08(]: Matches both ASCII '(' and Chinese full-width '（' parentheses.
 * - [\uff09)]: Matches both ASCII ')' and Chinese full-width '）' parentheses.
 * - [.,;!?]?: Accounts for optional trailing punctuation.
 *
 * Version Rules:
 * - spa_r09: Specific to Reina-Valera 1909 (uses "Selah" and "Higaion").
 * - cmn_cuv/cu1: Strictly matches the traditional/simplified transliteration of "Selah".
 */
export const SELAH_PATTERNS: Record<string, RegExp> = {
  BSB: /^\s*[\uff08(]?\s*(Higgaion(?:[.,;!?]?\s+Selah)?|Selah)\s*[.,;!?]?\s*[\uff09)]?\s*[.,;!?]?\s*$/i,
  eng_kjv:
    /^\s*[\uff08(]?\s*(Higgaion(?:[.,;!?]?\s+Selah)?|Selah)\s*[.,;!?]?\s*[\uff09)]?\s*[.,;!?]?\s*$/i,
  spa_r09:
    /^\s*[\uff08(]?\s*(Higaion(?:[.,;!?]?\s+Selah)?|Selah)\s*[.,;!?]?\s*[\uff09)]?\s*[.,;!?]?\s*$/i,
  cmn_cuv: /^\s*[\uff08(]?\s*(細拉)\s*[\uff09)]?[.,;!?]?\s*$/,
  cmn_cu1: /^\s*[\uff08(]?\s*(细拉)\s*[\uff09)]?[.,;!?]?\s*$/,
  default:
    /^\s*[\uff08(]?\s*(Higgaion(?:[.,;!?]?\s+Selah)?|Selah)\s*[.,;!?]?\s*[\uff09)]?\s*[.,;!?]?\s*$/i,
};

/**
 * Maps human-readable book names to USFM 3-letter IDs.
 */
const BOOK_NAME_TO_ID: Record<string, string> = {
  Genesis: 'GEN',
  Exodus: 'EXO',
  Leviticus: 'LEV',
  Numbers: 'NUM',
  Deuteronomy: 'DEU',
  Joshua: 'JOS',
  Judges: 'JDG',
  Ruth: 'RUT',
  '1 Samuel': '1SA',
  '2 Samuel': '2SA',
  '1 Kings': '1KI',
  '2 Kings': '2KI',
  '1 Chronicles': '1CH',
  '2 Chronicles': '2CH',
  Ezra: 'EZR',
  Nehemiah: 'NEH',
  Esther: 'EST',
  Job: 'JOB',
  Psalm: 'PSA',
  Psalms: 'PSA',
  Proverbs: 'PRO',
  Ecclesiastes: 'ECC',
  'Song of Solomon': 'SNG',
  Isaiah: 'ISA',
  Jeremiah: 'JER',
  Lamentations: 'LAM',
  Ezekiel: 'EZK',
  Daniel: 'DAN',
  Hosea: 'HOS',
  Joel: 'JOL',
  Amos: 'AMO',
  Obadiah: 'OBA',
  Jonah: 'JON',
  Micah: 'MIC',
  Nahum: 'NAH',
  Habakkuk: 'HAB',
  Zephaniah: 'ZEP',
  Haggai: 'HAG',
  Zechariah: 'ZEC',
  Malachi: 'MAL',
  Matthew: 'MAT',
  Mark: 'MRK',
  Luke: 'LUK',
  John: 'JHN',
  Acts: 'ACT',
  Romans: 'ROM',
  '1 Corinthians': '1CO',
  '2 Corinthians': '2CO',
  Galatians: 'GAL',
  Ephesians: 'EPH',
  Philippians: 'PHP',
  Colossians: 'COL',
  '1 Thessalonians': '1TH',
  '2 Thessalonians': '2TH',
  '1 Timothy': '1TI',
  '2 Timothy': '2TI',
  Titus: 'TIT',
  Philemon: 'PHM',
  Hebrews: 'HEB',
  James: 'JAS',
  '1 Peter': '1PE',
  '2 Peter': '2PE',
  '1 John': '1JN',
  '2 John': '2JN',
  '3 John': '3JN',
  Jude: 'JUD',
  Revelation: 'REV',
};

/** Canonical book labels used when a reference must follow the app language. */
export const BIBLE_BOOK_NAMES: Record<string, Record<SupportedLanguage, string>> = {
  GEN: { en: 'Genesis', zh: '創世記', 'zh-cn': '创世记', es: 'Génesis' },
  EXO: { en: 'Exodus', zh: '出埃及記', 'zh-cn': '出埃及记', es: 'Éxodo' },
  LEV: { en: 'Leviticus', zh: '利未記', 'zh-cn': '利未记', es: 'Levítico' },
  NUM: { en: 'Numbers', zh: '民數記', 'zh-cn': '民数记', es: 'Números' },
  DEU: { en: 'Deuteronomy', zh: '申命記', 'zh-cn': '申命记', es: 'Deuteronomio' },
  JOS: { en: 'Joshua', zh: '約書亞記', 'zh-cn': '约书亚记', es: 'Josué' },
  JDG: { en: 'Judges', zh: '士師記', 'zh-cn': '士师记', es: 'Jueces' },
  RUT: { en: 'Ruth', zh: '路得記', 'zh-cn': '路得记', es: 'Rut' },
  '1SA': { en: '1 Samuel', zh: '撒母耳記上', 'zh-cn': '撒母耳记上', es: '1 Samuel' },
  '2SA': { en: '2 Samuel', zh: '撒母耳記下', 'zh-cn': '撒母耳记下', es: '2 Samuel' },
  '1KI': { en: '1 Kings', zh: '列王紀上', 'zh-cn': '列王纪上', es: '1 Reyes' },
  '2KI': { en: '2 Kings', zh: '列王紀下', 'zh-cn': '列王纪下', es: '2 Reyes' },
  '1CH': { en: '1 Chronicles', zh: '歷代志上', 'zh-cn': '历代志上', es: '1 Crónicas' },
  '2CH': { en: '2 Chronicles', zh: '歷代志下', 'zh-cn': '历代志下', es: '2 Crónicas' },
  EZR: { en: 'Ezra', zh: '以斯拉記', 'zh-cn': '以斯拉记', es: 'Esdras' },
  NEH: { en: 'Nehemiah', zh: '尼希米記', 'zh-cn': '尼希米记', es: 'Nehemías' },
  EST: { en: 'Esther', zh: '以斯帖記', 'zh-cn': '以斯帖记', es: 'Ester' },
  JOB: { en: 'Job', zh: '約伯記', 'zh-cn': '约伯记', es: 'Job' },
  PSA: { en: 'Psalms', zh: '詩篇', 'zh-cn': '诗篇', es: 'Salmos' },
  PRO: { en: 'Proverbs', zh: '箴言', 'zh-cn': '箴言', es: 'Proverbios' },
  ECC: { en: 'Ecclesiastes', zh: '傳道書', 'zh-cn': '传道书', es: 'Eclesiastés' },
  SNG: { en: 'Song of Solomon', zh: '雅歌', 'zh-cn': '雅歌', es: 'Cantares' },
  ISA: { en: 'Isaiah', zh: '以賽亞書', 'zh-cn': '以赛亚书', es: 'Isaías' },
  JER: { en: 'Jeremiah', zh: '耶利米書', 'zh-cn': '耶利米书', es: 'Jeremías' },
  LAM: { en: 'Lamentations', zh: '耶利米哀歌', 'zh-cn': '耶利米哀歌', es: 'Lamentaciones' },
  EZK: { en: 'Ezekiel', zh: '以西結書', 'zh-cn': '以西结书', es: 'Ezequiel' },
  DAN: { en: 'Daniel', zh: '但以理書', 'zh-cn': '但以理书', es: 'Daniel' },
  HOS: { en: 'Hosea', zh: '何西阿書', 'zh-cn': '何西阿书', es: 'Oseas' },
  JOL: { en: 'Joel', zh: '約珥書', 'zh-cn': '约珥书', es: 'Joel' },
  AMO: { en: 'Amos', zh: '阿摩司書', 'zh-cn': '阿摩司书', es: 'Amós' },
  OBA: { en: 'Obadiah', zh: '俄巴底亞書', 'zh-cn': '俄巴底亚书', es: 'Abdías' },
  JON: { en: 'Jonah', zh: '約拿書', 'zh-cn': '约拿书', es: 'Jonás' },
  MIC: { en: 'Micah', zh: '彌迦書', 'zh-cn': '弥迦书', es: 'Miqueas' },
  NAH: { en: 'Nahum', zh: '那鴻書', 'zh-cn': '那鸿书', es: 'Nahúm' },
  HAB: { en: 'Habakkuk', zh: '哈巴谷書', 'zh-cn': '哈巴谷书', es: 'Habacuc' },
  ZEP: { en: 'Zephaniah', zh: '西番雅書', 'zh-cn': '西番雅书', es: 'Sofonías' },
  HAG: { en: 'Haggai', zh: '哈該書', 'zh-cn': '哈该书', es: 'Hageo' },
  ZEC: { en: 'Zechariah', zh: '撒迦利亞書', 'zh-cn': '撒迦利亚书', es: 'Zacarías' },
  MAL: { en: 'Malachi', zh: '瑪拉基書', 'zh-cn': '玛拉基书', es: 'Malaquías' },
  MAT: { en: 'Matthew', zh: '馬太福音', 'zh-cn': '马太福音', es: 'Mateo' },
  MRK: { en: 'Mark', zh: '馬可福音', 'zh-cn': '马可福音', es: 'Marcos' },
  LUK: { en: 'Luke', zh: '路加福音', 'zh-cn': '路加福音', es: 'Lucas' },
  JHN: { en: 'John', zh: '約翰福音', 'zh-cn': '约翰福音', es: 'Juan' },
  ACT: { en: 'Acts', zh: '使徒行傳', 'zh-cn': '使徒行传', es: 'Hechos' },
  ROM: { en: 'Romans', zh: '羅馬書', 'zh-cn': '罗马书', es: 'Romanos' },
  '1CO': { en: '1 Corinthians', zh: '哥林多前書', 'zh-cn': '哥林多前书', es: '1 Corintios' },
  '2CO': { en: '2 Corinthians', zh: '哥林多後書', 'zh-cn': '哥林多后书', es: '2 Corintios' },
  GAL: { en: 'Galatians', zh: '加拉太書', 'zh-cn': '加拉太书', es: 'Gálatas' },
  EPH: { en: 'Ephesians', zh: '以弗所書', 'zh-cn': '以弗所书', es: 'Efesios' },
  PHP: { en: 'Philippians', zh: '腓立比書', 'zh-cn': '腓立比书', es: 'Filipenses' },
  COL: { en: 'Colossians', zh: '歌羅西書', 'zh-cn': '歌罗西书', es: 'Colosenses' },
  '1TH': { en: '1 Thessalonians', zh: '帖撒羅尼迦前書', 'zh-cn': '帖撒罗尼迦前书', es: '1 Tesalonicenses' },
  '2TH': { en: '2 Thessalonians', zh: '帖撒羅尼迦後書', 'zh-cn': '帖撒罗尼迦后书', es: '2 Tesalonicenses' },
  '1TI': { en: '1 Timothy', zh: '提摩太前書', 'zh-cn': '提摩太前书', es: '1 Timoteo' },
  '2TI': { en: '2 Timothy', zh: '提摩太後書', 'zh-cn': '提摩太后书', es: '2 Timoteo' },
  TIT: { en: 'Titus', zh: '提多書', 'zh-cn': '提多书', es: 'Tito' },
  PHM: { en: 'Philemon', zh: '腓利門書', 'zh-cn': '腓利门书', es: 'Filemón' },
  HEB: { en: 'Hebrews', zh: '希伯來書', 'zh-cn': '希伯来书', es: 'Hebreos' },
  JAS: { en: 'James', zh: '雅各書', 'zh-cn': '雅各书', es: 'Santiago' },
  '1PE': { en: '1 Peter', zh: '彼得前書', 'zh-cn': '彼得前书', es: '1 Pedro' },
  '2PE': { en: '2 Peter', zh: '彼得後書', 'zh-cn': '彼得后书', es: '2 Pedro' },
  '1JN': { en: '1 John', zh: '約翰一書', 'zh-cn': '约翰一书', es: '1 Juan' },
  '2JN': { en: '2 John', zh: '約翰二書', 'zh-cn': '约翰二书', es: '2 Juan' },
  '3JN': { en: '3 John', zh: '約翰三書', 'zh-cn': '约翰三书', es: '3 Juan' },
  JUD: { en: 'Jude', zh: '猶大書', 'zh-cn': '犹大书', es: 'Judas' },
  REV: { en: 'Revelation', zh: '啟示錄', 'zh-cn': '启示录', es: 'Apocalipsis' },
};

export type ParsedScriptureReference = {
  bookId: string;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
};

export const DEFAULT_SCRIPTURE_REFERENCE: ParsedScriptureReference = Object.freeze({
  bookId: 'GEN',
  chapter: 1,
  verseStart: 1,
  verseEnd: 1,
});

const normalizeBookName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en');

const BOOK_ALIAS_TO_ID = Object.entries(BIBLE_BOOK_NAMES).reduce<Record<string, string>>(
  (aliases, [bookId, names]) => {
    Object.values(names).forEach((name) => {
      aliases[normalizeBookName(name)] = bookId;
    });
    return aliases;
  },
  Object.entries(BOOK_NAME_TO_ID).reduce<Record<string, string>>(
    (aliases, [name, bookId]) => {
      aliases[normalizeBookName(name)] = bookId;
      return aliases;
    },
    {
      ps: 'PSA',
      psa: 'PSA',
      psalm: 'PSA',
    },
  ),
);

/**
 * Parses one same-chapter scripture reference into a canonical USFM book ID,
 * chapter, and optional verse range. Book names may be entered in any app
 * language; common colon and dash variants are accepted.
 */
export const parseScriptureReference = (
  ref?: string,
): ParsedScriptureReference | null => {
  if (!ref) return null;

  const withoutTranslation = ref.trim().replace(/\s*\([^)]*\)\s*$/, '');
  const match = withoutTranslation.match(
    /^(.+?)\s*(\d+)\s*(?:[:：]\s*(\d+)(?:\s*[-–—]\s*(\d+))?)?$/u,
  );

  if (!match) return null;

  const name = normalizeBookName(match[1]);
  const chapter = parseInt(match[2], 10);
  const verseStart = match[3] ? parseInt(match[3], 10) : undefined;
  const verseEnd = match[4] ? parseInt(match[4], 10) : verseStart;

  const bookId = BOOK_ALIAS_TO_ID[name];
  if (
    !bookId ||
    !Number.isInteger(chapter) ||
    chapter < 1 ||
    (verseStart !== undefined && verseStart < 1) ||
    (verseEnd !== undefined && (verseEnd < 1 || verseEnd < verseStart!))
  ) {
    return null;
  }

  return { bookId, chapter, verseStart, verseEnd };
};

export const resolveScriptureReference = (reference?: string) =>
  parseScriptureReference(reference) || DEFAULT_SCRIPTURE_REFERENCE;

export const formatScriptureReference = (
  reference: ParsedScriptureReference,
  language: SupportedLanguage,
) => {
  const bookName = BIBLE_BOOK_NAMES[reference.bookId]?.[language];
  if (!bookName) return null;

  const verses = reference.verseStart
    ? `:${reference.verseStart}${
        reference.verseEnd && reference.verseEnd !== reference.verseStart
          ? `-${reference.verseEnd}`
          : ''
      }`
    : '';
  return `${bookName} ${reference.chapter}${verses}`;
};

export const getScriptureReaderParams = (
  reference: ParsedScriptureReference,
  language: SupportedLanguage,
) => ({
  translationId: DEFAULT_TRANSLATION_MAP[language],
  bookId: reference.bookId,
  chapter: String(reference.chapter),
  ...(reference.verseStart
    ? {
        verseStart: String(reference.verseStart),
        verseEnd: String(reference.verseEnd || reference.verseStart),
      }
    : {}),
});

export interface Translation {
  id: string;
  name: string;
  englishName: string;
  language: string;
  languageName?: string;
  textDirection: 'ltr' | 'rtl';
  attribution?: string;
}

export interface TranslationBook {
  id: string;
  name: string;
  commonName: string;
  title: string | null;
  numberOfChapters: number;
  totalNumberOfVerses: number;
}

/**
 * Complex Chapter Content Types
 * These allow us to handle headings, footnotes, and poetry correctly in the UI.
 */
export type ChapterContent =
  | ChapterHeading
  | ChapterLineBreak
  | ChapterVerse
  | ChapterHebrewSubtitle;

export interface ChapterHeading {
  type: 'heading';
  content: string[];
}

export interface ChapterLineBreak {
  type: 'line_break';
}

export interface ChapterHebrewSubtitle {
  type: 'hebrew_subtitle';
  content: (string | FormattedText | VerseFootnoteReference)[];
}

export interface ChapterVerse {
  type: 'verse';
  number: number;
  content: (
    | string
    | FormattedText
    | InlineHeading
    | InlineLineBreak
    | VerseFootnoteReference
  )[];
}

export interface FormattedText {
  text: string;
  poem?: number;
}

export interface InlineHeading {
  heading: string;
}

export interface InlineLineBreak {
  lineBreak: true;
}

export interface VerseFootnoteReference {
  noteId: number;
}

export interface ChapterFootnote {
  noteId: number;
  text: string;
  caller: '+' | string | null;
  reference?: {
    chapter: number;
    verse: number;
  };
}

export interface ChapterData {
  number: number;
  content: ChapterContent[];
  footnotes: ChapterFootnote[];
}

/**
 * The audio links for a book chapter.
 * Maps reader names to their respective audio file URLs.
 */
export interface TranslationBookChapterAudioLinks {
  [reader: string]: string;
}

export interface TranslationBookChapter {
  translation: Translation;
  book: TranslationBook;
  thisChapterLink: string;
  thisChapterAudioLinks: TranslationBookChapterAudioLinks;
  nextChapterApiLink: string | null;
  nextChapterAudioLinks: TranslationBookChapterAudioLinks | null;
  previousChapterApiLink: string | null;
  previousChapterAudioLinks: TranslationBookChapterAudioLinks | null;
  numberOfVerses: number;
  chapter: ChapterData;
}

interface FetchBibleTranslatedEdition {
  resourceId: string;
  name: string;
  englishName: string;
  language: string;
  attribution: string;
}

/**
 * These are the same public-domain editions previously loaded from HelloAO.
 * fetch(bible's normalized resources are authoritative for their source text
 * and translation-footnote metadata.
 */
const FETCH_BIBLE_TRANSLATED_EDITIONS: Record<
  string,
  FetchBibleTranslatedEdition
> = {
  cmn_cuv: {
    resourceId: 'cmn_cut',
    name: '新標點和合本',
    englishName: 'Chinese Union Version (traditional)',
    language: 'cmn',
    attribution: 'Public domain. Text provided by fetch(bible).',
  },
  cmn_cu1: {
    resourceId: 'cmn_cus',
    name: '新标点和合本',
    englishName: 'Chinese Union Version (simplified)',
    language: 'cmn',
    attribution: 'Public domain. Text provided by fetch(bible).',
  },
  spa_r09: {
    resourceId: 'spa_rv',
    name: 'Reina Valera',
    englishName: 'Reina-Valera 1909',
    language: 'spa',
    attribution: 'Public domain. Text provided by fetch(bible).',
  },
};

const translatedBibleBookCache = new Map<
  string,
  Promise<FetchBiblePlainTextBook>
>();
const translationBookListCache = new Map<
  string,
  Promise<TranslationBook[]>
>();

/**
 * Dataset (Cross-Reference) Types
 */
export interface DatasetReference {
  book: string;
  chapter: number;
  verse: number;
  endVerse?: number;
  score?: number;
}

export interface DatasetVerse {
  verse: number;
  references: DatasetReference[];
}

/**
 * Fetches all available translations.
 *
 * @returns {Promise<Translation[]>} A list of available Bible translations.
 */
export async function fetchAvailableTranslations() {
  try {
    const res = await fetch(`${API_BASE}/available_translations.json`);
    if (!res.ok) {
      throw new Error(`Failed to fetch translations: ${res.status}`);
    }
    const data = await res.json();
    return data.translations;
  } catch (e) {
    console.error('Failed to load available translations', e);
    throw e;
  }
}

/**
 * Returns a random book and a random chapter number within that book's bounds.
 * Useful for implementing "Random Verse" features.
 *
 * @param books - The list of available books.
 */
export function selectRandomChapter(books: TranslationBook[]) {
  if (!books || books.length === 0) return null;
  const book = books[Math.floor(Math.random() * books.length)];
  const chapter = Math.floor(Math.random() * book.numberOfChapters) + 1;
  return { book, chapter };
}

/**
 * Fetches the list of books available for a specific translation.
 *
 * @param {string} translation - The ID of the translation. Standard: Uppercase ID.
 * @example fetchBooks('BSB')
 * @returns {Promise<TranslationBook[]>}
 */
export async function fetchBooks(translation: string): Promise<TranslationBook[]> {
  let request = translationBookListCache.get(translation);
  if (!request) {
    request = fetch(`${API_BASE}/${translation}/books.json`).then(async (res) => {
      if (!res.ok) {
        throw new Error(`Failed to fetch books for ${translation}: ${res.status}`);
      }
      const data = await res.json();
      return data.books as TranslationBook[];
    });
    translationBookListCache.set(translation, request);
    request.catch(() => translationBookListCache.delete(translation));
  }

  try {
    return await request;
  } catch (e) {
    console.error(`Failed to load Bible books for ${translation}`, e);
    throw e;
  }
}

/**
 * Determines if a string contains a liturgical or poetic marker (like Selah)
 * based on the specific translation rules.
 *
 * This is used by the UI to segment verses, allowing these markers to be
 * rendered as block-level, right-aligned elements.
 *
 * @param translationId - The ID of the current Bible translation.
 * @param text - The text string to check.
 */
export function isSelahMarker(translationId: string, text: string): boolean {
  const pattern = SELAH_PATTERNS[translationId] || SELAH_PATTERNS.default;
  return pattern.test(text);
}

/**
 * Checks if a string starts with whitespace, a newline, or common punctuation.
 * Used to determine if a space needs to be injected after a footnote to prevent
 * "welded" words (e.g., preventing "allywith" instead of "ally with").
 */
export function startsWithPunctuationOrSpace(text: string): boolean {
  const pattern = /^[\s\n.,;!?:'\"\uff1b\uff1f\u3002\uff0c\uff1a\uff09)]/;
  return pattern.test(text);
}

/**
 * Segments a text string into leading whitespace/newlines, a core word/phrase,
 * trailing punctuation (including CJK full-width), and trailing breaking space.
 *
 * Used by the UI to apply specific treatments (like underlining) to the core word
 * while keeping punctuation and layout whitespace visually distinct.
 */
export function segmentText(text: string) {
  const match = text.match(
    /^([\s\n]*)(.*?)(([.,;!?:'\"\uff1b\uff1f\u3002\uff0c\uff1a\uff09)]*)(\s*))$/,
  );
  return {
    leading: match ? match[1] : '',
    core: match ? match[2] : text,
    trailingPunct: match ? match[4] : '',
    trailingSpace: match ? match[5] : '',
  };
}

/**
 * Converts a structured verse object into a formatted plain-text string.
 * This preserves poetic indentation, line breaks, and handles liturgical markers (Selah)
 * consistently across the app.
 */
export function renderVerseToPlainText(
  translationId: string,
  verse: ChapterVerse,
): string {
  let result = '';
  verse.content.forEach((item, i) => {
    // 1. Skip metadata/footnotes
    if (typeof item === 'object' && item !== null && 'noteId' in item) return;

    // 2. Handle explicit line breaks
    if (typeof item === 'object' && item !== null && 'lineBreak' in item) {
      result += '\n';
      return;
    }

    const textValue = typeof item === 'string' ? item : (item as any).text || '';
    const isPoetic = typeof item === 'object' && item !== null && 'poem' in item;
    const isSelah = isSelahMarker(translationId, textValue);

    const prevItem = i > 0 ? verse.content[i - 1] : null;
    const prevIsLineBreak = !!(
      prevItem &&
      typeof prevItem === 'object' &&
      'lineBreak' in prevItem
    );

    // Calculate Poetic Continuity
    let isLineContinuation = false;
    let foundPreviousContent = false;

    if (isPoetic && i > 0 && !prevIsLineBreak) {
      let skippedInterruption = false;
      for (let k = i - 1; k >= 0; k--) {
        const prev = verse.content[k];
        const isMetadata = typeof prev === 'object' && prev !== null && 'noteId' in prev;
        const isWhitespace = typeof prev === 'string' && prev.trim().length === 0;

        if (isMetadata || isWhitespace) {
          skippedInterruption = true;
          continue;
        }

        foundPreviousContent = true;
        const prevIsPoetic = typeof prev === 'object' && prev !== null && 'poem' in prev;
        const prevText = typeof prev === 'string' ? prev : (prev as any)?.text || '';
        const prevIsSelah = isSelahMarker(translationId, prevText);

        if (
          prevIsPoetic &&
          !prevIsSelah &&
          (prev as any).poem === (item as any).poem &&
          skippedInterruption &&
          !textValue.startsWith('\n')
        ) {
          isLineContinuation = true;
        }
        break;
      }
      if (!foundPreviousContent) isLineContinuation = false;
    }

    const followsFootnote = !!(
      prevItem &&
      typeof prevItem === 'object' &&
      'noteId' in prevItem
    );
    let contentText = textValue;

    const willAddPoeticNewLine =
      isPoetic &&
      !isLineContinuation &&
      i > 0 &&
      foundPreviousContent &&
      !prevIsLineBreak;
    const willAddSelahNewLine = isSelah && i > 0 && !prevIsLineBreak;

    if (
      (followsFootnote || isSelah) &&
      !(isPoetic && !isLineContinuation && i > 0) &&
      !willAddPoeticNewLine &&
      !willAddSelahNewLine &&
      contentText.length > 0 &&
      !startsWithPunctuationOrSpace(contentText)
    ) {
      contentText = ' ' + contentText;
    }

    if (isSelah) {
      result += (i > 0 && !prevIsLineBreak ? '\n' : '') + contentText;
    } else if (isPoetic) {
      const indentCount = (item as any).poem > 1 ? (item as any).poem - 1 : 0;
      const indent = '\u00A0'.repeat(indentCount * 3);
      const prefix =
        (i > 0 &&
        foundPreviousContent &&
        !isLineContinuation &&
        !isSelah &&
        !prevIsLineBreak
          ? '\n'
          : '') + (!isLineContinuation ? indent : '');
      result += prefix + contentText;
    } else {
      result += contentText;
    }
  });
  return result.replace(/^\n+/, '').trimEnd();
}

const fetchBibleMetadataText = (contents: unknown): string => {
  if (typeof contents === 'string') return contents;
  if (Array.isArray(contents)) {
    return contents.map(fetchBibleMetadataText).join('');
  }
  return '';
};

const normalizeFetchBibleText = (text: string): string =>
  text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/^\n+|\n+$/g, '');

const stripFetchBibleNoteReference = (
  text: string,
  chapter: number,
  verse: number,
): string => {
  const withoutReference = text.replace(
    new RegExp(`^\\s*${chapter}[.:]${verse}\\s*`),
    '',
  );
  return withoutReference || text;
};

async function fetchTranslatedBibleBook(
  resourceId: string,
  book: string,
): Promise<FetchBiblePlainTextBook> {
  const normalizedBook = book.toLowerCase();
  const cacheKey = `${resourceId}:${normalizedBook}`;
  let request = translatedBibleBookCache.get(cacheKey);

  if (!request) {
    request = fetch(
      `${FETCH_BIBLE_BASE}/${resourceId}/txt/${normalizedBook}.json`,
    ).then(async (response) => {
      if (!response.ok) {
        throw new Error(
          `Failed to fetch ${resourceId} book ${book}: ${response.status}`,
        );
      }
      return (await response.json()) as FetchBiblePlainTextBook;
    });
    translatedBibleBookCache.set(cacheKey, request);
    request.catch(() => translatedBibleBookCache.delete(cacheKey));
  }

  return request;
}

async function fetchChapterFromFetchBible(
  translationId: string,
  edition: FetchBibleTranslatedEdition,
  bookId: string,
  chapterNumber: number,
): Promise<TranslationBookChapter> {
  const [sourceBook, books] = await Promise.all([
    fetchTranslatedBibleBook(edition.resourceId, bookId),
    fetchBooks(translationId),
  ]);
  const book = books.find((candidate) => candidate.id === bookId.toUpperCase());
  const sourceChapter = sourceBook.contents?.[chapterNumber];

  if (!book) {
    throw new Error(`Book ${bookId} is unavailable for ${translationId}`);
  }
  if (!Array.isArray(sourceChapter)) {
    throw new Error(`Chapter ${bookId} ${chapterNumber} is unavailable`);
  }

  const content: ChapterContent[] = [];
  const footnotes: ChapterFootnote[] = [];
  let numberOfVerses = 0;

  for (let verseNumber = 1; verseNumber < sourceChapter.length; verseNumber++) {
    const sourceVerse = sourceChapter[verseNumber];
    if (!Array.isArray(sourceVerse)) continue;

    const verseContent: ChapterVerse['content'] = [];

    for (const part of sourceVerse) {
      if (typeof part === 'string') {
        const text = normalizeFetchBibleText(part);
        if (text) verseContent.push(text);
        continue;
      }

      const metadataText = fetchBibleMetadataText(part.contents).trim();
      if (part.type === 'heading') {
        if (metadataText) content.push({ type: 'heading', content: [metadataText] });
        continue;
      }

      if (part.type === 'note') {
        const noteId = footnotes.length;
        verseContent.push({ noteId });
        footnotes.push({
          noteId,
          caller: String(noteId + 1),
          text: stripFetchBibleNoteReference(
            metadataText,
            chapterNumber,
            verseNumber,
          ),
          reference: { chapter: chapterNumber, verse: verseNumber },
        });
      }
    }

    content.push({
      type: 'verse',
      number: verseNumber,
      content: normalizeContentSequence(
        verseContent.length > 0 ? verseContent : [''],
      ),
    });
    numberOfVerses = verseNumber;
  }

  const translation: Translation = {
    id: translationId,
    name: edition.name,
    englishName: edition.englishName,
    language: edition.language,
    textDirection: 'ltr',
    attribution: edition.attribution,
  };
  const thisChapterLink = `${FETCH_BIBLE_BASE}/${edition.resourceId}/txt/${bookId.toLowerCase()}.json`;

  return {
    translation,
    book,
    thisChapterLink,
    thisChapterAudioLinks: {},
    nextChapterApiLink: null,
    nextChapterAudioLinks: null,
    previousChapterApiLink: null,
    previousChapterAudioLinks: null,
    numberOfVerses,
    chapter: { number: chapterNumber, content, footnotes },
  };
}

/**
 * Fetches the verses for a specific chapter in a specific translation and book.
 *
 * @param {string} translation - The ID of the translation. Standard: Uppercase ID.
 * @param {string} book - The ID of the book. Standard: USFM 3-letter ID (e.g., 'GEN').
 * @param {number} chapter - The numerical chapter. Standard: 1-based integer.
 * @example fetchChapter('BSB', 'GEN', 1)
 * @returns {Promise<TranslationBookChapter>}
 */
export async function fetchChapter(
  translation: string,
  book: string,
  chapter: number,
): Promise<TranslationBookChapter> {
  try {
    const fetchBibleEdition = FETCH_BIBLE_TRANSLATED_EDITIONS[translation];
    if (fetchBibleEdition) {
      return await fetchChapterFromFetchBible(
        translation,
        fetchBibleEdition,
        book,
        chapter,
      );
    }

    const res = await fetch(`${API_BASE}/${translation}/${book}/${chapter}.json`);
    if (!res.ok) {
      throw new Error(`Failed to fetch chapter: ${res.status}`);
    }
    const data: TranslationBookChapter = await res.json();

    // Normalize content sequences to ensure punctuation stays anchored to words
    // even when separated by metadata objects (like footnotes), and to preserve
    // meaningful whitespace and newlines for poetic formatting.
    if (data.chapter?.content) {
      data.chapter.content = data.chapter.content.map((item) => {
        if (item.type === 'verse' || item.type === 'hebrew_subtitle') {
          return {
            ...item,
            content: normalizeContentSequence(item.content),
          };
        }
        return item;
      });
    }

    return data;
  } catch (e) {
    console.error(`Failed to load chapter ${book} ${chapter}`, e);
    throw e;
  }
}

/**
 * Fetches a verse from an open original-language critical edition.
 *
 * The lookup uses the canonical USFM book id and chapter/verse numbers, so it
 * is independent of whichever translated language is currently displayed.
 * fetch(bible)'s normalized plain-text format uses lowercase USFM book ids and
 * array indexes that correspond to the familiar 1-based chapter/verse numbers.
 * Whole-book responses are cached because the CDN exposes one file per book.
 *
 * LICENSE NOTE: The selected texts are CC BY 4.0, not public domain. Preserve
 * their attribution and license documentation when displaying or reusing this
 * result. This function removes separate note objects and normalizes layout
 * whitespace for display; README.md explicitly discloses those presentation
 * changes as required by the license.
 */
export async function fetchOriginalLanguageVerse(
  book: string,
  chapter: number,
  verse: number,
): Promise<OriginalLanguageVerse> {
  if (
    !Number.isInteger(chapter) ||
    chapter < 1 ||
    !Number.isInteger(verse) ||
    verse < 1
  ) {
    throw new Error('Chapter and verse must be positive integers');
  }

  const normalizedBook = book.toUpperCase();
  const source = OLD_TESTAMENT_BOOK_IDS.has(normalizedBook)
    ? ORIGINAL_LANGUAGE_EDITIONS.oldTestament
    : ORIGINAL_LANGUAGE_EDITIONS.newTestament;
  const fetchBibleBookId = normalizedBook.toLowerCase();
  const cacheKey = `${source.id}:${fetchBibleBookId}`;

  let request = originalLanguageBookCache.get(cacheKey);
  if (!request) {
    request = fetch(
      `${FETCH_BIBLE_BASE}/${source.id}/txt/${fetchBibleBookId}.json`,
    ).then(async (response) => {
      if (!response.ok) {
        throw new Error(
          `Failed to fetch original-language book ${normalizedBook}: ${response.status}`,
        );
      }
      return (await response.json()) as FetchBiblePlainTextBook;
    });
    originalLanguageBookCache.set(cacheKey, request);
    request.catch(() => originalLanguageBookCache.delete(cacheKey));
  }

  const data = await request;
  const verseParts = data.contents?.[chapter]?.[verse];
  if (!Array.isArray(verseParts)) {
    throw new Error(
      `Original-language verse not found: ${normalizedBook} ${chapter}:${verse}`,
    );
  }

  // Notes are separate objects in fetch(bible)'s plain-text payload. The main
  // strings retain the edition's textual sigla; only layout whitespace is
  // collapsed so Greek word-per-line data reads naturally in the popup.
  const text = verseParts
    .filter((part): part is string => typeof part === 'string')
    .join('')
    .replace(/\s+/gu, ' ')
    .trim();

  if (!text) {
    throw new Error(
      `Original-language verse is empty: ${normalizedBook} ${chapter}:${verse}`,
    );
  }

  return {
    text,
    language: source.language,
    textDirection: source.textDirection,
    edition: source.edition,
    attribution: source.attribution,
    sourceUrl: source.sourceUrl,
  };
}

/**
 * Corrects tokenization artifacts where punctuation or whitespace is separated
 * from its parent word by footnote markers or metadata objects.
 *
 * 1. Anchors trailing punctuation: If a string segment starts with punctuation
 *    (.,;!?) and follows a footnote marker, it moves that punctuation to the
 *    preceding text node so they remain visually bound.
 * 2. Preserves structure: Ensures explicit newlines and heavy whitespace
 *    are maintained for poetic and right-aligned text blocks.
 */
function normalizeContentSequence(content: any[]): any[] {
  const result: any[] = [];

  for (let i = 0; i < content.length; i++) {
    let current = content[i];

    /**
     * 1. Punctuation Anchoring
     * Look for tokens starting with whitespace/newlines followed by punctuation.
     * If found, we anchor the punctuation back to the word before the footnote,
     * but we "shift" the newline so it remains at the start of the remaining
     * text (like "Selah"), ensuring formatting isn't lost.
     */
    const punctMatch =
      typeof current === 'string' ? current.match(/^([\s]*)([.,;!?:'"]+)/) : null;

    if (punctMatch && result.length > 0) {
      const leadingWhitespace = punctMatch[1];
      const leadingPunct = punctMatch[2];

      let anchorIdx = -1;
      // Scan backwards for the nearest available text node.
      // We MUST stop if we encounter a newline (\n), as punctuation should
      // not be anchored to a word on a different structural line.
      for (let j = result.length - 1; j >= 0; j--) {
        const prev = result[j];
        if (typeof prev === 'string' && prev.includes('\n')) break;
        if (typeof prev === 'string' || (typeof prev === 'object' && 'text' in prev)) {
          anchorIdx = j;
          break;
        }
      }

      if (anchorIdx !== -1) {
        const anchor = result[anchorIdx];
        if (typeof anchor === 'string') {
          // Only trim horizontal whitespace; preserving \n if present in the anchor
          result[anchorIdx] = anchor.replace(/[ \t]+$/, '') + leadingPunct;
        } else {
          result[anchorIdx] = {
            ...anchor,
            text: anchor.text.replace(/[ \t]+$/, '') + leadingPunct,
          };
        }
        // Reconstruct the token: preserve the whitespace (newlines) and strip
        // only the shifted punctuation. This fixes the "welding" (?Selah) bug.
        const remainingText = (current as string).substring(
          leadingWhitespace.length + leadingPunct.length,
        );
        current = leadingWhitespace + remainingText;
      }
    }

    // Add to result while preserving structural whitespace and newlines
    if (current !== '') {
      result.push(current);
    }
  }

  return result;
}

/**
 * Fetches the entire translation (Large Payload).
 *
 * @param {string} translation - The ID of the translation. Standard: Uppercase ID.
 * @example fetchCompleteTranslation('BSB')
 * @returns {Promise<TranslationComplete>}
 */
export async function fetchCompleteTranslation(translation: string) {
  try {
    // TODO: Implement "Download Feature" logic.
    // 1. Fetch this large JSON.
    // 2. Normalize and split into individual chapters.
    // 3. Store in local storage for full offline availability.

    // TODO: Implement offline fallback logic.
    // 1. Check local storage (IndexedDB/LocalForage) for cached chapter data.
    // 2. If found, return cached data immediately to fulfill "Frictionless Access".

    // TODO: Implement fallback even in weak wifi situations where network is up but times out
    // This is notable for situations like underground subway or parking where TCP ACK is received
    // but data transfer is very slow. We can set a reasonable timeout (e.g., 5 seconds) and fallback
    // to cached data if the fetch doesn't complete in time.

    const res = await fetch(`${API_BASE}/${translation}/complete.json`);
    return await res.json();
  } catch (e) {
    console.error(`Failed to load complete translation for ${translation}`, e);
    throw e;
  }
}

/**
 * COMMENTARY APIS
 */

export async function fetchAvailableCommentaries() {
  try {
    const res = await fetch(`${API_BASE}/available_commentaries.json`);
    const data = await res.json();
    return data.commentaries;
  } catch (e) {
    console.error('Failed to load available commentaries', e);
    throw e;
  }
}

/**
 * Fetches the list of books available for a specific commentary.
 *
 * @param {string} commentary - The ID of the commentary. Standard: kebab-case.
 * @example fetchCommentaryBooks('adam-clarke')
 */
export async function fetchCommentaryBooks(commentary: string) {
  try {
    const res = await fetch(`${API_BASE}/c/${commentary}/books.json`);
    const data = await res.json();
    return data.books;
  } catch (e) {
    console.error(`Failed to load commentary books for ${commentary}`, e);
    throw e;
  }
}

/**
 * Fetches the content of a single chapter for a given book and commentary.
 *
 * @param {string} commentary - The ID of the commentary.
 * @param {string} book - The USFM book ID.
 * @param {number} chapter - The 1-based chapter number.
 * @example fetchCommentaryChapter('adam-clarke', 'GEN', 1)
 */
export async function fetchCommentaryChapter(
  commentary: string,
  book: string,
  chapter: number,
) {
  try {
    const res = await fetch(`${API_BASE}/c/${commentary}/${book}/${chapter}.json`);
    const data = await res.json();
    return data.chapter;
  } catch (e) {
    console.error(
      `Failed to load commentary chapter for ${commentary} ${book} ${chapter}`,
      e,
    );
    throw e;
  }
}

/**
 * Gets the list of profiles (overviews of people/groups) for a given commentary.
 *
 * @param {string} commentary - The ID of the commentary (e.g., 'tyndale').
 * @example fetchCommentaryProfiles('tyndale')
 */
export async function fetchCommentaryProfiles(commentary: string) {
  try {
    const res = await fetch(`${API_BASE}/c/${commentary}/profiles.json`);
    const data = await res.json();
    return data.profiles;
  } catch (e) {
    console.error(`Failed to load commentary profiles for ${commentary}`, e);
    throw e;
  }
}

/**
 * Gets a specific profile from a commentary.
 *
 * @param {string} commentary - The ID of the commentary.
 * @param {string} profile - The ID of the profile. Standard: lowercase name/id.
 * @example fetchCommentaryProfileContent('tyndale', 'aaron')
 */
export async function fetchCommentaryProfileContent(commentary: string, profile: string) {
  try {
    const res = await fetch(`${API_BASE}/c/${commentary}/profiles/${profile}.json`);
    return await res.json();
  } catch (e) {
    console.error(`Failed to load profile content for ${profile} in ${commentary}`, e);
    throw e;
  }
}

/**
 * DATASET APIS (e.g., Cross-References)
 */

/** Fetches all available Bible datasets. */
export async function fetchAvailableDatasets() {
  try {
    const res = await fetch(`${API_BASE}/available_datasets.json`);
    const data = await res.json();
    return data.datasets;
  } catch (e) {
    console.error('Failed to load available datasets', e);
    throw e;
  }
}

/**
 * Gets the list of books available for a given dataset.
 *
 * @param {string} dataset - The ID of the dataset (e.g., 'open-cross-ref').
 */
export async function fetchDatasetBooks(dataset: string) {
  try {
    const res = await fetch(`${API_BASE}/d/${dataset}/books.json`);
    const data = await res.json();
    return data.books;
  } catch (e) {
    console.error(`Failed to load dataset books for ${dataset}`, e);
    throw e;
  }
}

/**
 * Fetches a specific chapter from a dataset (e.g., open-cross-ref).
 *
 * @param {string} dataset - The ID of the dataset.
 * @param {string} book - The USFM book ID.
 * @param {number} chapter - The 1-based chapter number.
 * @example fetchDatasetChapter('open-cross-ref', 'GEN', 1)
 * @returns {Promise<DatasetChapterData>}
 */
export async function fetchDatasetChapter(
  dataset: string,
  book: string,
  chapter: number,
) {
  try {
    const res = await fetch(`${API_BASE}/d/${dataset}/${book}/${chapter}.json`);
    const data = await res.json();
    return data.chapter;
  } catch (e) {
    console.error(`Failed to load dataset chapter for ${dataset} ${book} ${chapter}`, e);
    throw e;
  }
}
