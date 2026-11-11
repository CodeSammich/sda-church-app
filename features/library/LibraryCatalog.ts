import type { SupportedLanguage } from '@/constants/LanguageContext';
import type { LibraryShelf } from './LibraryShelves';
import { withSdaBibleInterface } from './SdaBibleReader';

export type LibraryRights =
  | 'public-domain-us'
  | 'official-external'
  | 'church-hosted'
  // The publisher offers the edition free and its own notice allows copying
  // it; the app still only links to the publisher's copy.
  | 'permission-to-copy';
export type LibraryCollection =
  | 'adventist-pioneers'
  | 'christian-classics'
  | 'youth'
  | 'children'
  | 'contemporary-adventist';

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
  // Chinese text for a Chinese book or a book's Chinese edition, shown in the
  // matching app language. Other languages show the English text above, so
  // titles stay in one language.
  traditionalChinese?: LibraryItemText;
  simplifiedChinese?: LibraryItemText;
  // A Chinese edition, which Chinese readers open instead, titled with the
  // text above. One edition serves both scripts, even if it is printed in
  // traditional characters only. An edition in the Chinese Union Mission's
  // reader brings the reader's cover thumbnail, which only Chinese readers
  // see. See "Library Sources and Licensing" in docs/LEGAL.md.
  chineseEdition?: LibraryItemSource & Readonly<{ coverUrl?: string }>;
  // A Chinese book with no free English or Spanish edition to link: only
  // Chinese readers see it in the Library, on its shelf, in the featured
  // books, and in search. The app doesn't machine-translate books (#703).
  onlyForChineseReaders?: boolean;
  // A Spanish edition, which Spanish readers see and open instead. It has its
  // own source and rights basis; see "Library Sources and Licensing" in
  // docs/LEGAL.md.
  spanish?: LibraryItemEdition;
  // The publisher's own cover thumbnail, shown only to identify the book, for
  // books with no bundled cover; see the Chinese Union Mission row in
  // docs/LEGAL.md. Without a connection the book shows the placeholder.
  // A Chinese edition's thumbnail goes in `chineseEdition` instead.
  coverUrl?: string;
}>;

type LibraryItemText = Readonly<{
  author: string;
  description: string;
  title: string;
}>;

type LibraryItemSource = Readonly<{
  rights: LibraryRights;
  sourceName: string;
  sourceUrl: string;
}>;

