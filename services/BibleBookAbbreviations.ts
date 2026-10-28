/**
 * Published short forms of the books' names, so the reference parser in
 * services/BibleService.ts reads what people type, such as "Jn 3:16",
 * "1 Cor 13:4", "Sal 23" or "約3:16". The parser already knows each book's
 * full name in every app language (BIBLE_BOOK_NAMES) and its USFM code (GEN,
 * JHN, 1CO). Every form here comes from one of the lists below, or writes one
 * of its characters in a common form (參 for 叄); don't add one that isn't in a
 * published list.
 *
 * Case, accents, dots, the space after a book's number, and a Roman numeral
 * for it don't matter, so "1co", "1 Co." and "I Co" are the same.
 * test/bible-scripture-reference.test.ts checks that no form names two books.
 */
type AbbreviationList = Record<string, readonly string[]>;

/**
 * The SBL Handbook of Style (2nd ed., 2014), §8.3, the abbreviations
 * scholarly writing uses. As reproduced in the University of Divinity
 * Library's style guide: https://divinity.libguides.com/styleguide/bible
 */
const SBL: AbbreviationList = {
  GEN: ['Gen'], EXO: ['Exod'], LEV: ['Lev'], NUM: ['Num'], DEU: ['Deut'], JOS: ['Josh'],
  JDG: ['Judg'], RUT: ['Ruth'], '1SA': ['1 Sam'], '2SA': ['2 Sam'], '1KI': ['1 Kgs'],
  '2KI': ['2 Kgs'], '1CH': ['1 Chr'], '2CH': ['2 Chr'], EZR: ['Ezra'], NEH: ['Neh'],
  EST: ['Esth'], JOB: ['Job'], PSA: ['Ps', 'Pss'], PRO: ['Prov'], ECC: ['Eccl', 'Qoh'],
  SNG: ['Song', 'Cant'], ISA: ['Isa'], JER: ['Jer'], LAM: ['Lam'], EZK: ['Ezek'], DAN: ['Dan'],
  HOS: ['Hos'], JOL: ['Joel'], AMO: ['Amos'], OBA: ['Obad'], JON: ['Jonah'], MIC: ['Mic'],
  NAM: ['Nah'], HAB: ['Hab'], ZEP: ['Zeph'], HAG: ['Hag'], ZEC: ['Zech'], MAL: ['Mal'],
  MAT: ['Matt'], MRK: ['Mark'], LUK: ['Luke'], JHN: ['John'], ACT: ['Acts'], ROM: ['Rom'],
  '1CO': ['1 Cor'], '2CO': ['2 Cor'], GAL: ['Gal'], EPH: ['Eph'], PHP: ['Phil'], COL: ['Col'],
  '1TH': ['1 Thess'], '2TH': ['2 Thess'], '1TI': ['1 Tim'], '2TI': ['2 Tim'], TIT: ['Titus'],
  PHM: ['Phlm'], HEB: ['Heb'], JAS: ['Jas'], '1PE': ['1 Pet'], '2PE': ['2 Pet'],
  '1JN': ['1 John'], '2JN': ['2 John'], '3JN': ['3 John'], JUD: ['Jude'], REV: ['Rev'],
};

/**
 * The abbreviations Bible Gateway accepts in its search box, the forms people
 * type most: https://www.biblegateway.com/support/KA-01428 (Its "I Sa" and
 * other Roman-numeral forms are covered by the parser's numeral rule.)
 */
