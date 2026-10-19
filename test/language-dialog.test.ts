import { LanguageDialog } from '@/components/LanguageDialog';
import { fireEvent } from '@testing-library/react-native';
import { createElement } from 'react';
import { StyleSheet } from 'react-native';
import { customDarkTheme, customLightTheme } from '@/constants/Themes';
import { renderWithPreferences } from './helpers/render-preferences';

describe('LanguageDialog', () => {
  it.each([customLightTheme, customDarkTheme])(
    'uses the $dark app canvas as its dialog background',
    async (theme) => {
      const screen = await renderWithPreferences(
        createElement(LanguageDialog, {
          onDismiss: jest.fn(),
          visible: true,
        }),
        { theme },
      );

      expect(
        StyleSheet.flatten(screen.getByTestId('language-dialog-surface').props.style)
          .backgroundColor,
      ).toBe(theme.colors.background);
      expect(
        StyleSheet.flatten(screen.getByTestId('language-dialog-scroll-area').props.style)
          .borderBottomWidth,
      ).toBe(0);
      expect(
        StyleSheet.flatten(screen.getByTestId('language-dialog-scroll-area').props.style)
          .marginBottom,
      ).toBe(0);
    },
  );

  it('changes the app language in place and dismisses', async () => {
    const setLanguage = jest.fn();
    const onDismiss = jest.fn();
    const screen = await renderWithPreferences(
      createElement(LanguageDialog, { onDismiss, visible: true }),
      { setLanguage },
    );

    expect(screen.getAllByRole('radio')).toHaveLength(4);
    await fireEvent.press(screen.getByRole('radio', { name: /Simplified Chinese/ }));

    expect(setLanguage).toHaveBeenCalledWith('zh-cn');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