type LibraryItemEdition = LibraryItemText & LibraryItemSource;

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
    // Adventist Pioneer Library's 2020 translation of the 1873 edition, by
    // Rolando Itin, on EGW Writings. Its credits page names the 1873 original.
    spanish: {
      title: 'Historia del Sábado',
      author: 'J. N. Andrews',
      description:
        'La edición de 1873 de un estudio pionero adventista sobre el sábado en las Escrituras y en la historia, traducida al español.',
      rights: 'official-external',
      sourceName: 'EGW Writings',
      sourceUrl: 'https://text.egwwritings.org/read/14404.2',
    },
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
    // The 1869 Mandarin (官話) edition of William C. Burns's translation of
    // Part 1, from the American Presbyterian Mission Press (美華書館) in
    // Shanghai, printed in traditional characters, so Simplified readers get
    // it too. HathiTrust marks the scan public domain. Not Burns's 1853
    // classical (文理) version, which few readers today can follow.
    traditionalChinese: {
      title: '天路歷程',
      author: '約翰·班揚',
      description:
        '經典的新教寓言，講述信心、堅忍與基督徒的天路旅程。這是1869年的官話譯本，以繁體字印行。',
    },
    simplifiedChinese: {
      title: '天路历程',
      author: '约翰·班扬',
      description:
        '经典的新教寓言，讲述信心、坚忍与基督徒的天路旅程。这是1869年的官话译本，以繁体字印行。',
    },
    chineseEdition: {
      rights: 'public-domain-us',
      sourceName: 'HathiTrust',
      sourceUrl: 'https://babel.hathitrust.org/cgi/pt?id=uc1.b3399258',
    },
    // Chapel Library's own free PDF, which it calls "cuidadosamente abreviada"
    // (carefully abridged). Its © 2015 notice expressly allows copying it at
    // no more than a nominal cost, with the notice kept.
    spanish: {
      title: 'El progreso del peregrino para todos (condensado)',
      author: 'Juan Bunyan',
      description:
        'Una edición abreviada de la clásica alegoría protestante sobre la perseverancia, la fe y el camino cristiano.',
      rights: 'permission-to-copy',
      sourceName: 'Chapel Library',
      sourceUrl: 'https://www.chapellibrary.org/pdf/books/ppfes.pdf',
    },
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
  {
    // The 1905 Philadelphia edition (H. W. B. Conrad), a Library of Congress
    // copyright-deposit copy. Its title page reads "Story of the Bible Told for
    // Young and Old" and carries the 1904 copyright; archive.org catalogs it as
    // "Mother's story of the Bible". The 1932 and later revisions are lend-only
    // and still copyrighted, so don't substitute them. Checked against the
    // rules in docs/LEGAL.md.
    id: 'hurlbut-story-of-the-bible',
    title: 'Story of the Bible Told for Young and Old',
    author: 'Jesse Lyman Hurlbut',
    collection: 'children',
    description:
      'The whole Bible as 168 stories in order, from Creation to Revelation, for children and families to read together.',
    language: 'en',
    rights: 'public-domain-us',
    sourceName: 'Internet Archive',
    sourceUrl: 'https://archive.org/details/mothersstoryofbi00hurl',
    publicationYear: 1904,
    editionYear: 1905,
  },
  {
    id: 'hurlbut-life-of-christ',
    title: "Hurlbut's Life of Christ for Young and Old",
    author: 'Jesse Lyman Hurlbut',
    collection: 'children',
    description:
      'The life of Jesus from the four Gospels, written for children of about ten.',
    language: 'en',
    rights: 'public-domain-us',
    sourceName: 'Project Gutenberg',
    sourceUrl: 'https://www.gutenberg.org/ebooks/40460',
    publicationYear: 1915,
  },
  {
    // The 1903 first edition: the title page reads London, Morgan & Scott,
    // and China Inland Mission, MCMIII (archive.org's "Philadelphia" is
    // wrong). Cornell's scan states no known U.S. copyright restrictions. Not
    // the later abridged editions. Checked against the rules in docs/LEGAL.md.
    id: 'taylor-pastor-hsi',
    title: "Pastor Hsi: One of China's Christians",
    author: 'Mrs. Howard Taylor',
    collection: 'youth',
    description:
      'The life of Hsi Shengmo, a Confucian scholar in North China who was freed from opium and became a pastor.',
    language: 'en',
    rights: 'public-domain-us',
    sourceName: 'Internet Archive',
    sourceUrl: 'https://archive.org/details/cu31924023085875',
    publicationYear: 1903,
    editionYear: 1903,
  },
  {
    // The 1911 London edition (Morgan & Scott, MCMXI on the title page).
    // Don't use hudsontaylorin00tayl: it is catalogued as 1911 London but is
    // the 1912 New York printing. Checked against the rules in docs/LEGAL.md.
    id: 'taylor-hudson-taylor-early-years',
    title: 'Hudson Taylor in Early Years: The Growth of a Soul',
    author: 'Dr. and Mrs. Howard Taylor',
    collection: 'youth',
    description:
      'How Hudson Taylor answered a call to China as a young man and went on to found the China Inland Mission.',
    language: 'en',
    rights: 'public-domain-us',
    sourceName: 'Internet Archive',
    sourceUrl: 'https://archive.org/details/hudsontaylorinea00unse_0',
    publicationYear: 1911,
    editionYear: 1911,
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
    // The official Spanish edition, whose chapters match The Story of Jesus
    // one for one; both descend from the 1896 Christ Our Saviour.
    spanish: {
      title: 'Cristo Nuestro Salvador',
      author: 'Elena G. de White',
      description: 'Un relato breve y apto para niños de la vida y el ministerio de Jesús.',
      rights: 'official-external',
      sourceName: 'EGW Writings',
      sourceUrl: 'https://text.egwwritings.org/read/1747.3',
    },
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
    author: 'Various',
    collection: 'adventist-pioneers',
    description:
      'Fifty-two readings of Bible verses and Ellen G. White quotations on the Sabbath, compiled by churches in China. The Brooklyn bulletin prints one each week.',
    language: 'zh',
    onlyForChineseReaders: true,
    rights: 'church-hosted',
    sourceName: 'New York Chinese SDA Church',
    sourceUrl: 'https://app.nyccsda.org/library/sabbath_encouragement.pdf',
    traditionalChinese: {
      title: '安息日勉言',
      author: '多位作者',
      description:
        '五十二篇關於安息日的聖經經文與懷愛倫著作摘錄，由中國教會編輯。布魯克林週報每週刊登一篇。',
    },
    simplifiedChinese: {
      title: '安息日勉言',
      author: '多位作者',
      description:
        '五十二篇关于安息日的圣经经文与怀爱伦著作摘录，由中国教会编辑。布鲁克林周报每周刊登一篇。',
    },
  },
];

