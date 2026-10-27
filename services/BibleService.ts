/**
 * Reads the Bible texts that ship with the app (assets/bible), in HelloAO's and
 * fetch(bible)'s formats: the reader translations and the verse popup's
 * original-language texts. It loads no Bible text over the network.
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

import {
  getChurchHostedAudioLinks,
  hasChurchHostedAudio,
  type TranslationBookChapterAudioLinks,
} from './BibleAudioSources';
import { BIBLE_BOOK_ABBREVIATIONS } from './BibleBookAbbreviations';
import { readBundledBibleFile, type BundledBibleCollection } from './BundledBible';

/** Persisted Bible translation selected by the app language or the user. */
export const BIBLE_TRANSLATION_STORAGE_KEY = 'user-bible-translation';

/**
 * Every Bible text ships with the app (assets/bible), so it opens with no
 * network: the Chinese Union Version (scripts/build-cuv-1919.mjs), and the BSB,
 * Reina-Valera 1909, and the original-language critical editions
 * (scripts/build-bundled-bibles.mjs), built from HelloAO and fetch(bible).
 *
 * IMPORTANT LICENSING DISTINCTION:
 * - fetch(bible offers its CDN without an API key, usage fee, request quota, or
 *   provider-imposed caching limit.
 * - That free service access DOES NOT place every distributed work in the
 *   public domain and DOES NOT replace each work's individual license.
 * - The `hbo_sr` and `grc_sr` editions selected below are CC BY 4.0 works. CC BY
 *   4.0 permits copying, redistribution, adaptation, and commercial use, but
 *   requires appropriate attribution, a license link, and disclosure of
 *   changes. The app ships copies of them, so the church must meet those
 *   conditions, even though fetch(bible itself is free.
 *
 * Do not remove the edition/editor attribution or the license link from the
 * verse-detail UI, or the source/license documentation in docs/LEGAL.md. If either
 * resource id changes, review the replacement work's license rather than
 * assuming that availability through fetch(bible is sufficient permission to
 * redistribute it.
 *
 * Service policy: https://fetch.bible/access/#no-limits-from-us
 * CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
 */
const CC_BY_4 = { license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' };

export const SUPERSCRIPT_CHARACTERS: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
};

export const toSuperscript = (value: string | number): string =>
  Array.from(String(value), (character) => SUPERSCRIPT_CHARACTERS[character] || character).join('');

export const getChapterFootnoteNumber = (
  footnotes: ChapterFootnote[],
  noteId: number,
): number => {
  const footnoteIndex = footnotes.findIndex((footnote) => footnote.noteId === noteId);
  return (footnoteIndex >= 0 ? footnoteIndex : noteId) + 1;
};

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
  'NAM',
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
    collection: 'original/hbo_sr' as const,
    language: 'Hebrew / Aramaic',
    textDirection: 'rtl' as const,
    edition: 'Solid Rock Hebrew Bible',
    attribution: 'Edited by Stephen L. Brown.',
    sourceUrl: 'https://github.com/jjmccollum/solid-rock-hb',
    ...CC_BY_4,
  },
  // CC BY 4.0 source and required attribution:
  // https://github.com/Center-for-New-Testament-Restoration/SR#license
  newTestament: {
    id: 'grc_sr',
    collection: 'original/grc_sr' as const,
    language: 'Koine Greek',
    textDirection: 'ltr' as const,
    edition: 'Statistical Restoration Greek New Testament',
    attribution: 'Edited by Alan Bunning for the Center for New Testament Restoration.',
    sourceUrl: 'https://github.com/Center-for-New-Testament-Restoration/SR',
    ...CC_BY_4,
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
  /** The editor's credit, which CC BY 4.0 requires with the text. */
  attribution: string;
  sourceUrl: string;
  /** The license's name and link, which CC BY 4.0 also requires. */
  license: string;
  licenseUrl: string;
  /** The original's own reference, when it numbers the verse differently. */
  reference?: string;
}

type OriginalVerseRef = readonly [chapter: number, verse: number];

