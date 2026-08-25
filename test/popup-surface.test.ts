import { EgwEditionDialog } from '@/components/EgwEditionDialog';
import { customDarkTheme, customLightTheme } from '@/constants/Themes';
import { EGW_BOOKS } from '@/features/library/EgwBookCatalog';
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
    'renders the EGW edition dialog on the $dark app canvas',
    (theme) => {
      const screen = renderWithPreferences(
        createElement(EgwEditionDialog, {
          closeLabel: 'Close',
          language: 'en',
          onDismiss: jest.fn(),
          openError: 'Could not open book.',
          opensOfficial: 'Opens official text',
          selectEditionLabel: 'Select an edition',
          work: EGW_BOOKS[0],
        }),
        { theme },
      );

      expect(
        StyleSheet.flatten(screen.UNSAFE_getByType(Dialog).props.style)
          .backgroundColor,
      ).toBe(theme.colors.background);
    },
  );
});
