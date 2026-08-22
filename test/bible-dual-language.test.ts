import {
  getParallelStructuralContent,
  getParallelVerseTexts,
  getSupportingBibleTranslation,
  indexChapterVerses,
} from '@/services/BibleDualLanguage';

describe('dual-language Bible reader', () => {
  it('pairs a learning translation with the app-language edition', () => {
    expect(getSupportingBibleTranslation('cmn_cuv', 'en')?.id).toBe('BSB');
    expect(getSupportingBibleTranslation('BSB', 'zh-cn')?.id).toBe('cmn_cu1');
  });

  it('does not duplicate the selected language', () => {
    expect(getSupportingBibleTranslation('eng_kjv', 'en')).toBeNull();
    expect(getSupportingBibleTranslation('cmn_cuv', 'zh')).toBeNull();
  });

  it('aligns translated verses by verse number', () => {
    const verses = indexChapterVerses({
      chapter: {
        content: [
          { type: 'heading', content: ['A heading'] },
          { type: 'verse', number: 2, content: ['Second verse'] },
        ],
      },
    } as any);

    expect(verses.get(2)?.content).toEqual(['Second verse']);
    expect(verses.has(1)).toBe(false);
  });

  it('provides both aligned editions to verse-detail surfaces', () => {
    const primary = {
      chapter: {
        content: [{ type: 'verse', number: 3, content: ['God is love.'] }],
      },
    } as any;
    const supporting = {
      chapter: {
        content: [{ type: 'verse', number: 3, content: ['神就是愛。'] }],
      },
    } as any;

    expect(
      getParallelVerseTexts(primary, 'BSB', supporting, 'cmn_cuv', 3),
    ).toEqual({
      primaryText: 'God is love.',
      supportingText: '神就是愛。',
    });
  });

  it('pairs Psalm superscriptions even when sources classify them differently', () => {
    const primary = {
      chapter: {
        content: [
          { type: 'heading', content: ['Save Me by Your Name'] },
          { type: 'hebrew_subtitle', content: ['For the choirmaster.'] },
          { type: 'verse', number: 1, content: ['Save me, O God.'] },
        ],
      },
    } as any;
    const supporting = {
      chapter: {
        content: [
          { type: 'heading', content: ['遭敵迫害求主保護'] },
          { type: 'heading', content: ['交與伶長。用絲弦的樂器。'] },
          { type: 'verse', number: 1, content: ['神啊，求你以你的名救我。'] },
        ],
      },
    } as any;

    expect(getParallelStructuralContent(primary, supporting, 0)?.content).toEqual([
      '遭敵迫害求主保護',
    ]);
    expect(getParallelStructuralContent(primary, supporting, 1)?.content).toEqual([
      '交與伶長。用絲弦的樂器。',
    ]);
  });
});
