import OpenCC from 'opencc-js/t2cn';
import { customPinyin, pinyin } from 'pinyin-pro';

import { SUPPORTED_TRANSLATIONS } from './BibleService';

const traditionalToSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });
const pinyinCache = new Map<string, string>();
const PINYIN_CACHE_LIMIT = 1_000;

export interface BiblePinyinToken {
  text: string;
  pinyin?: string;
  prefix?: string;
  suffix?: string;
}

// Bind punctuation to a neighbouring ruby token so it cannot wrap on its own
// or make a pronunciation appear over the wrong visual cell. Unicode's Ps/Pi
// categories cover Chinese opening quotes and brackets; every other punctuation
// mark (including 。、，；：！？…— and their ASCII forms) binds backward.
const OPENING_PUNCTUATION = /^[\p{Ps}\p{Pi}]$/u;
const PUNCTUATION = /^\p{P}$/u;

// pinyin-pro handles ordinary polyphonic words contextually. Keep this list
// intentionally small and limited to Bible-specific readings that its general
// dictionary does not recognize.
customPinyin({
  参孙: 'shēn sūn',
});

export const isChineseBibleTranslation = (translationId: string) =>
  SUPPORTED_TRANSLATIONS.some(
    (translation) =>
      translation.id === translationId && translation.lang.startsWith('zh'),
  );

/** Generate compact, tone-marked Mandarin locally without a network request. */
export const getBibleVersePinyin = (text: string) => {
  const cached = pinyinCache.get(text);
  if (cached !== undefined) return cached;

  const result = pinyin(traditionalToSimplified(text), {
    toneType: 'symbol',
    nonZh: 'consecutive',
  })
    .replace(/\s+([，。！？；：、,.!?;:）】”’])/g, '$1')
    .replace(/([（【“‘])\s+/g, '$1')
    .trim();

  if (pinyinCache.size >= PINYIN_CACHE_LIMIT) pinyinCache.clear();
  pinyinCache.set(text, result);
  return result;
};

/**
 * Preserve the displayed character while deriving pronunciation from its
 * simplified equivalent. Newlines stay as explicit rows for poetry, and every
 * Han character remains paired with exactly one pinyin syllable.
 */
export const getBiblePinyinLines = (text: string): BiblePinyinToken[][] =>
  text.split('\n').map((line) => {
    const originalCharacters = Array.from(line);
    const pronunciationData = pinyin(traditionalToSimplified(line), {
      toneType: 'symbol',
      // Ruby alignment is character-based. Keeping punctuation and whitespace
      // as separate records prevents an ideographic space from consuming the
      // following Han character's pronunciation (as in CUVS Genesis 1:1).
      nonZh: 'spaced',
      type: 'all',
    });

    const tokens: BiblePinyinToken[] = [];
    let pendingPrefix = '';

    originalCharacters.forEach((character, index) => {
      const pronunciation = pronunciationData[index];
      if (!pronunciation?.isZh && OPENING_PUNCTUATION.test(character)) {
        pendingPrefix += character;
        return;
      }
      if (
        !pronunciation?.isZh &&
        PUNCTUATION.test(character) &&
        tokens.length > 0
      ) {
        const previous = tokens[tokens.length - 1];
        previous.suffix = `${previous.suffix || ''}${character}`;
        return;
      }

      tokens.push({
        text: character,
        pinyin: pronunciation?.isZh ? pronunciation.result : undefined,
        ...(pendingPrefix ? { prefix: pendingPrefix } : {}),
      });
      pendingPrefix = '';
    });

    if (pendingPrefix) tokens.push({ text: pendingPrefix });
    return tokens;
  });
