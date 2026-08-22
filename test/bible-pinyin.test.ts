import {
  getBibleVersePinyin,
  getBiblePinyinLines,
  isChineseBibleTranslation,
} from '@/services/BiblePinyinService';
import { normalizeFetchBibleText } from '@/services/BibleService';

describe('Bible pinyin generation', () => {
  it('generates tone-marked pinyin for simplified Chinese', () => {
    expect(getBibleVersePinyin('神爱世人。')).toBe('shén ài shì rén。');
  });

  it('normalizes traditional text before resolving contextual readings', () => {
    expect(getBibleVersePinyin('我們的長子跟隨參孫。')).toBe(
      'wǒ men de zhǎng zǐ gēn suí shēn sūn。',
    );
  });

  it('only enables pinyin for Chinese primary translations', () => {
    expect(isChineseBibleTranslation('cmn_cuv')).toBe(true);
    expect(isChineseBibleTranslation('cmn_cu1')).toBe(true);
    expect(isChineseBibleTranslation('BSB')).toBe(false);
  });

  it('keeps each traditional character aligned with its pinyin and its line', () => {
    expect(getBiblePinyinLines('我們\n長子')).toEqual([
      [
        { text: '我', pinyin: 'wǒ' },
        { text: '們', pinyin: 'men' },
      ],
      [
        { text: '長', pinyin: 'zhǎng' },
        { text: '子', pinyin: 'zǐ' },
      ],
    ]);
  });

  it('binds Selah parentheses without shifting pinyin off its characters', () => {
    expect(getBiblePinyinLines('（細拉）')).toEqual([
      [
        { text: '細', pinyin: 'xì', prefix: '（' },
        { text: '拉', pinyin: 'lā', suffix: '）' },
      ],
    ]);
  });

  it('keeps CUVS Genesis 1:1 pinyin aligned after its ideographic space', () => {
    const sourceText = '起初，\u3000神创造天地。';
    const normalizedText = normalizeFetchBibleText(sourceText);

    expect(normalizedText).toBe('起初， 神创造天地。');
    expect(getBiblePinyinLines(normalizedText)).toEqual([
      [
        { text: '起', pinyin: 'qǐ' },
        { text: '初', pinyin: 'chū', suffix: '，' },
        { text: ' ' },
        { text: '神', pinyin: 'shén' },
        { text: '创', pinyin: 'chuàng' },
        { text: '造', pinyin: 'zào' },
        { text: '天', pinyin: 'tiān' },
        { text: '地', pinyin: 'dì', suffix: '。' },
      ],
    ]);
  });

  it('keeps pinyin aligned across Chinese quotes and varied punctuation', () => {
    expect(getBiblePinyinLines('“神说：\u3000「要有光！」”……')).toEqual([
      [
        { text: '神', pinyin: 'shén', prefix: '“' },
        { text: '说', pinyin: 'shuō', suffix: '：' },
        { text: '\u3000' },
        { text: '要', pinyin: 'yào', prefix: '「' },
        { text: '有', pinyin: 'yǒu' },
        { text: '光', pinyin: 'guāng', suffix: '！」”……' },
      ],
    ]);
  });

  it('binds unlisted Unicode punctuation without consuming a pinyin slot', () => {
    expect(getBiblePinyinLines('神——爱；世人。')).toEqual([
      [
        { text: '神', pinyin: 'shén', suffix: '——' },
        { text: '爱', pinyin: 'ài', suffix: '；' },
        { text: '世', pinyin: 'shì' },
        { text: '人', pinyin: 'rén', suffix: '。' },
      ],
    ]);
  });
});
