import { LanguageDialog } from '@/components/LanguageDialog';
import { customDarkTheme, customLightTheme } from '@/constants/Themes';
import { getPopupSurfaceStyle } from '@/styles/PopupStyles';
import { StyleSheet } from 'react-native';
import { Dialog } from 'react-native-paper';
import { createElement } from 'react';
import { renderWithPreferences } from './helpers/render-preferences';

describe('popup surfaces', () => {
  it.each([customLightTheme, customDarkTheme])(
    'uses the $dark app canvas',
    (theme) => {
      expect(getPopupSurfaceStyle(theme)).toEqual({
        backgroundColor: theme.colors.background,
        borderRadius: 21,
      });
    },
  );

  it.each([customLightTheme, customDarkTheme])(
    'renders the language dialog on the $dark app canvas',
    async (theme) => {
      const screen = await renderWithPreferences(
        createElement(LanguageDialog, { onDismiss: jest.fn(), visible: true }),
        { theme },
      );

      expect(
        StyleSheet.flatten(screen.getByTestId('language-dialog-surface').props.style)
          .backgroundColor,
      ).toBe(theme.colors.background);
    },
  );

  it('gives the Modal popups the corners Paper gives its dialogs', async () => {
    // The Bible screen's popups had 12-pt corners and the You tab's dialogs 21.
    // A bare Dialog, without the shared style, shows Paper's own corners.
    const screen = await renderWithPreferences(
      createElement(Dialog, { visible: true, testID: 'bare-dialog', children: null }),
      { theme: customLightTheme },
    );
    const dialog = StyleSheet.flatten(screen.getByTestId('bare-dialog-surface').props.style);
    expect(getPopupSurfaceStyle(customLightTheme).borderRadius).toBe(dialog.borderRadius);
  });

  it('leaves the corners to the shared style', () => {
    // A popup's own corner would differ from the rest, or be overridden by this one.
    const { readFileSync } = require('node:fs');
    const sources = [
      'styles/ReaderStyles.ts',
      'components/InitialSetup.tsx',
      'components/InstallPrompt.tsx',
    ].map((file) => [file, readFileSync(file, 'utf8')]);
    for (const [file, source] of sources) {
      const popupStyle = source.match(/\n  (?:modal|modalContent): \{[^}]*\}/)?.[0];
      expect([file, popupStyle]).toEqual([file, expect.not.stringContaining('borderRadius')]);
    }
  });
});