const BIBLE_GATEWAY: AbbreviationList = {
  GEN: ['Ge', 'Gen'], EXO: ['Ex', 'Exo', 'Exod'], LEV: ['Lev'], NUM: ['Nu', 'Num'],
  DEU: ['Deu', 'Deut'], JOS: ['Jos', 'Josh'], JDG: ['Judg'], RUT: ['Ru', 'Rt'],
  '1SA': ['1 Sa', '1 Sam'], '2SA': ['2 Sa', '2 Sam'], '1KI': ['1 Ki', '1 Kin'],
  '2KI': ['2 Ki', '2 Kin'], '1CH': ['1 Ch', '1 Chr'], '2CH': ['2 Ch', '2 Chr'], EZR: ['Ezr'],
  NEH: ['Ne', 'Neh'], EST: ['Est', 'Esth'], JOB: ['Jo'], PSA: ['Ps', 'Psa'],
  PRO: ['Pr', 'Pro', 'Prov'], ECC: ['Ec', 'Ecc', 'Eccl'], SNG: ['SS', 'Song'], ISA: ['Is', 'Isa'],
  JER: ['Jer', 'Jere'], LAM: ['La', 'Lam'], EZK: ['Ez', 'Eze', 'Ezk'], DAN: ['Da', 'Dan'],
  HOS: ['Ho', 'Hos'], JOL: ['Joe'], AMO: ['Am', 'Amo'], OBA: ['Ob', 'Oba'], JON: ['Jon', 'Jona'],
  MIC: ['Mi', 'Mic', 'Mica'], NAM: ['Na', 'Nah'], HAB: ['Hab'], ZEP: ['Zep', 'Zph', 'Zeph'],
  HAG: ['Hag'], ZEC: ['Zch', 'Zech'], MAL: ['Mal'], MAT: ['Mat', 'Matt'], MRK: ['Mar'],
  LUK: ['Lu', 'Luk'], JHN: ['Jn'], ACT: ['Ac', 'Act'], ROM: ['Ro', 'Rom', 'Roma'],
  '1CO': ['1 Co', '1 Cor'], '2CO': ['2 Co', '2 Cor'], GAL: ['Ga', 'Gal'], EPH: ['Ep', 'Eph'],
  PHP: ['Phil', 'Phili'], COL: ['Col'], '1TH': ['1 Th', '1 The'], '2TH': ['2 Th', '2 The'],
  '1TI': ['1 Ti', '1 Tim'], '2TI': ['2 Ti', '2 Tim'], TIT: ['Ti', 'Tit'], PHM: ['Phm', 'Phile'],
  HEB: ['He', 'Heb'], JAS: ['Jam'], '1PE': ['1 Pe', '1 Pet'], '2PE': ['2 Pe', '2 Pet'],
  '1JN': ['1 Jo', '1 Joh'], '2JN': ['2 Jo', '2 Joh'], '3JN': ['3 Jo', '3 Joh'], JUD: ['Jud'],
  REV: ['Re', 'Rev'],
};

/**
 * The Reina-Valera 1909's own abbreviations, from its book files' `abbrev`
 * field (fetch(bible) `spa_rv`), the same ones Spanish Bibles such as the
 * Reina-Valera 1960 print. Job has none.
 */
const REINA_VALERA: AbbreviationList = {
  GEN: ['Gn'], EXO: ['Ex'], LEV: ['Lv'], NUM: ['Nm'], DEU: ['Dt'], JOS: ['Jos'], JDG: ['Jue'],
  RUT: ['Rt'], '1SA': ['1 S'], '2SA': ['2 S'], '1KI': ['1 R'], '2KI': ['2 R'], '1CH': ['1 Cr'],
  '2CH': ['2 Cr'], EZR: ['Esd'], NEH: ['Neh'], EST: ['Est'], PSA: ['Sal'], PRO: ['Pr'],
  ECC: ['Ec'], SNG: ['Cnt'], ISA: ['Is'], JER: ['Jer'], LAM: ['Lm'], EZK: ['Ez'], DAN: ['Dn'],
  HOS: ['Os'], JOL: ['Jl'], AMO: ['Am'], OBA: ['Abd'], JON: ['Jon'], MIC: ['Mi'], NAM: ['Nah'],
  HAB: ['Hab'], ZEP: ['Sof'], HAG: ['Hag'], ZEC: ['Zac'], MAL: ['Mal'], MAT: ['Mt'], MRK: ['Mr'],
  LUK: ['Lc'], JHN: ['Jn'], ACT: ['Hch'], ROM: ['Ro'], '1CO': ['1 Co'], '2CO': ['2 Co'],
  GAL: ['Ga'], EPH: ['Ef'], PHP: ['Fil'], COL: ['Col'], '1TH': ['1 Ts'], '2TH': ['2 Ts'],
  '1TI': ['1 Ti'], '2TI': ['2 Ti'], TIT: ['Tit'], PHM: ['Flm'], HEB: ['He'], JAS: ['Stg'],
  '1PE': ['1 P'], '2PE': ['2 P'], '1JN': ['1 Jn'], '2JN': ['2 Jn'], '3JN': ['3 Jn'], JUD: ['Jud'],
  REV: ['Ap'],
};

