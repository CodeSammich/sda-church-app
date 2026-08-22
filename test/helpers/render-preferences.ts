import { LanguageContext, type SupportedLanguage } from '@/constants/LanguageContext';
import { TextSizeContext } from '@/constants/TextSizeContext';
import { ThemeContext } from '@/constants/Themes';
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
  toggleTheme?: (value?: unknown) => void;
}

export const renderWithPreferences = (
  element: ReactElement,
  {
    language = 'en',
    setLanguage = jest.fn(),
    setTextScale = jest.fn().mockResolvedValue(undefined),
    textScale = DEFAULT_TEXT_SCALE,
    toggleTheme = jest.fn(),
  }: PreferenceRenderOptions = {},
) =>
  render(
    createElement(
      PaperProvider,
      null,
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
          { value: { setTextScale, textScale } },
          createElement(
            ThemeContext.Provider,
            { value: { toggleTheme } },
            element,
          ),
        ),
      ),
    ),
  );
