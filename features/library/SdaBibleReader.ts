import { Platform } from 'react-native';

import { openInItsApp, openURL } from '@/constants/ExternalLinks';
import type { SupportedLanguage } from '@/constants/LanguageContext';

/**
 * The online reader of the Chinese Union Mission's SDA Bible app (#554). The
 * Library links its Chinese books here, Ellen G. White's included, and the
 * Explore tab links the whole app. A book's page is `/library/work/<slug>`:
 * `egw-<book id>` for her books, `m-<number>` for the others.
 */
export const SDA_BIBLE_READER_ORIGIN = 'https://read.sdabible.org';

/** The SDA Bible app on the App Store. It isn't on Google Play. */
export const SDA_BIBLE_APP_STORE_URL = 'https://apps.apple.com/us/app/sda-bible/id6823826805';

/** The reader's interface languages: Traditional and Simplified Chinese, and English. */
const READER_INTERFACE: Readonly<Record<SupportedLanguage, 'tc' | 'cn' | 'en'>> = {
  zh: 'tc',
  'zh-cn': 'cn',
  en: 'en',
  es: 'en',
};

/**
 * A reader link that opens in the app's script, through the reader's `ui`
 * parameter. Links to other sites come back unchanged.
 */
export const withSdaBibleInterface = (url: string, language: SupportedLanguage) => {
  if (!url.startsWith(`${SDA_BIBLE_READER_ORIGIN}/`)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}ui=${READER_INTERFACE[language]}`;
};

/** A book of Ellen G. White's in the reader, by the Mission's book id. */
export const getSdaBibleEgwBookUrl = (bookId: number) =>
  `${SDA_BIBLE_READER_ORIGIN}/library/work/egw-${bookId}`;

/**
 * Opens the SDA Bible app for in-depth study: its App Store page on an iPhone
 * or iPad, and its online reader, in the app's script, on Android and the web.
 */
export const openSdaBible = (language: SupportedLanguage) =>
  Platform.OS === 'ios'
    ? openInItsApp(SDA_BIBLE_APP_STORE_URL)
    : openURL(withSdaBibleInterface(`${SDA_BIBLE_READER_ORIGIN}/`, language));