/**
 * The Chinese Union Version's abbreviations, from Wikipedia's 和合本 article
 * (https://zh.wikipedia.org/zh-tw/和合本聖經 and its zh-hans version), in
 * Traditional and Simplified characters. The epistles of John are 約壹, 約貳,
 * 約叄 there; FHL (信望愛) writes 約一, 約二, 約三
 * (https://springbible.fhl.net/Bible2/cgic201/Doc/abbreviation.html), and 參 is
 * the common form of 叄. (The CUV's 壹, 貳, 叄 keep 約二3 from reading as 2 John
 * 3; with FHL's 約二, the parser reads it so, as for any one-chapter book.)
 */
const CHINESE_UNION_VERSION: AbbreviationList = {
  GEN: ['創', '创'], EXO: ['出'], LEV: ['利'], NUM: ['民'], DEU: ['申'], JOS: ['書', '书'],
  JDG: ['士'], RUT: ['得'], '1SA': ['撒上'], '2SA': ['撒下'], '1KI': ['王上'], '2KI': ['王下'],
  '1CH': ['代上'], '2CH': ['代下'], EZR: ['拉'], NEH: ['尼'], EST: ['斯'], JOB: ['伯'],
  PSA: ['詩', '诗'], PRO: ['箴'], ECC: ['傳', '传'], SNG: ['歌'], ISA: ['賽', '赛'], JER: ['耶'],
  LAM: ['哀'], EZK: ['結', '结'], DAN: ['但'], HOS: ['何'], JOL: ['珥'], AMO: ['摩'], OBA: ['俄'],
  JON: ['拿'], MIC: ['彌', '弥'], NAM: ['鴻', '鸿'], HAB: ['哈'], ZEP: ['番'], HAG: ['該', '该'],
  ZEC: ['亞', '亚'], MAL: ['瑪', '玛'], MAT: ['太'], MRK: ['可'], LUK: ['路'], JHN: ['約', '约'],
  ACT: ['徒'], ROM: ['羅', '罗'], '1CO': ['林前'], '2CO': ['林後', '林后'], GAL: ['加'],
  EPH: ['弗'], PHP: ['腓'], COL: ['西'], '1TH': ['帖前'], '2TH': ['帖後', '帖后'],
  '1TI': ['提前'], '2TI': ['提後', '提后'], TIT: ['多'], PHM: ['門', '门'], HEB: ['來', '来'],
  JAS: ['雅'], '1PE': ['彼前'], '2PE': ['彼後', '彼后'],
  '1JN': ['約壹', '约壹', '約一', '约一'],
  '2JN': ['約貳', '约贰', '約二', '约二'],
  '3JN': ['約叄', '约叁', '約參', '约参', '約三', '约三'],
  JUD: ['猶', '犹'], REV: ['啟', '启'],
};

const SOURCES = [SBL, BIBLE_GATEWAY, REINA_VALERA, CHINESE_UNION_VERSION];

/** Every published short form of each book, by its USFM code. */
export const BIBLE_BOOK_ABBREVIATIONS: Record<string, readonly string[]> = Object.fromEntries(
  Object.keys(SBL).map((bookId) => [
    bookId,
    [...new Set(SOURCES.flatMap((source) => source[bookId] ?? []))],
  ]),
);
