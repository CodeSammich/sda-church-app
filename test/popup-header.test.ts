import { LanguageDialog } from '@/components/LanguageDialog';
import { TextSizeDialog } from '@/components/TextSizeDialog';
import { ThemeDialog } from '@/components/ThemeDialog';
import { fireEvent } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderWithPreferences } from './helpers/render-preferences';

describe('popup close buttons', () => {
  it.each([
    { name: 'Language', dialog: LanguageDialog, close: 'Close', language: 'en' as const },
    { name: 'Theme', dialog: ThemeDialog, close: '關閉', language: 'zh' as const },
    { name: 'Text size', dialog: TextSizeDialog, close: 'Cerrar', language: 'es' as const },
  ])('the $name dialog closes with an X, not a Close button', async ({ dialog, close, language }) => {
    const onDismiss = jest.fn();
    const screen = await renderWithPreferences(
      createElement(dialog, { onDismiss, visible: true }),
      { language },
    );

    // The X is an icon, so the word appears only as its screen-reader label.
    expect(screen.queryByText(close)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: close }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('gives every Bible popup without its own buttons the X', () => {
    const source = readFileSync('app/(tabs)/bible/index.tsx', 'utf8');
    for (const title of [
      'labels.audioSettings',
      'labels.sleepTimer',
      'labels.verseHymnsTitle',
      'labels.savedVerses',
    ]) {
      expect(source).toContain(`{renderPopupHeader(${title}, `);
    }
    // The verse popup and the book, chapter, verse, and translation pickers.
    expect(source.match(/\{renderPopupHeader\(\n/g)).toHaveLength(2);
    // Only the background-audio note, which asks a question, keeps a plain title.
    expect(source.match(/ReaderStyles\.modalTitle/g)).toHaveLength(1);
  });
});
