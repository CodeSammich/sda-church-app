/**
 * How test/cuv-1919-witnesses.test.ts compares the app's 1919 Chinese Union
 * Version with other copies of the 1919 text (#517): by wording only.
 *
 * - Only Han characters count. The copies punctuate differently: WordProject
 *   and Wikisource keep the 1919 、 and ．, open-bibles uses modern ，；「」.
 * - Older and newer forms of one character count as the same character:
 *   Wikisource keeps forms such as 爲 and 裏 where the app has 為 and 裡, and
 *   open-bibles modernizes some spellings (她, 吃, 啊). Each pair here was
 *   checked by hand. Pairs that differ in meaning (記/紀, 至/致, 畫/劃) aren't
 *   folded, so a difference between them still shows.
 *
 * The other copies themselves are in test/fixtures/cuv-1919-witnesses, as
 * scripts/cuv-1919-witnesses.mjs downloads them.
 */

// Older or variant form → the form the app uses. From Wikisource's older forms
// (爲 裏 着 衆 …), the private-use and rare characters WordProject lacked, and
// the forms reviewed on 2026-10-27 (餬 蹧 挂 枴 …).
const FORMS = Object.fromEntries(
  [
    ['爲裏着衆衞豫脚旣眞羣汚塲徧毘輭牀題躱寃愼邱况饑朶畧祕彀鈎燄凶卽册胄輥疎躭貲鬬繙稭恒羡崗銹熔踊拐麅絃煖遶窰葱韮竈',
      '為裡著眾衛預腳既真群污場遍毗軟床提躲冤慎丘況飢朵略秘夠鉤焰兇即冊冑滾疏耽資鬥翻秸恆羨岡鏽鎔踴柺麃弦暖繞窯蔥韭灶'],
    ['𧼮𣎴𤏲𤘘', '趟墩著口'],
    ['餬蹧挂枴梁氾箒羢餧槪顚峯叙倂罣効粃喇罎删僞尅甎愈跥顋燬臺堦慾昇缾鎔覩仿勅挱㰋蝱',
      '糊糟掛柺樑泛帚絨餵概顛峰敘併掛效秕啦罈刪偽剋磚癒跺腮毀台階欲升瓶融睹倣敕挲蘋虻'],
  ].flatMap(([from, to]) => {
    const a = [...from];
    const b = [...to];
    if (a.length !== b.length) throw new Error('FORMS pairs are misaligned');
    return a.map((ch, i) => [ch, b[i]]);
  }),
);

// open-bibles' modernized spellings → the 1919 spelling (他 for every gender,
// 喫, 阿, 麼, 罷, 纔), and 地 → 的, which 1919 writes for both.
const SPELLINGS = {
  她: '他', 它: '他', 牠: '他', 祂: '他', 妳: '你', 祢: '你',
  吃: '喫', 啊: '阿', 嗎: '麼', 吧: '罷', 才: '纔', 地: '的',
};

// Two-character spellings of one word, where folding the single character
// would be wrong elsewhere (巴 in 巴比倫, 鍊 for refining).
const WORDS = [
  ['啞吧', '啞巴'],
  ['鍊子', '鏈子'],
];

const HAN = /\p{Script=Han}/u;

// Where 1919 translated two verses as one, the second verse is a note saying so:
// 見上節 ("see the verse above") in the app and Wikisource, 併於上節 ("joined to
// the verse above") in open-bibles.
const MERGED = new Set(['見上節', '併於上節', '见上节', '并于上节']);

const fold = (text, map) => {
  // open-bibles labels the speakers in the Song of Songs, ［新娘］, which 1919
  // doesn't print.
  let plain = text.replace(/［[^］]*］/gu, '');
  for (const [from, to] of WORDS) plain = plain.split(from).join(to);
  const han = [...plain].filter((ch) => HAN.test(ch)).join('');
  if (MERGED.has(han)) return '見上節';
  return [...han].map((ch) => map(ch)).join('');
};

/** A verse's wording, as the comparison sees it. */
const foldTraditional = (text) => fold(text, (ch) => {
  const form = FORMS[ch] ?? ch;
  return SPELLINGS[form] ?? form;
});

// The Simplified text against open-bibles' Simplified copy: the same idea, for
// the spellings that differ between the two Simplified copies. 着 and 著 are
// different words in Simplified (zhe, zhù), so they aren't folded.
const SIMPLIFIED_SPELLINGS = {
  她: '他', 它: '他', 牠: '他', 祂: '他', 妳: '你', 祢: '你',
  啊: '阿', 吗: '么', 吧: '罢', 地: '的',
};
const foldSimplified = (text) => fold(text, (ch) => SIMPLIFIED_SPELLINGS[ch] ?? ch);

module.exports = { FORMS, SPELLINGS, WORDS, foldTraditional, foldSimplified };
