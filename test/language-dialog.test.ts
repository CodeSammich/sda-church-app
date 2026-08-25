import { LanguageDialog } from '@/components/LanguageDialog';
import { fireEvent } from '@testing-library/react-native';
import { createElement } from 'react';
import { Dialog } from 'react-native-paper';
import { StyleSheet } from 'react-native';
import { customDarkTheme, customLightTheme } from '@/constants/Themes';
import { renderWithPreferences } from './helpers/render-preferences';

describe('LanguageDialog', () => {
  it.each([customLightTheme, customDarkTheme])(
    'uses the $dark app canvas as its dialog background',
    (theme) => {
      const screen = renderWithPreferences(
        createElement(LanguageDialog, {
          onDismiss: jest.fn(),
          visible: true,
        }),
        { theme },
      );

      expect(
        StyleSheet.flatten(screen.UNSAFE_getByType(Dialog).props.style)
          .backgroundColor,
      ).toBe(theme.colors.background);
      expect(
        StyleSheet.flatten(screen.UNSAFE_getByType(Dialog.ScrollArea).props.style)
          .borderBottomWidth,
      ).toBe(0);
      expect(
        StyleSheet.flatten(screen.UNSAFE_getByType(Dialog.ScrollArea).props.style)
          .marginBottom,
      ).toBe(0);
    },
  );

  it('changes the app language in place and dismisses', () => {
    const setLanguage = jest.fn();
    const onDismiss = jest.fn();
    const screen = renderWithPreferences(
      createElement(LanguageDialog, { onDismiss, visible: true }),
      { setLanguage },
    );

    expect(screen.getAllByRole('radio')).toHaveLength(4);
    fireEvent.press(screen.getByRole('radio', { name: /Simplified Chinese/ }));

    expect(setLanguage).toHaveBeenCalledWith('zh-cn');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
