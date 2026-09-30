import type { SupportedLanguage } from '@/constants/LanguageContext';
import type { LibraryShelf } from './LibraryShelves';

export type LibraryRights = 'public-domain-us' | 'official-external' | 'church-hosted';
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
  // The year of the scanned edition a link opens, when it differs from the
  // original. Required for Internet Archive scans, whose own edition must be
  // public domain too; see "Internet Archive sources" in docs/LEGAL.md.
  editionYear?: number;
  // Chinese text for a Chinese book, shown in the matching app language. Other
  // languages show the English text above, so titles stay in one language.
  traditionalChinese?: LibraryItemText;
  simplifiedChinese?: LibraryItemText;
}>;

type LibraryItemText = Readonly<{
  author: string;
  description: string;
  title: string;
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
    id: 'smith-state-dead-destiny-wicked',
    title: 'The State of the Dead and the Destiny of the Wicked',
    author: 'Uriah Smith',
    collection: 'adventist-pioneers',
    description:
      'An 1873 Adventist pioneer study of the Bible teaching on death and the final destiny of the wicked.',
    language: 'en',
    rights: 'public-domain-us',
    sourceName: 'Project Gutenberg',
    sourceUrl: 'https://www.gutenberg.org/ebooks/54373',
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
  {
    id: 'murray-humility',
    title: 'Humility: The Beauty of Holiness',
    author: 'Andrew Murray',
    collection: 'christian-classics',
    description:
      'A classic devotional on humility as the root of holiness, drawn from the life and teaching of Jesus.',
    language: 'en',
    rights: 'public-domain-us',
    sourceName: 'Project Gutenberg',
    sourceUrl: 'https://www.gutenberg.org/ebooks/57121',
    publicationYear: 1895,
  },
  {
    // Not on Project Gutenberg. This scan is the 1895 Revell edition (Chicago,
    // New York, Toronto), microfilmed from the National Library of Canada's
    // copy; it adds only the publisher's 1895 list of Murray's other books.
    // Don't use archive.org's abideinchristtho0000murr: it is a 2013 reprint
    // catalogued as 1880. Checked against the rules in docs/LEGAL.md.
    id: 'murray-abide-in-christ',
    title: 'Abide in Christ',
    author: 'Andrew Murray',
    collection: 'christian-classics',
    description:
      "Thirty-one daily meditations on Jesus's call in John 15 to abide in Him.",
    language: 'en',
    rights: 'public-domain-us',
    sourceName: 'Internet Archive',
    sourceUrl: 'https://archive.org/details/cihm_11323',
    publicationYear: 1882,
    editionYear: 1895,
  },
  {
    // Gutenberg's only Foxe record is an abridged nineteenth-century American
    // edition, not Foxe's full text, so the description says so.
    id: 'foxe-book-of-martyrs',
    title: "Foxe's Book of Martyrs",
    author: 'John Foxe',
    collection: 'christian-classics',
    description:
      'An abridged nineteenth-century edition of the Protestant history of Christian martyrs, with added accounts of persecution up to 1830.',
    language: 'en',
    rights: 'public-domain-us',
    sourceName: 'Project Gutenberg',
    sourceUrl: 'https://www.gutenberg.org/ebooks/22400',
    publicationYear: 1563,
  },
  {
    // Not on Project Gutenberg. This scan is the 1838 Pickering edition, which
    // also contains A Fountain Sealed and A Description of Christ; its only
    // later addition is the 1838 editor's preface. Checked against the rules in
    // docs/LEGAL.md, and the dependency monitor rechecks its access daily.
    id: 'sibbes-bruised-reed',
    title: 'The Bruised Reed',
    author: 'Richard Sibbes',
    collection: 'christian-classics',
    description:
      "A Puritan classic on Christ's tenderness toward weak and struggling believers, drawn from Isaiah 42:3.",
    language: 'en',
    rights: 'public-domain-us',
    sourceName: 'Internet Archive',
    sourceUrl: 'https://archive.org/details/bwb_C0-AVW-616',
    publicationYear: 1630,
    editionYear: 1838,
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
  {
    // Not on Project Gutenberg. EGW Writings hosts the public-domain 1897
    // edition; later revisions such as the 1944 edition are still copyrighted.
    id: 'smith-daniel-revelation',
    title: 'Daniel and the Revelation',
    author: 'Uriah Smith',
    collection: 'adventist-pioneers',
    description:
      "The 1897 edition of Uriah Smith's verse-by-verse Adventist commentary on the prophecies of Daniel and Revelation.",
    language: 'en',
    rights: 'official-external',
    sourceName: 'EGW Writings',
    sourceUrl: 'https://text.egwwritings.org/read/12861.1',
    publicationYear: 1897,
  },
];

// Documents the church publishes itself, served with the web app from
// `public/library/`.
const churchDocuments: readonly LibraryItem[] = [
  {
    // Also the backup of the Drive file the Brooklyn bulletin reads its weekly
    // Sabbath Encouragement page from (SABBATH_ENCOURAGEMENT_SOURCE_FILE_ID in
    // google-apps-script/SabbathEncouragement.gs). Keep the Drive file name.
    id: 'sabbath-encouragement',
    title: 'Sabbath Encouragement',
    author: 'Bible and Ellen G. White quotations',
    collection: 'adventist-pioneers',
    description:
      'Fifty-two readings of Bible verses and Ellen G. White quotations on the Sabbath, compiled by churches in China. The Brooklyn bulletin prints one each week.',
    language: 'zh',
    rights: 'church-hosted',
    sourceName: 'New York Chinese SDA Church',
    sourceUrl: 'https://app.nyccsda.org/library/sabbath_encouragement.pdf',
    traditionalChinese: {
      title: '安息日勉言',
      author: '聖經與懷愛倫著作摘錄',
      description:
        '五十二篇關於安息日的聖經經文與懷愛倫著作摘錄，由中國教會編輯。布魯克林週報每週刊登一篇。',
    },
    simplifiedChinese: {
      title: '安息日勉言',
      author: '圣经与怀爱伦著作摘录',
      description:
        '五十二篇关于安息日的圣经经文与怀爱伦著作摘录，由中国教会编辑。布鲁克林周报每周刊登一篇。',
    },
  },
];

// TODO: Add only verified, handpicked Chinese Adventist books and replace the
// generated English covers with verified official covers. Track both in:
// https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/176

export const LIBRARY_CATALOG = Object.freeze({
  publicDomainWorks,
  officialCollections,
  churchDocuments,
});

// The Sabbath Encouragement quotations sit with Ellen G. White's books. Other
// works are shelved by collection.
const ITEM_SHELVES: Readonly<Record<string, LibraryShelf>> = {
  'sabbath-encouragement': 'egw',
};
const COLLECTION_SHELVES: Readonly<Record<LibraryCollection, LibraryShelf>> = {
  'adventist-pioneers': 'pioneers',
  'christian-classics': 'classics',
  youth: 'youth',
  children: 'children',
};

/** The library shelf (the `[collection]` route) that lists this work. */
export const getLibraryItemShelf = (item: LibraryItem): LibraryShelf =>
  ITEM_SHELVES[item.id] ?? COLLECTION_SHELVES[item.collection];

export const getLibraryItemsForLanguage = (language: SupportedLanguage) => {
  const preferredLanguage = language === 'zh' || language === 'zh-cn' ? 'zh' : 'en';
  const rank = (item: LibraryItem) => (item.language === preferredLanguage ? 0 : 1);

  return {
    publicDomainWorks: [...publicDomainWorks].sort((a, b) => rank(a) - rank(b)),
    officialCollections: [...officialCollections].sort((a, b) => rank(a) - rank(b)),
    churchDocuments: [...churchDocuments].sort((a, b) => rank(a) - rank(b)),
  };
};

export const getLibraryItemDisplayText = (
  item: LibraryItem,
  language: SupportedLanguage,
): LibraryItemText =>
  (language === 'zh' && item.traditionalChinese) ||
  (language === 'zh-cn' && item.simplifiedChinese) || {
    author: item.author,
    description: item.description,
    title: item.title,
  };