// Books the church's leaders chose from the Chinese Union Mission's online
// reader (#554), nearly all by today's Adventist writers. They're linked, not
// copied. Chinese readers open each one's page in the reader, in the app's
// script, with the reader's cover thumbnail. Titles and authors are from the
// covers; the reader lists no authors.
//
// Seven were written in English and are free in English on their publisher's
// or a public-domain library's site, six of them in Spanish too, so English and
// Spanish readers open those originals (#703). The other seven are sold in
// English, so only Chinese readers see them.
const sdaBibleBooks: readonly LibraryItem[] = [
  {
    // Published anonymously: its author signed it "An Unknown Christian". Its
    // first printing is undated, but its only date is August 1921, and its
    // author began publishing that year, so it's almost certainly from the
    // 1920s and public domain in the U.S. That isn't confirmed; see the CCEL
    // row in docs/LEGAL.md (#703). Not an Adventist book, so it sits with the
    // classics.
    id: 'kneeling-christian',
    title: 'The Kneeling Christian',
    author: 'An Unknown Christian',
    collection: 'christian-classics',
    description: 'A classic call to prayer: why it matters and how to pray.',
    language: 'en',
    rights: 'public-domain-us',
    sourceName: 'Christian Classics Ethereal Library',
    sourceUrl: 'https://www.ccel.org/ccel/unknown/kneeling.html',
    chineseEdition: {
      rights: 'official-external',
      sourceName: 'SDA Bible',
      sourceUrl: 'https://read.sdabible.org/library/work/m-162',
      coverUrl: 'https://read.sdabible.org/api/library/assets/25/thumb',
    },
    traditionalChinese: {
      title: '跪下的基督徒',
      author: '佚名',
      description: '論禱告的經典之作：禱告為何重要，又當如何禱告。',
    },
    simplifiedChinese: {
      title: '跪下的基督徒',
      author: '佚名',
      description: '论祷告的经典之作：祷告为何重要，又当如何祷告。',
    },
  },
  {
    id: 'batchelor-richest-caveman',
    title: 'The Richest Caveman',
    author: 'Doug Batchelor',
    collection: 'contemporary-adventist',
    description:
      'Doug Batchelor tells how he left a wealthy home to live in a cave, and found the Bible there.',
    language: 'zh',
    onlyForChineseReaders: true,
    rights: 'official-external',
    sourceName: 'SDA Bible',
    sourceUrl: 'https://read.sdabible.org/library/work/m-411',
    coverUrl: 'https://read.sdabible.org/api/library/assets/317/thumb',
    traditionalChinese: {
      title: '最富有的穴居人',
      author: '道格·巴契勒',
      description: '道格·巴契勒親述：他離開富裕的家，獨自住進山洞，在那裡讀到了《聖經》。',
    },
    simplifiedChinese: {
      title: '最富有的穴居人',
      author: '道格·巴契勒',
      description: '道格·巴契勒亲述：他离开富裕的家，独自住进山洞，在那里读到了《圣经》。',
    },
  },
  {
    id: 'crews-last-night-on-earth',
    title: 'The Last Night on Earth',
    author: 'Joe Crews',
    collection: 'contemporary-adventist',
    description: 'Everyone will have a last night on earth: on being ready for it.',
    language: 'en',
    rights: 'official-external',
    sourceName: 'Amazing Facts',
    sourceUrl: 'https://www.amazingfacts.org/study/free-books/the-last-night-on-earth/',
    spanish: {
      title: 'La última noche en la Tierra',
      author: 'Joe Crews',
      description: 'Todos tendremos una última noche en la tierra: cómo estar preparados para ella.',
      rights: 'official-external',
      sourceName: 'Amazing Facts',
      sourceUrl:
        'https://www.amazingfacts.org/es/estudiar/biblioteca-de-libros-gratuitos/la-ultima-noche-en-la-tierra/',
    },
    chineseEdition: {
      rights: 'official-external',
      sourceName: 'SDA Bible',
      sourceUrl: 'https://read.sdabible.org/library/work/m-407',
      coverUrl: 'https://read.sdabible.org/api/library/assets/819/thumb',
    },
    traditionalChinese: {
      title: '地上的最後一夜',
      author: '喬·克魯斯',
      description: '每個人都會經歷在地上的最後一夜：論如何為那一夜作好預備。',
    },
    simplifiedChinese: {
      title: '地上的最后一夜',
      author: '乔·克鲁斯',
      description: '每个人都会经历在地上的最后一夜：论如何为那一夜作好预备。',
    },
  },
  {
    id: 'jesske-deathwatch-in-siberia',
    title: 'Deathwatch in Siberia',
    author: 'W. S. Jesske',
    collection: 'contemporary-adventist',
    description:
      'A story from Siberia, where nineteenth-century Russia exiled people for living by their conscience.',
    language: 'en',
    rights: 'official-external',
    sourceName: 'Amazing Facts',
    sourceUrl: 'https://www.amazingfacts.org/study/free-books/deathwatch-in-siberia/',
    // Amazing Facts leaves the first word of its Spanish title in English.
    spanish: {
      title: 'Deathwatch en Siberia',
      author: 'W. S. Jesske',
      description:
        'Una historia de Siberia, adonde la Rusia del siglo XIX desterraba a quienes vivían según su conciencia.',
      rights: 'official-external',
      sourceName: 'Amazing Facts',
      sourceUrl:
        'https://www.amazingfacts.org/es/estudiar/biblioteca-de-libros-gratuitos/deathwatch-en-siberia/',
    },
    chineseEdition: {
      rights: 'official-external',
      sourceName: 'SDA Bible',
      sourceUrl: 'https://read.sdabible.org/library/work/m-435',
      coverUrl: 'https://read.sdabible.org/api/library/assets/847/thumb',
    },
    traditionalChinese: {
      title: '在西伯利亞的死神一瞥',
      author: '傑斯克',
      description: '發生在西伯利亞的故事：十九世紀的俄國把按良心生活的人流放到那裡。',
    },
    simplifiedChinese: {
      title: '在西伯利亚的死神一瞥',
      author: '杰斯克',
      description: '发生在西伯利亚的故事：十九世纪的俄国把按良心生活的人流放到那里。',
    },
  },
  {
    // The Chinese edition's cover credits Doug Batchelor, but its chapters
    // are Joe Crews's Remember Lot's Wife, heading for heading, as Amazing
    // Facts publishes it. Every language credits Joe Crews.
    id: 'crews-remember-lots-wife',
    title: "Remember Lot's Wife",
    author: 'Joe Crews',
    collection: 'contemporary-adventist',
    description: "Lot's wife as a warning against drifting from the truth without noticing.",
    language: 'en',
    rights: 'official-external',
    sourceName: 'Amazing Facts',
    sourceUrl: 'https://www.amazingfacts.org/study/free-books/remember-lots-wife/',
    spanish: {
      title: 'Recuerda a la mujer de Lot',
      author: 'Joe Crews',
      description:
        'La mujer de Lot como advertencia contra apartarse de la verdad sin darse cuenta.',
      rights: 'official-external',
      sourceName: 'Amazing Facts',
      sourceUrl:
        'https://www.amazingfacts.org/es/estudiar/biblioteca-de-libros-gratuitos/recuerda-a-la-mujer-de-lot/',
    },
    chineseEdition: {
      rights: 'official-external',
      sourceName: 'SDA Bible',
      sourceUrl: 'https://read.sdabible.org/library/work/m-813',
      coverUrl: 'https://read.sdabible.org/api/library/assets/975/thumb',
    },
    traditionalChinese: {
      title: '回想羅得的妻子',
      author: '喬·克魯斯',
      description: '以羅得的妻子為鑑，提醒信徒不要在不知不覺中偏離真理。',
    },
    simplifiedChinese: {
      title: '回想罗得的妻子',
      author: '乔·克鲁斯',
      description: '以罗得的妻子为鉴，提醒信徒不要在不知不觉中偏离真理。',
    },
  },
  {
    // An Inside Report article in English and Spanish; the Chinese edition
    // adds a closing section of its own.
    id: 'batchelor-bible-and-evolution',
    title: 'The Bible and Evolution',
    author: 'Doug Batchelor',
    collection: 'contemporary-adventist',
    description: 'Why the evidence points to a Creator rather than to evolution.',
    language: 'en',
    rights: 'official-external',
    sourceName: 'Amazing Facts',
    sourceUrl: 'https://www.amazingfacts.org/news-events/inside-report/the-bible-and-evolution/',
    spanish: {
      title: 'La Biblia y la evolución',
      author: 'Doug Batchelor',
      description: 'Por qué la evidencia apunta a un Creador y no a la evolución.',
      rights: 'official-external',
      sourceName: 'Amazing Facts',
      sourceUrl:
        'https://www.amazingfacts.org/es/noticias-y-eventos/informe-interno/la-biblia-y-la-evolucion/',
    },
    chineseEdition: {
      rights: 'official-external',
      sourceName: 'SDA Bible',
      sourceUrl: 'https://read.sdabible.org/library/work/m-815',
      coverUrl: 'https://read.sdabible.org/api/library/assets/979/thumb',
    },
    traditionalChinese: {
      title: '聖經與進化論',
      author: '道格·巴契勒',
      description: '為何證據指向創造主，而非進化論。',
    },
    simplifiedChinese: {
      title: '圣经与进化论',
      author: '道格·巴契勒',
      description: '为何证据指向创造主，而非进化论。',
    },
  },
  {
    id: 'batchelor-to-see-the-king',
    title: 'To See the King',
    author: 'Doug Batchelor',
    collection: 'contemporary-adventist',
    description: "Isaiah's vision in Isaiah 6, and what it shows about conversion, cleansing, and God's call.",
    language: 'zh',
    onlyForChineseReaders: true,
    rights: 'official-external',
    sourceName: 'SDA Bible',
    sourceUrl: 'https://read.sdabible.org/library/work/m-1445',
    coverUrl: 'https://read.sdabible.org/api/library/assets/723/thumb',
    traditionalChinese: {
      title: '得見我的王',
      author: '道格·巴契勒',
      description: '從《以賽亞書》第六章以賽亞所見的異象，看悔改、潔淨與蒙召。',
    },
    simplifiedChinese: {
      title: '得见我的王',
      author: '道格·巴契勒',
      description: '从《以赛亚书》第六章以赛亚所见的异象，看悔改、洁净与蒙召。',
    },
  },
  {
    // An Inside Report article. Amazing Facts' page credits only "Amazing
    // Facts", but it's in Doug Batchelor's own voice, and the Chinese
    // edition's cover credits him. Amazing Facts spells its English title
    // "Phariseee".
    id: 'batchelor-pharisee-or-tax-collector',
    title: 'Am I a Pharisee … or a Publican?',
    author: 'Doug Batchelor',
    collection: 'contemporary-adventist',
    description:
      "Jesus's parable of the Pharisee and the publican, and the two kinds of worshipper it describes.",
    language: 'en',
    rights: 'official-external',
    sourceName: 'Amazing Facts',
    sourceUrl: 'https://www.amazingfacts.org/news-events/inside-report/am-i-a-phariseee-or-a-publican/',
    spanish: {
      title: '¿Soy un fariseo… o un publicano?',
      author: 'Doug Batchelor',
      description:
        'La parábola de Jesús sobre el fariseo y el publicano, y los dos tipos de adoradores que describe.',
      rights: 'official-external',
      sourceName: 'Amazing Facts',
      sourceUrl:
        'https://www.amazingfacts.org/es/noticias-y-eventos/informe-interno/soy-un-fariseo-o-un-publicano/',
    },
    chineseEdition: {
      rights: 'official-external',
      sourceName: 'SDA Bible',
      sourceUrl: 'https://read.sdabible.org/library/work/m-863',
      coverUrl: 'https://read.sdabible.org/api/library/assets/1001/thumb',
    },
    traditionalChinese: {
      title: '我是法利賽人還是稅吏？',
      author: '道格·巴契勒',
      description: '耶穌關於法利賽人和稅吏的比喻，以及其中描繪的兩種敬拜者。',
    },
    simplifiedChinese: {
      title: '我是法利赛人还是税吏？',
      author: '道格·巴契勒',
      description: '耶稣关于法利赛人和税吏的比喻，以及其中描绘的两种敬拜者。',
    },
  },
  {
    // Amazing Facts credits it to Dennis Crews, as the Chinese edition's
    // cover does (丹尼·克魯斯).
    id: 'crews-baptized-paganism',
    title: 'Baptized Paganism',
    author: 'Dennis Crews',
    collection: 'contemporary-adventist',
    description: 'How pagan customs entered the Christian church.',
    language: 'en',
    rights: 'official-external',
    sourceName: 'Amazing Facts',
    sourceUrl: 'https://www.amazingfacts.org/study/free-books/baptized-paganism/',
    spanish: {
      title: 'Paganismo bautizado',
      author: 'Dennis Crews',
      description: 'Cómo las costumbres paganas entraron en la iglesia cristiana.',
      rights: 'official-external',
      sourceName: 'Amazing Facts',
      sourceUrl:
        'https://www.amazingfacts.org/es/estudiar/biblioteca-de-libros-gratuitos/paganismo-bautizado/',
    },
    chineseEdition: {
      rights: 'official-external',
      sourceName: 'SDA Bible',
      sourceUrl: 'https://read.sdabible.org/library/work/m-811',
      coverUrl: 'https://read.sdabible.org/api/library/assets/971/thumb',
    },
    traditionalChinese: {
      title: '受了洗的異教',
      author: '丹尼·克魯斯',
      description: '異教的習俗如何進入了基督教會。',
    },
    simplifiedChinese: {
      title: '受了洗的异教',
      author: '丹尼·克鲁斯',
      description: '异教的习俗如何进入了基督教会。',
    },
  },
  {
    id: 'rasi-gibson-understanding-creation',
    title: 'Understanding Creation',
    author: 'Humberto Rasi and James Gibson',
    collection: 'contemporary-adventist',
    description: 'Answers to questions on faith and science, for readers curious about creation.',
    language: 'zh',
    onlyForChineseReaders: true,
    rights: 'official-external',
    sourceName: 'SDA Bible',
    sourceUrl: 'https://read.sdabible.org/library/work/m-560',
    coverUrl: 'https://read.sdabible.org/api/library/assets/1101/thumb',
    traditionalChinese: {
      title: '認識創造',
      author: '詹姆斯·吉布森、亨貝托·拉西',
      description: '關於信仰與科學的問答，寫給對創造感到好奇的讀者。',
    },
    simplifiedChinese: {
      title: '认识创造',
      author: '詹姆斯·吉布森、亨贝托·拉西',
      description: '关于信仰与科学的问答，写给对创造感到好奇的读者。',
    },
  },
  {
    id: 'peckham-theodicy-of-love',
    title: 'Theodicy of Love',
    author: 'John C. Peckham',
    collection: 'contemporary-adventist',
    description: 'The cosmic conflict and the problem of evil.',
    language: 'zh',
    onlyForChineseReaders: true,
    rights: 'official-external',
    sourceName: 'SDA Bible',
    sourceUrl: 'https://read.sdabible.org/library/work/m-542',
    coverUrl: 'https://read.sdabible.org/api/library/assets/1131/thumb',
    traditionalChinese: {
      title: '愛的神義論',
      author: '約翰·佩卡姆',
      description: '宇宙之爭與罪惡的問題。',
    },
    simplifiedChinese: {
      title: '爱的神义论',
      author: '约翰·佩卡姆',
      description: '宇宙之争与罪恶的问题。',
    },
  },
  {
    // About Ellen G. White, not by her, so it sits on her shelf (see
    // ITEM_SHELVES) without counting as one of her books.
    id: 'lake-ellen-white-under-fire',
    title: 'Ellen White Under Fire',
    author: 'Jud Lake',
    collection: 'contemporary-adventist',
    description: 'The criticisms made of Ellen G. White, past and present, and the answers to them.',
    language: 'zh',
    onlyForChineseReaders: true,
    rights: 'official-external',
    sourceName: 'SDA Bible',
    sourceUrl: 'https://read.sdabible.org/library/work/m-1333',
    coverUrl: 'https://read.sdabible.org/api/library/assets/1265/thumb',
    traditionalChinese: {
      title: '浴火信使',
      author: '尤德·萊克',
      description: '探討古今對懷愛倫的批評，以及對這些批評的回應。',
    },
    simplifiedChinese: {
      title: '浴火信使',
      author: '尤德·莱克',
      description: '探讨古今对怀爱伦的批评，以及对这些批评的回应。',
    },
  },
  {
    id: 'schwarz-greenleaf-light-bearers',
    title: 'Light Bearers',
    author: 'Richard W. Schwarz and Floyd Greenleaf',
    collection: 'contemporary-adventist',
    description: 'A history of the Seventh-day Adventist Church.',
    language: 'zh',
    onlyForChineseReaders: true,
    rights: 'official-external',
    sourceName: 'SDA Bible',
    sourceUrl: 'https://read.sdabible.org/library/work/m-1402',
    coverUrl: 'https://read.sdabible.org/api/library/assets/1271/thumb',
    traditionalChinese: {
      title: '擎光者',
      author: '理查德·W·施瓦茲、弗洛伊德·格林利夫',
      description: '基督復臨安息日會的歷史。',
    },
    simplifiedChinese: {
      title: '擎光者',
      author: '理查德·W·施瓦兹、弗洛伊德·格林利夫',
      description: '基督复临安息日会的历史。',
    },
  },
  {
    id: 'morneau-trip-into-the-supernatural',
    title: 'A Trip into the Supernatural',
    author: 'Roger J. Morneau',
    collection: 'contemporary-adventist',
    description:
      'Roger Morneau tells how he was drawn into the world of evil spirits, and how he left it for Christ.',
    language: 'zh',
    onlyForChineseReaders: true,
    rights: 'official-external',
    sourceName: 'SDA Bible',
    sourceUrl: 'https://read.sdabible.org/library/work/m-1367',
    coverUrl: 'https://read.sdabible.org/api/library/assets/1243/thumb',
    traditionalChinese: {
      title: '靈界之旅',
      author: '羅傑·J·莫諾',
      description: '羅傑·莫諾親述他如何陷入邪靈的世界，又如何離開它歸向基督。',
    },
    simplifiedChinese: {
      title: '灵界之旅',
      author: '罗杰·J·莫诺',
      description: '罗杰·莫诺亲述他如何陷入邪灵的世界，又如何离开它归向基督。',
    },
  },
];

