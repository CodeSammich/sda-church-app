import type { SupportedLanguage } from '@/constants/LanguageContext';
import { getSdaBibleEgwBookUrl, withSdaBibleInterface } from './SdaBibleReader';

export type EgwEditionLanguage = 'en' | 'zh' | 'es';
export type EgwBookCategory = 'conflict' | 'growth' | 'wholePerson';

/**
 * Where an edition opens. English and Spanish open on EGW Writings, the White
 * Estate's reader, at the book's first paragraph. Chinese opens in the Chinese
 * Union Mission's reader (#554), which is easier to read in; its `bookId` is
 * the Mission's, which also keys its cover catalog (ChineseLibrary.ts).
 */
export type EgwBookEdition = Readonly<
  | {
      language: 'en' | 'es';
      title: string;
      bookId: number;
      firstParagraph: string;
      url: string;
    }
  | {
      language: 'zh';
      title: string;
      bookId: number;
      url: string;
    }
>;

export type EgwBookWork = Readonly<{
  id: string;
  category: EgwBookCategory;
  workTitle: Readonly<Record<SupportedLanguage, string>>;
  editions: readonly EgwBookEdition[];
}>;

export const EGW_COVER_BASE_URL = 'https://a.egwwritings.org/covers/';

const readUrl = (firstParagraph: string) =>
  `https://text.egwwritings.org/read/${firstParagraph}`;

const edition = (
  language: 'en' | 'es',
  title: string,
  bookId: number,
  firstParagraph: string,
): EgwBookEdition => ({
  language,
  title,
  bookId,
  firstParagraph,
  url: readUrl(firstParagraph),
});

const chineseEdition = (title: string, bookId: number): EgwBookEdition => ({
  language: 'zh',
  title,
  bookId,
  url: getSdaBibleEgwBookUrl(bookId),
});

export const EGW_BOOKS: readonly EgwBookWork[] = [
  {
    id: 'patriarchs-and-prophets',
    category: 'conflict',
    workTitle: {
      en: 'Patriarchs and Prophets',
      zh: '先祖與先知',
      'zh-cn': '先祖与先知',
      es: 'Patriarcas y Profetas',
    },
    editions: [
      edition('en', 'Patriarchs and Prophets', 84, '84.4'),
      chineseEdition('先祖与先知', 127),
      edition('es', 'Historia de los Patriarcas y Profetas', 1704, '1704.2'),
    ],
  },
  {
    id: 'prophets-and-kings',
    category: 'conflict',
    workTitle: {
      en: 'Prophets and Kings',
      zh: '先知與君王',
      'zh-cn': '先知与君王',
      es: 'Profetas y Reyes',
    },
    editions: [
      edition('en', 'Prophets and Kings', 88, '88.8'),
      chineseEdition('先知与君王', 128),
      edition('es', 'Profetas y Reyes', 217, '217.2'),
    ],
  },
  {
    id: 'desire-of-ages',
    category: 'conflict',
    workTitle: {
      en: 'The Desire of Ages',
      zh: '歷代願望',
      'zh-cn': '历代愿望',
      es: 'El Deseado de Todas las Gentes',
    },
    editions: [
      edition('en', 'The Desire of Ages', 130, '130.4'),
      chineseEdition('历代愿望', 55),
      edition('es', 'El Deseado de Todas las Gentes', 174, '174.2'),
    ],
  },
  {
    id: 'acts-of-the-apostles',
    category: 'conflict',
    workTitle: {
      en: 'The Acts of the Apostles',
      zh: '使徒行述',
      'zh-cn': '使徒行述',
      es: 'Los Hechos de los Apóstoles',
    },
    editions: [
      edition('en', 'The Acts of the Apostles', 127, '127.5'),
      chineseEdition('使徒行述', 81),
      edition('es', 'Los Hechos de los Apóstoles', 198, '198.2'),
    ],
  },
  {
    id: 'great-controversy',
    category: 'conflict',
    workTitle: {
      en: 'The Great Controversy',
      zh: '善惡之爭',
      'zh-cn': '善恶之争',
      es: 'El Conflicto de los Siglos',
    },
    editions: [
      edition('en', 'The Great Controversy', 132, '132.2'),
      chineseEdition('善恶之争', 75),
      edition('es', 'El Conflicto de los Siglos', 1710, '1710.2'),
    ],
  },
  {
    id: 'steps-to-christ',
    category: 'growth',
    workTitle: {
      en: 'Steps to Christ',
      zh: '喜樂的泉源',
      'zh-cn': '喜乐的泉源',
      es: 'El Camino a Cristo',
    },
    editions: [
      edition('en', 'Steps to Christ', 108, '108.4'),
      chineseEdition('喜乐的泉源', 120),
      edition('es', 'El Camino a Cristo', 1749, '1749.3'),
    ],
  },
  {
    id: 'christs-object-lessons',
    category: 'growth',
    workTitle: {
      en: 'Christ’s Object Lessons',
      zh: '基督比喻實訓',
      'zh-cn': '基督比喻实训',
      es: 'Palabras de Vida del Gran Maestro',
    },
    editions: [
      edition('en', 'Christ’s Object Lessons', 15, '15.5'),
      chineseEdition('基督比喻实训', 34),
      edition('es', 'Palabras de Vida del Gran Maestro', 210, '210.2'),
    ],
  },
  {
    id: 'ministry-of-healing',
    category: 'wholePerson',
    workTitle: {
      en: 'The Ministry of Healing',
      zh: '服務真詮',
      'zh-cn': '服务真诠',
      es: 'El Ministerio de Curación',
    },
    editions: [
      edition('en', 'The Ministry of Healing', 135, '135.6'),
      chineseEdition('服务真诠', 16),
      edition('es', 'El Ministerio de Curación', 1757, '1757.2'),
    ],
  },
  {
    id: 'education',
    category: 'wholePerson',
    workTitle: {
      en: 'Education',
      zh: '教育論',
      'zh-cn': '教育论',
      es: 'La Educación',
    },
    editions: [
      edition('en', 'Education', 29, '29.5'),
      chineseEdition('教育论', 50),
      edition('es', 'La Educación', 1702, '1702.2'),
    ],
  },
  {
    id: 'child-guidance',
    category: 'wholePerson',
    workTitle: {
      en: 'Child Guidance',
      zh: '兒童教育指南',
      'zh-cn': '儿童教育指南',
      es: 'Conducción del Niño',
    },
    editions: [
      edition('en', 'Child Guidance', 8, '8.4'),
      chineseEdition('儿童教育指南', 13),
      edition('es', 'Conducción del Niño', 157, '157.2'),
    ],
  },
  {
    id: 'messages-to-young-people',
    category: 'growth',
    workTitle: {
      en: 'Messages to Young People',
      zh: '告青年書',
      'zh-cn': '告青年书',
      es: 'Mensajes para los Jóvenes',
    },
    editions: [
      edition('en', 'Messages to Young People', 76, '76.1'),
      chineseEdition('告青年书', 23),
      edition('es', 'Mensajes para los Jóvenes', 1769, '1769.1'),
    ],
  },
];

