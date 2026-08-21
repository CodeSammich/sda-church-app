import {
  renderVerseToPlainText,
  startsNewBiblePoetryLine,
} from '@/services/BibleService';

describe('Bible verse formatting', () => {
  it('preserves poetic line breaks without indenting later poetry levels', () => {
    const verse = {
      type: 'verse' as const,
      number: 1,
      content: [
        { text: 'Blessed are those whose way is blameless,', poem: 1 },
        { text: 'who walk in the Law of the LORD.', poem: 2 },
      ],
    };

    expect(renderVerseToPlainText('BSB', verse)).toBe(
      'Blessed are those whose way is blameless,\nwho walk in the Law of the LORD.',
    );
  });

  it('distinguishes source poetry lines from footnote-split continuations', () => {
    const content = [
      { text: 'First line', poem: 1 },
      { text: 'Second line', poem: 2 },
      { noteId: 1 },
      { text: ' continued', poem: 2 },
    ];

    expect(startsNewBiblePoetryLine(content, 1, 'BSB')).toBe(true);
    expect(startsNewBiblePoetryLine(content, 3, 'BSB')).toBe(false);
  });
});
