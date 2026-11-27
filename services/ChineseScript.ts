import OpenCC from 'opencc-js/t2cn';
import STCharacters from 'opencc-js/dict/STCharacters';
import TWVariants from 'opencc-js/dict/TWVariants';
import TWVariantsPhrases from 'opencc-js/dict/TWVariantsPhrases';

/**
 * Words whose Simplified characters have more than one Traditional form, as
 * the hymnals' titles use them. The character list alone picks the wrong one.
 */
const HYMN_PHRASES: readonly (readonly [string, string])[] = [
  // 讚 is praise; 贊 is support.
  ['赞美', '讚美'],
  ['颂赞', '頌讚'],
  ['赞主', '讚主'],
  ['同赞', '同讚'],
  // 捨 is to give up; 舍 is a house.
  ['舍命', '捨命'],
  ['舍我', '捨我'],
  ['施舍', '施捨'],
  // 征 is to march; 徵 is a sign.
  ['出征', '出征'],
  ['神迹', '神蹟'],
  ['交托', '交託'],
  ['沙仑', '沙崙'],
  ['痊愈', '痊癒'],
  // 鐘 is a bell; 鍾 is a cup, or a name.
  ['钟声', '鐘聲'],
  // As the church's hymn list writes it (scripts/export-hymn-bank.cjs).
  ['洞鉴', '洞鑒'],
  // 祢 is "you", for God; 禰 is an ancestral tablet.
  ['祢', '祢'],
];

let converter: ((text: string) => string) | undefined;

/**
 * Simplified Chinese in Traditional characters, as Taiwan writes them, for
 * the hymnals' titles (#795). The app keeps the Chinese hymnals' titles in
 * Simplified, as their web pages have them, and shows them in Traditional in
 * the 繁體中文 app.
 *
 * opencc-js's own Mainland-to-Taiwan converter, opencc-js/cn2t, is 1.1 MB,
 * nearly all of it a list of phrases, and takes a moment to load. This uses
 * only its list of characters, about 32 KB, with the phrases above.
 * test/hymn-title-script.test.ts checks that every hymn title comes out as
 * the printed bulletin's converter makes it (scripts/export-hymn-bank.cjs,
 * with the whole converter), so a new title that needs a phrase fails there. Only for
 * Simplified text: a few Traditional characters, such as 征, are Simplified
 * forms too, and would change.
 */
export const simplifiedToTraditional = (text: string) =>
  // In each group, as in opencc-js's own, the first list wins.
  (converter ??= OpenCC.ConverterFactory(
    [HYMN_PHRASES, STCharacters],
    [TWVariantsPhrases, TWVariants],
  ))(text);