export const EGW_BOOK_CATEGORIES: readonly EgwBookCategory[] = [
  'conflict',
  'growth',
  'wholePerson',
];

/**
 * The edition a book opens in: the app language's, like every other Library
 * book. Traditional and Simplified Chinese share the one Chinese edition.
 */
export const getEgwEditionForLanguage = (
  work: EgwBookWork,
  language: SupportedLanguage,
): EgwBookEdition => {
  const preferred: EgwEditionLanguage =
    language === 'zh' || language === 'zh-cn'
      ? 'zh'
      : language === 'es'
        ? 'es'
        : 'en';

  return (
    work.editions.find((edition) => edition.language === preferred) ??
    work.editions.find((edition) => edition.language === 'en') ??
    work.editions[0]
  );
};

/** The link a book opens: its edition in the app language, in the app's script. */
export const getEgwBookUrlForLanguage = (work: EgwBookWork, language: SupportedLanguage) =>
  withSdaBibleInterface(getEgwEditionForLanguage(work, language).url, language);

const getOfficialCoverUrl = (edition: EgwBookEdition) =>
  `${EGW_COVER_BASE_URL}${edition.bookId}?type=small`;

export const getEgwCoverUrlsForLanguage = (
  work: EgwBookWork,
  language: SupportedLanguage,
  chineseCoverUrl?: string,
) => {
  const englishEdition = work.editions.find((edition) => edition.language === 'en');
  const spanishEdition = work.editions.find((edition) => edition.language === 'es');
  const urls: string[] = [];

  if ((language === 'zh' || language === 'zh-cn') && chineseCoverUrl) {
    urls.push(chineseCoverUrl);
  } else if (language === 'es' && spanishEdition) {
    urls.push(getOfficialCoverUrl(spanishEdition));
  }

  if (englishEdition) urls.push(getOfficialCoverUrl(englishEdition));

  return urls;
};