// Add other Chinese Adventist books only after verifying their rights and
// sources. The candidates are in docs/feature_designs/christian_library.md,
// under "Chinese Adventist research queue". (#176, which added the Chinese
// covers, is closed.)

export const LIBRARY_CATALOG = Object.freeze({
  publicDomainWorks,
  officialCollections,
  churchDocuments,
  sdaBibleBooks,
});

// The Sabbath Encouragement quotations and Ellen White Under Fire sit with
// Ellen G. White's books. Other works are shelved by collection.
const ITEM_SHELVES: Readonly<Record<string, LibraryShelf>> = {
  'sabbath-encouragement': 'egw',
  'lake-ellen-white-under-fire': 'egw',
};
const COLLECTION_SHELVES: Readonly<Record<LibraryCollection, LibraryShelf>> = {
  'adventist-pioneers': 'pioneers',
  'christian-classics': 'classics',
  youth: 'youth',
  children: 'children',
  'contemporary-adventist': 'contemporary',
};

/** The library shelf (the `[collection]` route) that lists this work. */
export const getLibraryItemShelf = (item: LibraryItem): LibraryShelf =>
  ITEM_SHELVES[item.id] ?? COLLECTION_SHELVES[item.collection];

export const getLibraryItemsForLanguage = (language: SupportedLanguage) => {
  const preferredLanguage = language === 'zh' || language === 'zh-cn' ? 'zh' : 'en';
  // Books in the reader's language come first: Chinese books and editions for
  // Chinese readers, and books with a Spanish edition for Spanish readers.
  const rank = (item: LibraryItem) =>
    (language === 'es'
      ? Boolean(item.spanish)
      : item.language === preferredLanguage || (preferredLanguage === 'zh' && Boolean(item.chineseEdition)))
      ? 0
      : 1;
  const forThisReader = (items: readonly LibraryItem[]) =>
    items
      .filter((item) => preferredLanguage === 'zh' || !item.onlyForChineseReaders)
      .sort((a, b) => rank(a) - rank(b));

  return {
    publicDomainWorks: forThisReader(publicDomainWorks),
    officialCollections: forThisReader(officialCollections),
    churchDocuments: forThisReader(churchDocuments),
    sdaBibleBooks: forThisReader(sdaBibleBooks),
  };
};

export const getLibraryItemDisplayText = (
  item: LibraryItem,
  language: SupportedLanguage,
): LibraryItemText =>
  (language === 'zh' && item.traditionalChinese) ||
  (language === 'zh-cn' && item.simplifiedChinese) ||
  (language === 'es' && item.spanish) || {
    author: item.author,
    description: item.description,
    title: item.title,
  };

/**
 * Where the book opens for this reader, and on what rights basis. A book in
 * the SDA Bible reader opens in the app's script.
 */
export const getLibraryItemSource = (
  item: LibraryItem,
  language: SupportedLanguage,
): LibraryItemSource => {
  const { rights, sourceName, sourceUrl } =
    (language === 'es' && item.spanish) ||
    ((language === 'zh' || language === 'zh-cn') && item.chineseEdition) ||
    item;
  return { rights, sourceName, sourceUrl: withSdaBibleInterface(sourceUrl, language) };
};
