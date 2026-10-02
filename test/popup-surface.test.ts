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
      });
    },
  );

  it.each([customLightTheme, customDarkTheme])(
    'renders the language dialog on the $dark app canvas',
    (theme) => {
      const screen = renderWithPreferences(
        createElement(LanguageDialog, { onDismiss: jest.fn(), visible: true }),
        { theme },
      );

      expect(
        StyleSheet.flatten(screen.UNSAFE_getByType(Dialog).props.style)
          .backgroundColor,
      ).toBe(theme.colors.background);
    },
  );
});
