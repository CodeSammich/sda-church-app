import { createContext } from "react";

export type SupportedLanguage = "en" | "zh" | "zh-cn" | "es";

export const DEFAULT_LANG = "en";

export const LanguageContext = createContext({
  language: DEFAULT_LANG as SupportedLanguage,
  languageSelectionRevision: 0,
  setLanguage: (lang: SupportedLanguage) => {},
});