// Numbered the same in the BSB and the Chinese Union Version.
const ENGLISH_NUMBERING: Record<string, readonly OriginalVerseRef[]> = {
  // The Hebrew has no 7:68; its 7:69 holds the horses and mules too.
  'NEH 7:68': [[7, 69]],
  // The Hebrew ends chapter 63 with "Oh, that You would rend the heavens".
  'ISA 64:1': [[63, 19]],
  'ACT 19:41': [[19, 40]],
  // The Greek puts "All the saints greet you" in 13:12, so the grace is 13:13.
  '2CO 13:13': [[13, 12]],
  '2CO 13:14': [[13, 13]],
};

/**
 * Where a translation numbers a verse differently from the original-language
 * editions, the original verses that hold its text. fetch(bible) gives both
 * editions the common English versification, but not everywhere, and the
 * translations differ among themselves: the BSB joins two Greek verses in
 * Revelation 12 and 3 John, and the Reina-Valera 1909 folds five Old Testament
 * verses into the verse before. Every other verse has the same number in both.
 * test/original-language-texts.test.ts checks every verse of every translation
 * against this table.
 */
export const ORIGINAL_VERSE_NUMBERING: Record<string, Record<string, readonly OriginalVerseRef[]>> = {
  BSB: {
    ...ENGLISH_NUMBERING,
    '3JN 1:14': [[1, 14], [1, 15]],
    'REV 12:17': [[12, 17], [12, 18]],
  },
  cmn_cuv: ENGLISH_NUMBERING,
  cmn_cu1: ENGLISH_NUMBERING,
  spa_r09: {
    'NEH 7:68': [[7, 69]],
    'ISA 64:1': [[63, 19]],
    '2SA 20:25': [[20, 25], [20, 26]],
    '2CH 33:24': [[33, 24], [33, 25]],
    'JOB 35:15': [[35, 15], [35, 16]],
    'HOS 14:8': [[14, 8], [14, 9]],
    'ZEC 11:16': [[11, 16], [11, 17]],
    // "Y yo me paré sobre la arena del mar" is the Greek's 12:18.
    'REV 13:1': [[12, 18], [13, 1]],
  },
};

/** "63:19", "12:17–18", or "12:18–13:1". */
const formatOriginalVerseRefs = (refs: readonly OriginalVerseRef[]) => {
  const [[firstChapter, firstVerse]] = refs;
  const [lastChapter, lastVerse] = refs[refs.length - 1];
  if (refs.length === 1) return `${firstChapter}:${firstVerse}`;
  return firstChapter === lastChapter
    ? `${firstChapter}:${firstVerse}–${lastVerse}`
    : `${firstChapter}:${firstVerse}–${lastChapter}:${lastVerse}`;
};

const originalLanguageBookCache = new Map<
  string,
  Promise<FetchBiblePlainTextBook>
>();

