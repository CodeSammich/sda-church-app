import { LanguageDialog } from '@/components/LanguageDialog';
import { TextSizeDialog } from '@/components/TextSizeDialog';
import { ThemeDialog } from '@/components/ThemeDialog';
import { ContrastDialog } from '@/components/ContrastDialog';
import { getPopupClosePlacement, PopupHeader } from '@/components/PopupHeader';
import { fireEvent } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderWithPreferences } from './helpers/render-preferences';
import { getRenderedNodes } from './helpers/sheets';

describe('popup close buttons', () => {
  it.each([
    { name: 'Language', dialog: LanguageDialog, close: 'Close', language: 'en' as const },
    { name: 'Theme', dialog: ThemeDialog, close: '關閉', language: 'zh' as const },
    { name: 'Text size', dialog: TextSizeDialog, close: 'Cerrar', language: 'es' as const },
    { name: 'Contrast', dialog: ContrastDialog, close: '关闭', language: 'zh-cn' as const },
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
    // Audio settings, the sleep timer, and the selection sheet (the pickers,
    // a verse's details and its hymns) are sheets, whose X AppSheet draws.
    for (const title of ['labels.audioSettings', 'labels.sleepTimer', 'labels.verseHymnsTitle']) {
      expect(source).toMatch(new RegExp(`title=\\{\\s*(sheetType === 'verse-hymns'\\s*\\? )?${title.replace('.', '\\.')}`));
    }
    expect(source.match(/\{\.\.\.bibleSheetHeader\}/g)).toHaveLength(3);
    // Saved verses fill the screen, with the X in their own title row (#750).
    expect(source.match(/\{renderPopupHeader\(/g)).toHaveLength(1);
    expect(source).toContain('{renderPopupHeader(labels.savedVerses, closeModal)}');
    // Only the background-audio note, which asks a question, keeps a plain title.
    expect(source.match(/ReaderStyles\.modalTitle/g)).toHaveLength(1);
  });

  it.each([
    { os: 'ios', placement: 'leading' },
    { os: 'android', placement: 'trailing' },
    { os: 'web', placement: 'trailing' },
  ])('puts the X at the $placement edge on $os (#867)', ({ os, placement }) => {
    // Apple puts a sheet's Close on the leading edge; Material 3's side sheet
    // puts its close button at the trailing end of its title row.
    expect(getPopupClosePlacement(os)).toBe(placement);
  });

  it('puts the X before the title on iOS, and centres the title', async () => {
    const screen = await renderWithPreferences(
      createElement(PopupHeader, { closeLabel: 'Close', onClose: jest.fn(), title: 'Text size' }),
    );
    const nodes = getRenderedNodes(screen);
    const close = nodes.findIndex((node) => node.props.accessibilityLabel === 'Close');
    const title = nodes.findIndex((node) => node.props.accessibilityRole === 'header');
    expect(close).toBeGreaterThanOrEqual(0);
    expect(close).toBeLessThan(title);
    expect(screen.getByText('Text size')).toHaveStyle({ textAlign: 'center' });
  });
});
