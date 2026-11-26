/**
 * Where a line of text may break. Chinese has no spaces between its words, so
 * a phone may break a line between any two of its characters, even inside a
 * word: a button's 分享經文 broke as 分享經 / 文, and a header's 505 版 left
 * 版 alone on a line at 150% (#797). These keep a word whole with characters
 * that don't show: a word joiner (U+2060) between two Chinese characters and a
 * no-break space (U+00A0) for a space that mustn't break.
 */

// The Chinese characters: CJK Unified Ideographs, Extension A, and the
// compatibility ideographs. Chinese punctuation, such as ，and 」, isn't
// among them, so a line may still break after it.
const CHINESE = '\\u3400-\\u9fff\\uf900-\\ufaff';

/** Whether `text` has a Chinese character. */
export const CHINESE_CHARACTER = new RegExp(`[${CHINESE}]`, 'u');

const CHINESE_CHARACTER_PAIR = new RegExp(`([${CHINESE}])(?=[${CHINESE}])`, 'gu');
// A space between Chinese and a number or a Latin word, as in 505 版 or
// 英文 SDA 詩歌本, only spaces them apart; the two belong together.
const CHINESE_THEN_LATIN_SPACE = new RegExp(`([${CHINESE}]) (?=[0-9A-Za-z])`, 'gu');
const LATIN_THEN_CHINESE_SPACE = new RegExp(`([0-9A-Za-z]) (?=[${CHINESE}])`, 'gu');

/**
 * `text` with no line break inside it: a no-break space for each space, and a
 * word joiner between its Chinese characters. For a name or a reference, such
 * as 約翰福音 9:25, which a narrow line should move to the next line whole.
 */
export const unbroken = (text: string) =>
  text.replace(/ /g, ' ').replace(CHINESE_CHARACTER_PAIR, '$1⁠');

/**
 * A short label or title that breaks only between its words. Text with
 * Chinese in it breaks only at its other spaces and after punctuation, never
 * inside a run of Chinese characters, or between Chinese and the number or
 * Latin word beside it: 中文讚美詩 — 505 版 can break only after the dash. Text
 * without Chinese already breaks between words, and is left as it is. Only
 * for a few words, such as a page's title: a long run of Chinese with no
 * punctuation would have nowhere to break.
 */
export const keepWordsWhole = (text: string) =>
  CHINESE_CHARACTER.test(text)
    ? text
        .replace(CHINESE_THEN_LATIN_SPACE, '$1 ')
        .replace(LATIN_THEN_CHINESE_SPACE, '$1 ')
        .replace(CHINESE_CHARACTER_PAIR, '$1⁠')
    : text;
