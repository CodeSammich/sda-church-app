import { LanguageDialog } from '@/components/LanguageDialog';
import { fireEvent } from '@testing-library/react-native';
import { createElement } from 'react';
import { customDarkTheme, customLightTheme } from '@/constants/Themes';
import { renderWithPreferences } from './helpers/render-preferences';
import { getSheetColor } from './helpers/sheets';

describe('LanguageDialog', () => {
  it.each([customLightTheme, customDarkTheme])(
    'is a sheet the colour of the $dark theme\'s floating bars (#867)',
    async (theme) => {
      const screen = await renderWithPreferences(
        createElement(LanguageDialog, {
          onDismiss: jest.fn(),
          visible: true,
        }),
        { theme },
      );

      expect(getSheetColor(screen)).toBe(theme.colors.floatingSurface);
      expect(screen.getByTestId('language-dialog-scroll')).toBeTruthy();
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
    await fireEvent.press(screen.getByRole('radio', { name: '简体中文' }));

    expect(setLanguage).toHaveBeenCalledWith('zh-cn');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('names each language only in its own language (#867)', async () => {
    const screen = await renderWithPreferences(
      createElement(LanguageDialog, { onDismiss: jest.fn(), visible: true }),
    );

    for (const name of ['English', '繁體中文', '简体中文', 'Español']) {
      expect(screen.getByRole('radio', { name })).toBeTruthy();
    }
    for (const english of ['Traditional Chinese', 'Simplified Chinese', 'Spanish']) {
      expect(screen.queryByText(english)).toBeNull();
    }
    expect(screen.getByRole('radio', { name: '繁體中文' })).toHaveProp('accessibilityLanguage', 'zh-Hant');
  });
});
