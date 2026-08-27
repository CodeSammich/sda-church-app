import type { SupportedLanguage } from '@/constants/LanguageContext';

export type LibraryRights = 'public-domain-us' | 'official-external';
export type LibraryCollection =
  | 'adventist-pioneers'
  | 'christian-classics'
  | 'youth'
  | 'children';

export type LibraryItem = Readonly<{
  id: string;
  title: string;
  author: string;
  collection: LibraryCollection;
  description: string;
  language: 'en' | 'zh';
  rights: LibraryRights;
  sourceName: string;
  sourceUrl: string;
  publicationYear?: number;
  simplifiedChinese?: Readonly<{
    author: string;
    description: string;
    title: string;
  }>;
}>;

const publicDomainWorks: readonly LibraryItem[] = [
  {
    id: 'bates-seventh-day-sabbath',
    title: 'The Seventh Day Sabbath, a Perpetual Sign',
    author: 'Joseph Bates',
    collection: 'adventist-pioneers',
    description:
      'An 1847 Adventist pioneer work defending the continuing seventh-day Sabbath.',
    language: 'en',
    rights: 'public-domain-us',
    sourceName: 'Project Gutenberg',
    sourceUrl: 'https://www.gutenberg.org/ebooks/27266',
    publicationYear: 1847,
  },
  {
    id: 'andrews-history-sabbath',
    title: 'History of the Sabbath and First Day of the Week',
    author: 'J. N. Andrews',
    collection: 'adventist-pioneers',
    description:
      'The 1873 edition of an Adventist pioneer study of the Sabbath in Scripture and history.',
    language: 'en',
    rights: 'public-domain-us',
    sourceName: 'Project Gutenberg',
    sourceUrl: 'https://www.gutenberg.org/ebooks/68714',
    publicationYear: 1873,
  },
  {
    id: 'bunyan-pilgrims-progress',
    title: "The Pilgrim's Progress",
    author: 'John Bunyan',
    collection: 'christian-classics',
    description:
      'A classic Protestant allegory about perseverance, faith, and the Christian journey.',
    language: 'en',
    rights: 'public-domain-us',
    sourceName: 'Project Gutenberg',
    sourceUrl: 'https://www.gutenberg.org/ebooks/131',
    publicationYear: 1678,
  },
];

const officialCollections: readonly LibraryItem[] = [
  {
    id: 'story-of-jesus',
    title: 'The Story of Jesus',
    author: 'Ellen G. White',
    collection: 'children',
    description: 'A concise, child-friendly account of the life and ministry of Jesus.',
    language: 'en',
    rights: 'official-external',
    sourceName: 'EGW Writings',
    sourceUrl: 'https://text.egwwritings.org/read/144.1',
  },
];

// TODO: Add only verified, handpicked Chinese Adventist books and replace the
// generated English covers with verified official covers. Track both in:
// https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/176

export const LIBRARY_CATALOG = Object.freeze({
  publicDomainWorks,
  officialCollections,
});

export const getLibraryItemsForLanguage = (language: SupportedLanguage) => {
  const preferredLanguage = language === 'zh' || language === 'zh-cn' ? 'zh' : 'en';
  const rank = (item: LibraryItem) => (item.language === preferredLanguage ? 0 : 1);

  return {
    publicDomainWorks: [...publicDomainWorks].sort((a, b) => rank(a) - rank(b)),
    officialCollections: [...officialCollections].sort((a, b) => rank(a) - rank(b)),
  };
};

export const getLibraryItemDisplayText = (
  item: LibraryItem,
  language: SupportedLanguage,
) =>
  language === 'zh-cn' && item.simplifiedChinese
    ? item.simplifiedChinese
    : {
        author: item.author,
        description: item.description,
        title: item.title,
      };