export const SUPPORTED_TRANSLATIONS = [
  { id: 'BSB', name: 'BSB', shortName: 'BSB', lang: 'en' },
  { id: 'cmn_cuv', name: 'CUV', shortName: 'CUV', lang: 'zh' },
  { id: 'cmn_cu1', name: 'CUVS', shortName: 'CUVS', lang: 'zh-cn' },
  { id: 'spa_r09', name: 'RVR09', shortName: 'RVR09', lang: 'es' },
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

export const getBibleTranslationLanguageBadge = (language: string) =>
  ({ en: 'EN', zh: '繁', 'zh-cn': '简', es: 'ES' })[language] ||
  language.slice(0, 2).toLocaleUpperCase();

/** Default comparison language: Chinese for English readers, English otherwise. */
export const getDefaultSupportingTranslationId = (
  language: SupportedLanguage,
) => (language === 'en' ? 'cmn_cuv' : 'BSB');

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
  spa_r09:
    /^\s*[\uff08(]?\s*(Higaion(?:[.,;!?]?\s+Selah)?|Selah)\s*[.,;!?]?\s*[\uff09)]?\s*[.,;!?]?\s*$/i,
  // The 1919 text writes 〔細拉〕; （細拉） is the 1988 text's form.
  cmn_cuv: /^\s*[\uff08(\u3014]?\s*(細拉)\s*[\uff09)\u3015]?[.,;!?]?\s*$/,
  cmn_cu1: /^\s*[\uff08(\u3014]?\s*(细拉)\s*[\uff09)\u3015]?[.,;!?]?\s*$/,
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
  Nahum: 'NAM',
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
  NAM: { en: 'Nahum', zh: '那鴻書', 'zh-cn': '那鸿书', es: 'Nahúm' },
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

/** Books where a bare number conventionally identifies a verse, not a chapter. */
const SINGLE_CHAPTER_BOOK_IDS = new Set(['OBA', 'PHM', '2JN', '3JN', 'JUD']);

// Case, accents, dots, the space after a book's number, and a Roman numeral
// for it don't matter, so "1 Co.", "1co" and "I Co" are the same.
const normalizeBookName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en')
    .replace(/^(iii|ii|i) (?=\p{L})/u, (_, numeral: string) => `${numeral.length} `)
    .replace(/^([1-3]) ?(?=\p{L})/u, '$1 ');

const BOOK_ALIAS_TO_ID = Object.entries(BIBLE_BOOK_NAMES).reduce<Record<string, string>>(
  (aliases, [bookId, names]) => {
    // Its names in every app language, its USFM code, and its published short forms.
    [...Object.values(names), bookId, ...(BIBLE_BOOK_ABBREVIATIONS[bookId] ?? [])].forEach((name) => {
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
 * Parses the first usable passage into a canonical USFM book ID, chapter, and
 * optional verse range. Book names may be entered in any app language; common
 * colon and dash variants are accepted. For a one-chapter book, a shorthand
 * such as "Jude 9" means Jude 1:9.
 */
export const parseScriptureReference = (
  ref?: string,
): ParsedScriptureReference | null => {
  if (!ref) return null;

  // Full-width digits and colons, as in 約３：１６, become ASCII ones.
  const withoutTranslation = ref.normalize('NFKC').trim().replace(/\s*\([^)]*\)\s*$/, '');
  // Bulletin entries occasionally contain alternatives or non-contiguous
  // selections. The reader opens the first passage and leaves the remainder as
  // display-only text rather than falling all the way back to Genesis 1:1.
  const firstSelection = withoutTranslation.split(/[;；,，\n]/u, 1)[0].trim();
  const crossChapterStart = firstSelection.match(
    /^(.+?\s*\d+\s*[:：]\s*\d+)\s*[-–—]\s*\d+\s*[:：]\s*\d+/u,
  );
  const candidate = (crossChapterStart?.[1] || firstSelection).trim();

  // "John 3:16", "Jn 3.16" (as Spanish Bibles write it), or "John 3 16".
  const explicitVerse =
    candidate.match(/^(.+?)\s*(\d+)\s*[:：.]\s*(\d+)(?:\s*[-–—]\s*(\d+))?$/u) ||
    candidate.match(/^(.*?\D)\s*(\d+)\s+(\d+)(?:\s*[-–—]\s*(\d+))?$/u);

  if (explicitVerse) {
    const bookId = BOOK_ALIAS_TO_ID[normalizeBookName(explicitVerse[1])];
    const chapter = parseInt(explicitVerse[2], 10);
    const verseStart = parseInt(explicitVerse[3], 10);
    const verseEnd = explicitVerse[4]
      ? parseInt(explicitVerse[4], 10)
      : verseStart;

    if (
      !bookId ||
      chapter < 1 ||
      verseStart < 1 ||
      verseEnd < verseStart
    ) {
      return null;
    }

    return { bookId, chapter, verseStart, verseEnd };
  }

  const bareBookId = BOOK_ALIAS_TO_ID[normalizeBookName(candidate)];
  if (bareBookId) return { bookId: bareBookId, chapter: 1 };

  const chapterOrSingleChapterVerse = candidate.match(
    /^(.+?)\s*(\d+)(?:\s*[-–—]\s*(\d+))?$/u,
  );

  if (!chapterOrSingleChapterVerse) return null;

  const bookId = BOOK_ALIAS_TO_ID[
    normalizeBookName(chapterOrSingleChapterVerse[1])
  ];
  const number = parseInt(chapterOrSingleChapterVerse[2], 10);
  const rangeEnd = chapterOrSingleChapterVerse[3]
    ? parseInt(chapterOrSingleChapterVerse[3], 10)
    : undefined;

  if (!bookId || number < 1 || (rangeEnd !== undefined && rangeEnd < number)) {
    return null;
  }

  if (SINGLE_CHAPTER_BOOK_IDS.has(bookId)) {
    return {
      bookId,
      chapter: 1,
      verseStart: number,
      verseEnd: rangeEnd || number,
    };
  }

  if (rangeEnd !== undefined) return null;

  return { bookId, chapter: number };
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

let scriptureReferenceRequestSequence = 0;

/** Creates a distinct navigation request even when the scripture is unchanged. */
export const createScriptureReferenceRequest = () =>
  `${Date.now()}-${++scriptureReferenceRequestSequence}`;

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
  name: string;
  englishName: string;
  language: string;
  attribution: string;
  /** The text ships with the app, so it opens with no network. */
  bundled: BundledBibleCollection;
}

/**
 * Translated editions in fetch(bible)'s plain-text book format.
 *
 * The Chinese Union Version is the public-domain 1919 text (官話和合譯本, 神
 * edition), bundled with the app. The 1988 New Punctuation edition (新標點和合本)
 * it replaced is © United Bible Societies, and the Hong Kong Bible Society
 * didn't grant permission (#517). The 1919 text comes from WordProject and was
 * checked against Wikisource; see docs/LEGAL.md. Its 〔〕 notes are footnotes in
 * the bundled files (scripts/build-cuv-1919.mjs), so they show as the 1988
 * text's did.
 */
const FETCH_BIBLE_TRANSLATED_EDITIONS: Record<
  string,
  FetchBibleTranslatedEdition
> = {
  cmn_cuv: {
    name: '和合本（1919）',
    englishName: 'Chinese Union Version, 1919 (traditional)',
    language: 'cmn',
    attribution: 'Public domain (1919). Text adapted from WordProject.',
    bundled: 'cuv1919/hant',
  },
  cmn_cu1: {
    name: '和合本（1919）',
    englishName: 'Chinese Union Version, 1919 (simplified)',
    language: 'cmn',
    attribution: 'Public domain (1919). Text adapted from WordProject.',
    bundled: 'cuv1919/hans',
  },
  spa_r09: {
    name: 'Reina Valera',
    englishName: 'Reina-Valera 1909',
    language: 'spa',
    attribution: 'Public domain. Text provided by fetch(bible).',
    bundled: 'rv1909',
  },
};

/**
 * HelloAO translations that ship with the app, built by
 * scripts/build-bundled-bibles.mjs: one file per book holding each chapter as
 * HelloAO's chapter API returns it, so they open with no network.
 */
const BUNDLED_HELLOAO_TRANSLATIONS: Record<string, BundledBibleCollection> = {
  BSB: 'bsb',
};

interface BundledHelloaoBook {
  translation: Translation;
  book: TranslationBook;
  chapters: (Pick<TranslationBookChapter, 'numberOfVerses' | 'chapter'> & {
    thisChapterAudioLinks?: TranslationBookChapterAudioLinks;
  } | null)[];
}

const bundledCollectionFor = (translation: string) =>
  FETCH_BIBLE_TRANSLATED_EDITIONS[translation]?.bundled ?? BUNDLED_HELLOAO_TRANSLATIONS[translation];

/** One verse's words, for search. */
export interface BibleVerseText {
  bookId: string;
  chapter: number;
  verse: number;
  text: string;
}

/**
 * A HelloAO verse's words, on one line, with no footnote markers. A footnote
 * between two phrases becomes a space, as the reader shows it ("as yourself.
 * I am the LORD"), and a space left before punctuation goes.
 */
const helloaoVerseText = (content: ChapterVerse['content']) =>
  content
    .map((part) =>
      typeof part === 'string'
        ? part
        : 'text' in part
          ? ` ${part.text} `
          : 'lineBreak' in part || 'noteId' in part
            ? ' '
            : '',
    )
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/ ([,.;:!?’”)])/g, '$1')
    .trim();

/**
 * Every verse's words in a translation, read straight from its bundled book
 * files, for search (services/BibleSearch.ts). Headings, footnotes, and poetry
 * lines are left out, so this is much quicker than opening each chapter with
 * fetchChapter: under a quarter of a second for a translation in Node.
 */
export async function readTranslationVerseTexts(translationId: string): Promise<BibleVerseText[]> {
  const edition = FETCH_BIBLE_TRANSLATED_EDITIONS[translationId];
  const helloao = BUNDLED_HELLOAO_TRANSLATIONS[translationId];
  if (!edition && !helloao) {
    throw new Error(`No Bible text ships with the app for ${translationId}`);
  }
  const verses: BibleVerseText[] = [];
  for (const { id: bookId } of await fetchBooks(translationId)) {
    if (edition) {
      const source = await readBundledBibleFile<FetchBiblePlainTextBook>(edition.bundled, bookId.toLowerCase());
      source.contents.forEach((chapter, chapterNumber) => {
        if (!chapterNumber || !Array.isArray(chapter)) return;
        chapter.forEach((parts, verse) => {
          if (!verse || !Array.isArray(parts)) return;
          const text = normalizeFetchBibleText(
            parts.filter((part): part is string => typeof part === 'string').join(''),
          )
            .replace(/\s+/g, ' ')
            .trim();
          if (text) verses.push({ bookId, chapter: chapterNumber, verse, text });
        });
      });
    } else {
      const source = await readBundledBibleFile<BundledHelloaoBook>(helloao, bookId.toLowerCase());
      source.chapters.forEach((entry, chapterNumber) => {
        for (const item of entry?.chapter.content ?? []) {
          if (item.type !== 'verse') continue;
          const text = helloaoVerseText(item.content);
          if (text) verses.push({ bookId, chapter: chapterNumber, verse: item.number, text });
        }
      });
    }
  }
  return verses;
}

/** A HelloAO chapter from the bundled book, shaped like the API's response. */
async function readBundledHelloaoChapter(
  collection: BundledBibleCollection,
  bookId: string,
  chapterNumber: number,
): Promise<TranslationBookChapter> {
  const source = await readBundledBibleFile<BundledHelloaoBook>(collection, bookId.toLowerCase());
  const entry = source.chapters[chapterNumber];
  if (!entry) {
    throw new Error(`Chapter ${bookId} ${chapterNumber} is unavailable`);
  }
  const audioLinksOf = (number: number) => source.chapters[number]?.thisChapterAudioLinks ?? null;
  return {
    translation: source.translation,
    book: source.book,
    thisChapterLink: `bundled:${collection}/${bookId.toLowerCase()}/${chapterNumber}`,
    thisChapterAudioLinks: entry.thisChapterAudioLinks ?? {},
    nextChapterApiLink: null,
    nextChapterAudioLinks: audioLinksOf(chapterNumber + 1),
    previousChapterApiLink: null,
    previousChapterAudioLinks: chapterNumber > 1 ? audioLinksOf(chapterNumber - 1) : null,
    numberOfVerses: entry.numberOfVerses,
    // A copy, so normalizing it below leaves the cached book as it was.
    chapter: { ...entry.chapter },
  };
}

const translatedBibleBookCache = new Map<
  string,
  Promise<FetchBiblePlainTextBook>
>();
const translationBookListCache = new Map<
  string,
  Promise<TranslationBook[]>
>();

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
    const bundled = bundledCollectionFor(translation);
    request = bundled
      ? readBundledBibleFile<TranslationBook[]>(bundled, 'books')
      : Promise.reject(new Error(`No Bible text ships with the app for ${translation}`));
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
 * Whether text that follows a footnote marker needs a space before it, so words
 * don't weld together. Chinese never does: it has no spaces between words, and
 * the 1919 CUV's notes sit mid-verse, before a character, \u3001, \uff0e, or a quote mark.
 */
export function needsSpaceAfterFootnote(text: string): boolean {
  return (
    text.length > 0 &&
    !startsWithPunctuationOrSpace(text) &&
    !/^[\p{Script=Han}\u3001\uff0e\u300c-\u300f]/u.test(text)
  );
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

/** Whether a structured item begins a new source-defined poetry line. */
export function startsNewBiblePoetryLine(
  content: ChapterVerse['content'],
  index: number,
  translationId: string,
) {
  const item = content[index];
  if (
    index <= 0 ||
    typeof item !== 'object' ||
    item === null ||
    !('poem' in item)
  ) {
    return false;
  }

  let skippedInterruption = false;
  for (let previousIndex = index - 1; previousIndex >= 0; previousIndex--) {
    const previous = content[previousIndex];
    const isMetadata =
      typeof previous === 'object' &&
      previous !== null &&
      'noteId' in previous;
    const isWhitespace =
      typeof previous === 'string' && previous.trim().length === 0;

    if (isMetadata || isWhitespace) {
      skippedInterruption = true;
      continue;
    }
    if (
      typeof previous === 'object' &&
      previous !== null &&
      'lineBreak' in previous
    ) {
      return true;
    }

    const previousText =
      typeof previous === 'string' ? previous : (previous as FormattedText).text || '';
    const continuesInterruptedLine =
      skippedInterruption &&
      typeof previous === 'object' &&
      previous !== null &&
      'poem' in previous &&
      previous.poem === item.poem &&
      !isSelahMarker(translationId, previousText) &&
      !item.text.startsWith('\n');

    return !continuesInterruptedLine;
  }

  return false;
}

/**
 * Converts a structured verse object into a formatted plain-text string.
 * This preserves poetic line breaks and handles liturgical markers (Selah)
 * consistently across the app.
 */
export function renderVerseToPlainText(
  translationId: string,
  verse: ChapterVerse,
  footnotes: ChapterFootnote[] = [],
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

    let footnoteMarker = '';
    if (footnotes.length > 0) {
      for (let j = i + 1; j < verse.content.length; j++) {
        const next = verse.content[j];
        if (typeof next === 'object' && next !== null && 'noteId' in next) {
          footnoteMarker = toSuperscript(
            getChapterFootnoteNumber(footnotes, next.noteId),
          );
          break;
        }
        if (typeof next === 'string' && next.trim().length > 0) break;
        if (
          typeof next === 'object' &&
          ('text' in next || 'heading' in next)
        ) {
          break;
        }
      }
    }

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
      needsSpaceAfterFootnote(contentText)
    ) {
      contentText = ' ' + contentText;
    }

    if (footnoteMarker) {
      const { leading, core, trailingPunct, trailingSpace } = segmentText(contentText);
      contentText = `${leading}${core}${footnoteMarker}${trailingPunct}${trailingSpace}`;
    }

    if (isSelah) {
      result += (i > 0 && !prevIsLineBreak ? '\n' : '') + contentText;
    } else if (isPoetic) {
      const prefix =
        (i > 0 &&
        foundPreviousContent &&
        !isLineContinuation &&
        !isSelah &&
        !prevIsLineBreak
          ? '\n'
          : '');
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

export const normalizeFetchBibleText = (text: string): string =>
  text
    .replace(/\r\n?/g, '\n')
    // The 1919 CUV puts a full-width space (U+3000) before each 神 that means
    // God. Keep the separation without rendering a full Han-cell-sized hole.
    .replace(/\u3000/g, ' ')
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
  edition: FetchBibleTranslatedEdition,
  book: string,
  signal?: AbortSignal,
): Promise<FetchBiblePlainTextBook> {
  const abortError = () => {
    const error = new Error('Aborted');
    error.name = 'AbortError';
    return error;
  };
  const normalizedBook = book.toLowerCase();
  const cacheKey = `${edition.bundled}:${normalizedBook}`;
  let request = translatedBibleBookCache.get(cacheKey);

  if (!request) {
    request = readBundledBibleFile<FetchBiblePlainTextBook>(edition.bundled, normalizedBook);
    translatedBibleBookCache.set(cacheKey, request);
    request.catch(() => {
      if (translatedBibleBookCache.get(cacheKey) === request) {
        translatedBibleBookCache.delete(cacheKey);
      }
    });
  }

  if (!signal) return request;
  if (signal.aborted) {
    if (translatedBibleBookCache.get(cacheKey) === request) {
      translatedBibleBookCache.delete(cacheKey);
    }
    throw abortError();
  }

  // Do not attach one consumer's AbortSignal to a shared cached read. Stop
  // waiting and evict a stuck promise so the retry can start a fresh read;
  // other consumers may still receive the original book if it recovers.
  return new Promise((resolve, reject) => {
    const abort = () => {
      if (translatedBibleBookCache.get(cacheKey) === request) {
        translatedBibleBookCache.delete(cacheKey);
      }
      reject(abortError());
    };
    signal.addEventListener('abort', abort, { once: true });
    request.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', abort);
    });
  });
}

async function fetchChapterFromFetchBible(
  translationId: string,
  edition: FetchBibleTranslatedEdition,
  bookId: string,
  chapterNumber: number,
  signal?: AbortSignal,
): Promise<TranslationBookChapter> {
  const [sourceBook, books] = await Promise.all([
    fetchTranslatedBibleBook(edition, bookId, signal),
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
        // A Selah on the verse's last line, as the 1919 CUV puts 〔細拉〕, is its
        // own item, so the reader right-aligns it as it does the BSB's.
        const lastLine = text.lastIndexOf('\n');
        if (lastLine > 0 && isSelahMarker(translationId, text.slice(lastLine + 1))) {
          verseContent.push(text.slice(0, lastLine), text.slice(lastLine));
        } else if (text) {
          verseContent.push(text);
        }
        continue;
      }

      // Headings and notes get the verse text's spacing too: some 1919 notes
      // have the full-width space before 神.
      const metadataText = normalizeFetchBibleText(fetchBibleMetadataText(part.contents)).trim();
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
  const thisChapterLink = `bundled:${edition.bundled}/${bookId.toLowerCase()}`;
  const hasChurchAudio = hasChurchHostedAudio(translationId);
  const getAudioLinks = (audioChapter: number) =>
    getChurchHostedAudioLinks(translationId, book.id, audioChapter);

  return {
    translation,
    book,
    thisChapterLink,
    thisChapterAudioLinks: getAudioLinks(chapterNumber),
    nextChapterApiLink: null,
    nextChapterAudioLinks:
      hasChurchAudio && chapterNumber < book.numberOfChapters
        ? getAudioLinks(chapterNumber + 1)
        : null,
    previousChapterApiLink: null,
    previousChapterAudioLinks:
      hasChurchAudio && chapterNumber > 1
        ? getAudioLinks(chapterNumber - 1)
        : null,
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
  options: { signal?: AbortSignal } = {},
): Promise<TranslationBookChapter> {
  try {
    const fetchBibleEdition = FETCH_BIBLE_TRANSLATED_EDITIONS[translation];
    if (fetchBibleEdition) {
      return await fetchChapterFromFetchBible(
        translation,
        fetchBibleEdition,
        book,
        chapter,
        options.signal,
      );
    }

    const bundled = BUNDLED_HELLOAO_TRANSLATIONS[translation];
    if (!bundled) {
      throw new Error(`No Bible text ships with the app for ${translation}`);
    }
    const data = await readBundledHelloaoChapter(bundled, book, chapter);

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
 * Reads a verse from an open original-language critical edition, from the
 * copy that ships with the app (assets/bible/original), with no network.
 *
 * The lookup uses the canonical USFM book id and chapter/verse numbers, so it
 * is independent of whichever translated language is currently displayed.
 * fetch(bible)'s normalized plain-text format uses lowercase USFM book ids and
 * array indexes that correspond to the familiar 1-based chapter/verse numbers.
 * Whole books are cached, as the files hold one book each.
 *
 * LICENSE NOTE: The selected texts are CC BY 4.0, not public domain. Preserve
 * their attribution and license documentation when displaying or reusing this
 * result. This function removes separate note objects and normalizes layout
 * whitespace for display; docs/LEGAL.md discloses those presentation changes,
 * as the license requires. Where the translation numbers the verse
 * differently, it joins the original verses that hold it
 * (ORIGINAL_VERSE_NUMBERING) and says which in `reference`.
 */
export async function fetchOriginalLanguageVerse(
  book: string,
  chapter: number,
  verse: number,
  /** The translation whose verse numbering `chapter` and `verse` use. */
  translationId?: string,
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
    request = readBundledBibleFile<FetchBiblePlainTextBook>(source.collection, fetchBibleBookId);
    originalLanguageBookCache.set(cacheKey, request);
    request.catch(() => originalLanguageBookCache.delete(cacheKey));
  }

  const data = await request;
  const refs = ORIGINAL_VERSE_NUMBERING[translationId ?? '']?.[`${normalizedBook} ${chapter}:${verse}`];
  const verseParts = (refs ?? [[chapter, verse]]).map(
    ([originalChapter, originalVerse]) => data.contents?.[originalChapter]?.[originalVerse],
  );
  if (!verseParts.some(Array.isArray)) {
    throw new Error(
      `Original-language verse not found: ${normalizedBook} ${chapter}:${verse}`,
    );
  }

  // Notes are separate objects in fetch(bible)'s plain-text payload. The main
  // strings retain the edition's textual sigla; only layout whitespace is
  // collapsed so Greek word-per-line data reads naturally in the popup.
  const text = verseParts
    .flatMap((parts) => (Array.isArray(parts) ? parts : []))
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
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
    license: source.license,
    licenseUrl: source.licenseUrl,
    ...(refs ? { reference: formatOriginalVerseRefs(refs) } : {}),
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
