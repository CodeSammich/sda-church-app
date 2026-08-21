import {
  getBibleVersePinyin,
  getBiblePinyinLines,
  isChineseBibleTranslation,
} from '@/services/BiblePinyinService';

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
});
