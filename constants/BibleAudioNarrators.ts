import type { SupportedLanguage } from '@/constants/LanguageContext';

type Names = Readonly<Record<SupportedLanguage, string>>;

// An English Bible narrator: the language first, so a member needn't know
// who Souer or Hays is.
const english = (narrator: string): Names => ({
  en: `English – ${narrator} (BSB)`,
  zh: `英語 – ${narrator}（BSB）`,
  'zh-cn': `英语 – ${narrator}（BSB）`,
  es: `Inglés – ${narrator} (BSB)`,
});

/**
 * What each Bible audio narrator is called, by its download name
 * (services/BibleAudioDownloads.ts): the language, then the narrator if the
 * recording names one, then the translation. Offline Bible Audio and the
 * Bible's audio settings use these (#556).
 */
export const BIBLE_AUDIO_NARRATOR_NAMES: Readonly<Record<string, Names>> = {
  'cuv-mandarin': {
    en: 'Mandarin (Chinese Union Version)',
    zh: '國語（和合本）',
    'zh-cn': '国语（和合本）',
    es: 'Mandarín (Versión Unión China)',
  },
  'cuv-cantonese': {
    en: 'Cantonese (Chinese Union Version)',
    zh: '粵語（和合本）',
    'zh-cn': '粤语（和合本）',
    es: 'Cantonés (Versión Unión China)',
  },
  rv1909: {
    en: 'Spanish (Reina-Valera 1909)',
    zh: '西班牙語（Reina-Valera 1909）',
    'zh-cn': '西班牙语（Reina-Valera 1909）',
    es: 'Español (Reina-Valera 1909)',
  },
  souer: english('Souer'),
  hays: english('Hays'),
  david: english('David'),
  // On openbible.com, so it can't be downloaded, but the audio settings name it.
  gilbert: english('Gilbert'),
};

/**
 * The one order narrators are listed in, wherever the app lists them: as the
 * Bible's translation picker lists their translations, BSB, then the CUV
 * (which the CUVS shares), then the RVR09. Not by what's downloaded, nor by
 * the app's language, so a narrator is always in the same place.
 */
export const BIBLE_AUDIO_NARRATOR_ORDER: readonly string[] = [
  'souer',
  'hays',
  'david',
  'gilbert',
  'cuv-mandarin',
  'cuv-cantonese',
  'rv1909',
];

/** A narrator's name in the app's language, or null for one this table doesn't know. */
export const getBibleAudioNarratorName = (narrator: string | null | undefined, language: SupportedLanguage) =>
  (narrator && BIBLE_AUDIO_NARRATOR_NAMES[narrator]?.[language]) || null;
