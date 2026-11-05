import { LanguageContext, type SupportedLanguage } from '@/constants/LanguageContext';
import { TextSizeContext } from '@/constants/TextSizeContext';
import {
  CONTRAST_HIGH,
  ThemeContext,
  THEME_DARK,
  THEME_LIGHT,
  type AppTheme,
  type ContrastMode,
  type ThemeMode,
} from '@/constants/Themes';
import { render } from '@testing-library/react-native';
import { createElement, type ReactElement } from 'react';
import {
  DEFAULT_TEXT_SCALE,
  type TextScale,
} from '@/constants/AppPreferences';
import { PaperProvider } from 'react-native-paper';

interface PreferenceRenderOptions {
  language?: SupportedLanguage;
  setLanguage?: (language: SupportedLanguage) => void;
  setTextScale?: (scale: TextScale) => Promise<void>;
  textScale?: TextScale;
  defaultTextScale?: TextScale;
  theme?: AppTheme;
  themeMode?: ThemeMode;
  setThemeMode?: (mode: ThemeMode) => void;
  toggleTheme?: (value?: unknown) => void;
  contrastMode?: ContrastMode;
  setContrastMode?: (mode: ContrastMode) => void;
}

export const renderWithPreferences = (
  element: ReactElement,
  {
    language = 'en',
    setLanguage = jest.fn(),
    setTextScale = jest.fn().mockResolvedValue(undefined),
    textScale = DEFAULT_TEXT_SCALE,
    defaultTextScale,
    theme,
    themeMode = theme?.dark ? THEME_DARK : THEME_LIGHT,
    setThemeMode = jest.fn(),
    toggleTheme = jest.fn(),
    contrastMode = CONTRAST_HIGH,
    setContrastMode = jest.fn(),
  }: PreferenceRenderOptions = {},
) =>
  render(
    createElement(
      PaperProvider,
      theme
        ? { children: undefined, theme: theme as any }
        : { children: undefined },
      createElement(
        LanguageContext.Provider,
        {
          value: {
            language,
            languageSelectionRevision: 0,
            setLanguage,
          },
        },
        createElement(
          TextSizeContext.Provider,
          { value: { setTextScale, textScale, defaultTextScale } },
          createElement(
            ThemeContext.Provider,
            { value: { themeMode, setThemeMode, toggleTheme, contrastMode, setContrastMode } },
            element,
          ),
        ),
      ),
    ),
  );
