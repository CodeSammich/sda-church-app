import {
  formatHymnalScriptureReference,
  getSortedHymns,
} from '@/constants/EnglishHymnal';
import { SupportedLanguage } from '@/constants/LanguageContext';
import * as BibleService from '@/services/BibleService';
import type { MaterialCommunityIconName } from '@/components/AppIcon';

export interface SearchableItem {
  title: string;
  keywords: string[];
  icon: MaterialCommunityIconName;
  route: string;
  subtitle?: string;
  isBibleBook?: boolean;
  isHymn?: boolean;
}

/**
 * Punctuation characters used as separators between chapter and verse.
 * Supports standard ASCII colon and full-width variants (e.g. Chinese/Spanish).
 */
export const BIBLE_COLONS = [':', '：'];
const BIBLE_COLON_CLASS = BIBLE_COLONS.join('');

/**
 * Regex to detect if user input looks like a Bible reference (Book Chapter:Verse).
 * Supports: "John", "John ", "John 3", "John 3:16", "1 John 2", etc.
 */
export const BIBLE_REF_REGEX = new RegExp(
  `^(?:[1-3]\\s*)?[a-zA-Z\\u00C0-\\u017F\\u4e00-\\u9fa5]+(?:\\s+[a-zA-Z\\u00C0-\\u017F\\u4e00-\\u9fa5]+)*\\s*\\d*\\s*(?:[${BIBLE_COLON_CLASS}]\\s*\\d*)?\\s*$`,
);

/**
 * Regex to parse coordinates (chapter and optional verse) from a potential Bible reference.
 */
const BIBLE_COORDINATES_REGEX = new RegExp(
  `^(.*?)\\s*(\\d+)\\s*(?:[${BIBLE_COLON_CLASS}]\\s*(\\d+))?\\s*$`,
);

/**
 * Resolves a book ID and coordinates from a raw search query.
 * Supports multi-lingual book names and common abbreviations.
 */
export const resolveBibleReference = (query: string, language: string) => {
  const q = query.toLowerCase().trim();
  if (!q) return null;

  // Try to match "Book Chapter:Verse" or "Book Chapter"
  const match = q.match(BIBLE_COORDINATES_REGEX);

  let bookPart: string;
  let chapter: number = 1;
  let verse: number | undefined;

  if (match) {
    bookPart = match[1].trim();
    chapter = parseInt(match[2], 10);
    verse = match[3] ? parseInt(match[3], 10) : undefined;
  } else {
    // If no numbers are present, treat the entire query as a potential book name
    bookPart = q;
  }

  if (!bookPart) return null;

  // Find the book ID by checking all localized names and abbreviations
  const bookEntry = Object.entries(BIBLE_BOOKS_DATA).find(([id, data]) => {
    const names = [
      id.toLowerCase(),
      data.en.toLowerCase(),
      data.zh.toLowerCase(),
      data['zh-cn'].toLowerCase(),
      data.es.toLowerCase(),
      ...data.short.map((s) => s.toLowerCase()),
    ];
    return names.includes(bookPart) || names.some((n) => n.startsWith(bookPart));
  });

  return bookEntry ? { bookId: bookEntry[0], chapter, verse } : null;
};

/**
 * Validates if a searchable item matches the current query, with special handling
 * for Bible books to allow coordinates (chapters/verses) to be typed.
 */
export const isSearchMatch = (
  item: SearchableItem,
  query: string,
  language: string,
): boolean => {
  const q = query.toLowerCase();
  const trimmedQ = q.trim();
  if (!trimmedQ) return false;

  // 1. Standard matching: check title and keywords for a direct hit
  if (item.title.toLowerCase().includes(trimmedQ)) return true;
  if (item.keywords.some((k) => k.toLowerCase().includes(trimmedQ))) return true;

  // 1b. Specific logic for Hymn numbers (e.g. searching "123" should match Hymn 123)
  if (item.isHymn && /^\d+$/.test(trimmedQ)) {
    const hymnNum = item.title.split('.')[0];
    if (hymnNum === trimmedQ) return true;
  }

  // 2. Bible-specific "Smart Parsing":
  // If the item is a Bible book and the query looks like a reference starting with this book.
  if (item.isBibleBook && BIBLE_REF_REGEX.test(trimmedQ)) {
    // If this is the main 'Holy Bible' card, we only show it if the reference
    // can actually be resolved to a specific book. This prevents random strings
    // like "fff" from triggering the Bible smart gateway.
    if (item.route === '/bible') {
      return !!resolveBibleReference(trimmedQ, language);
    }

    // For specific book cards, check if the query starts with one of the book's keywords
    // (e.g., "John" matches "John 3").
    return item.keywords.some((k) => {
      const lowerK = k.toLowerCase().trim();
      if (!lowerK || lowerK === 'bible') return false;

      if (q.startsWith(lowerK)) {
        const nextChar = q.charAt(lowerK.length);
        // Valid match if it's the exact keyword or followed by a boundary character (space, digit, or colon)
        return (
          !nextChar ||
          nextChar === ' ' ||
          BIBLE_COLONS.includes(nextChar) ||
          (nextChar >= '0' && nextChar <= '9')
        );
      }
      return false;
    });
  }

  return false;
};

/**
 * Generates a dynamic subtitle for Bible items to guide users to specific coordinates.
 */
export const getSearchSubtitle = (
  item: SearchableItem,
  query: string,
  language: string,
): string | undefined => {
  const labels = ALL_SEARCH_LABELS[language] || ALL_SEARCH_LABELS.en;

  if (item.isBibleBook && BIBLE_REF_REGEX.test(query)) {
    return labels.goStraightTo?.replace('{q}', query.trim());
  }

  if (item.isHymn) {
    return labels.goToHymn?.replace('{q}', item.title);
  }

  return item.subtitle;
};

/**
 * Factual mapping of the 66 Bible books for search indexing.
 * Includes standard 3-letter IDs used by the HelloAO API.
 */
const BIBLE_BOOKS_DATA: Record<
  string,
  { id: string; en: string; zh: string; 'zh-cn': string; es: string; short: string[] }
> = {
  GEN: {
    id: 'GEN',
    en: 'Genesis',
    zh: '創世記',
    'zh-cn': '创世记',
    es: 'Génesis',
    short: ['gen'],
  },
  EXO: {
    id: 'EXO',
    en: 'Exodus',
    zh: '出埃及記',
    'zh-cn': '出埃及记',
    es: 'Éxodo',
    short: ['exo'],
  },
  LEV: {
    id: 'LEV',
    en: 'Leviticus',
    zh: '利未記',
    'zh-cn': '利未记',
    es: 'Levítico',
    short: ['lev'],
  },
  NUM: {
    id: 'NUM',
    en: 'Numbers',
    zh: '民數記',
    'zh-cn': '民数记',
    es: 'Números',
    short: ['num'],
  },
  DEU: {
    id: 'DEU',
    en: 'Deuteronomy',
    zh: '申命記',
    'zh-cn': '申命记',
    es: 'Deuteronomio',
    short: ['deu', 'deut'],
  },
  JOS: {
    id: 'JOS',
    en: 'Joshua',
    zh: '約書亞記',
    'zh-cn': '约书亚记',
    es: 'Josué',
    short: ['jos'],
  },
  JDG: {
    id: 'JDG',
    en: 'Judges',
    zh: '士師記',
    'zh-cn': '士师记',
    es: 'Jueces',
    short: ['jdg'],
  },
  RUT: {
    id: 'RUT',
    en: 'Ruth',
    zh: '路得記',
    'zh-cn': '路得记',
    es: 'Rut',
    short: ['rut'],
  },
  '1SA': {
    id: '1SA',
    en: '1 Samuel',
    zh: '撒母耳記上',
    'zh-cn': '撒母耳记上',
    es: '1 Samuel',
    short: ['1sa'],
  },
  '2SA': {
    id: '2SA',
    en: '2 Samuel',
    zh: '撒母耳記下',
    'zh-cn': '撒母耳记下',
    es: '2 Samuel',
    short: ['2sa'],
  },
  '1KI': {
    id: '1KI',
    en: '1 Kings',
    zh: '列王紀上',
    'zh-cn': '列王纪上',
    es: '1 Reyes',
    short: ['1ki'],
  },
  '2KI': {
    id: '2KI',
    en: '2 Kings',
    zh: '列王紀下',
    'zh-cn': '列王纪下',
    es: '2 Reyes',
    short: ['2ki'],
  },
  '1CH': {
    id: '1CH',
    en: '1 Chronicles',
    zh: '歷代志上',
    'zh-cn': '历代志上',
    es: '1 Crónicas',
    short: ['1ch'],
  },
  '2CH': {
    id: '2CH',
    en: '2 Chronicles',
    zh: '歷代志下',
    'zh-cn': '历代志下',
    es: '2 Crónicas',
    short: ['2ch'],
  },
  EZR: {
    id: 'EZR',
    en: 'Ezra',
    zh: '以斯拉記',
    'zh-cn': '以斯拉记',
    es: 'Esdras',
    short: ['ezr'],
  },
  NEH: {
    id: 'NEH',
    en: 'Nehemiah',
    zh: '尼希米記',
    'zh-cn': '尼希米记',
    es: 'Nehemías',
    short: ['neh'],
  },
  EST: {
    id: 'EST',
    en: 'Esther',
    zh: '以斯帖記',
    'zh-cn': '以斯帖记',
    es: 'Ester',
    short: ['est'],
  },
  JOB: {
    id: 'JOB',
    en: 'Job',
    zh: '約伯記',
    'zh-cn': '约伯记',
    es: 'Job',
    short: ['job'],
  },
  PSA: {
    id: 'PSA',
    en: 'Psalms',
    zh: '詩篇',
    'zh-cn': '诗篇',
    es: 'Salmos',
    short: ['ps', 'psa'],
  },
  PRO: {
    id: 'PRO',
    en: 'Proverbs',
    zh: '箴言',
    'zh-cn': '箴言',
    es: 'Proverbios',
    short: ['pro'],
  },
  ECC: {
    id: 'ECC',
    en: 'Ecclesiastes',
    zh: '傳道書',
    'zh-cn': '传道书',
    es: 'Eclesiastés',
    short: ['ecc'],
  },
  SNG: {
    id: 'SNG',
    en: 'Song of Solomon',
    zh: '雅歌',
    'zh-cn': '雅歌',
    es: 'Cantar de los Cantares',
    short: ['sng', 'song'],
  },
  ISA: {
    id: 'ISA',
    en: 'Isaiah',
    zh: '以賽亞書',
    'zh-cn': '以赛亚书',
    es: 'Isaías',
    short: ['isa'],
  },
  JER: {
    id: 'JER',
    en: 'Jeremiah',
    zh: '耶利米書',
    'zh-cn': '耶利米书',
    es: 'Jeremías',
    short: ['jer'],
  },
  LAM: {
    id: 'LAM',
    en: 'Lamentations',
    zh: '耶利米哀歌',
    'zh-cn': '耶利米哀歌',
    es: 'Lamentaciones',
    short: ['lam'],
  },
  EZK: {
    id: 'EZK',
    en: 'Ezekiel',
    zh: '以西結書',
    'zh-cn': '以西结书',
    es: 'Ezequiel',
    short: ['ezk'],
  },
  DAN: {
    id: 'DAN',
    en: 'Daniel',
    zh: '但以理書',
    'zh-cn': '但以理书',
    es: 'Daniel',
    short: ['dan'],
  },
  HOS: {
    id: 'HOS',
    en: 'Hosea',
    zh: '何西阿書',
    'zh-cn': '何西阿书',
    es: 'Oseas',
    short: ['hos'],
  },
  JOL: {
    id: 'JOL',
    en: 'Joel',
    zh: '約珥書',
    'zh-cn': '约珥书',
    es: 'Joel',
    short: ['jol'],
  },
  AMO: {
    id: 'AMO',
    en: 'Amos',
    zh: '阿摩司書',
    'zh-cn': '阿摩司书',
    es: 'Amós',
    short: ['amo'],
  },
  OBA: {
    id: 'OBA',
    en: 'Obadiah',
    zh: '俄巴底亞書',
    'zh-cn': '俄巴底亚书',
    es: 'Abdías',
    short: ['oba'],
  },
  JON: {
    id: 'JON',
    en: 'Jonah',
    zh: '約拿書',
    'zh-cn': '约拿书',
    es: 'Jonás',
    short: ['jon'],
  },
  MIC: {
    id: 'MIC',
    en: 'Micah',
    zh: '彌迦書',
    'zh-cn': '弥迦书',
    es: 'Miqueas',
    short: ['mic'],
  },
  NAM: {
    id: 'NAM',
    en: 'Nahum',
    zh: '那鴻書',
    'zh-cn': '那鸿书',
    es: 'Nahum',
    short: ['nam'],
  },
  HAB: {
    id: 'HAB',
    en: 'Habakkuk',
    zh: '哈巴谷書',
    'zh-cn': '哈巴谷书',
    es: 'Habacuc',
    short: ['hab'],
  },
  ZEP: {
    id: 'ZEP',
    en: 'Zephaniah',
    zh: '西番雅書',
    'zh-cn': '西番雅书',
    es: 'Sofonías',
    short: ['zeph'],
  },
  HAG: {
    id: 'HAG',
    en: 'Haggai',
    zh: '哈該書',
    'zh-cn': '哈该书',
    es: 'Hageo',
    short: ['hag'],
  },
  ZEC: {
    id: 'ZEC',
    en: 'Zechariah',
    zh: '撒迦利亞書',
    'zh-cn': '撒迦利亚书',
    es: 'Zacarías',
    short: ['zech'],
  },
  MAL: {
    id: 'MAL',
    en: 'Malachi',
    zh: '瑪拉基書',
    'zh-cn': '玛拉基书',
    es: 'Malaquías',
    short: ['mal'],
  },
  MAT: {
    id: 'MAT',
    en: 'Matthew',
    zh: '馬太福音',
    'zh-cn': '马太福音',
    es: 'Mateo',
    short: ['mt', 'mat'],
  },
  MRK: {
    id: 'MRK',
    en: 'Mark',
    zh: '馬可福音',
    'zh-cn': '马可福音',
    es: 'Marcos',
    short: ['mk', 'mrk'],
  },
  LUK: {
    id: 'LUK',
    en: 'Luke',
    zh: '路加福音',
    'zh-cn': '路加福音',
    es: 'Lucas',
    short: ['lk', 'luk'],
  },
  JHN: {
    id: 'JHN',
    en: 'John',
    zh: '約翰福音',
    'zh-cn': '约翰福音',
    es: 'Juan',
    short: ['jn', 'jhn'],
  },
  ACT: {
    id: 'ACT',
    en: 'Acts',
    zh: '使徒行傳',
    'zh-cn': '使徒行传',
    es: 'Hechos',
    short: ['act'],
  },
  ROM: {
    id: 'ROM',
    en: 'Romans',
    zh: '羅馬書',
    'zh-cn': '罗马书',
    es: 'Romanos',
    short: ['rom'],
  },
  '1CO': {
    id: '1CO',
    en: '1 Corinthians',
    zh: '哥林多前書',
    'zh-cn': '哥林多前书',
    es: '1 Corintios',
    short: ['1co'],
  },
  '2CO': {
    id: '2CO',
    en: '2 Corinthians',
    zh: '哥林多後書',
    'zh-cn': '哥林多后书',
    es: '2 Corintios',
    short: ['2co'],
  },
  GAL: {
    id: 'GAL',
    en: 'Galatians',
    zh: '加拉太書',
    'zh-cn': '加拉太书',
    es: 'Gálatas',
    short: ['gal'],
  },
  EPH: {
    id: 'EPH',
    en: 'Ephesians',
    zh: '以弗所書',
    'zh-cn': '以弗所书',
    es: 'Efesios',
    short: ['eph'],
  },
  PHP: {
    id: 'PHP',
    en: 'Philippians',
    zh: '腓立比書',
    'zh-cn': '腓立比书',
    es: 'Filipenses',
    short: ['php', 'phil'],
  },
  COL: {
    id: 'COL',
    en: 'Colossians',
    zh: '歌羅西書',
    'zh-cn': '歌罗西书',
    es: 'Colosenses',
    short: ['col'],
  },
  '1TH': {
    id: '1TH',
    en: '1 Thessalonians',
    zh: '帖撒羅尼迦前書',
    'zh-cn': '帖撒罗尼迦前书',
    es: '1 Tesalonicenses',
    short: ['1th'],
  },
  '2TH': {
    id: '2TH',
    en: '2 Thessalonians',
    zh: '帖撒羅尼迦後書',
    'zh-cn': '帖撒罗尼迦后书',
    es: '2 Tesalonicenses',
    short: ['2th'],
  },
  '1TI': {
    id: '1TI',
    en: '1 Timothy',
    zh: '提摩太前書',
    'zh-cn': '提摩太前书',
    es: '1 Timoteo',
    short: ['1ti'],
  },
  '2TI': {
    id: '2TI',
    en: '2 Timothy',
    zh: '提摩太後書',
    'zh-cn': '提摩太后书',
    es: '2 Timoteo',
    short: ['2ti'],
  },
  TIT: {
    id: 'TIT',
    en: 'Titus',
    zh: '提多書',
    'zh-cn': '提多书',
    es: 'Tito',
    short: ['tit'],
  },
  PHM: {
    id: 'PHM',
    en: 'Philemon',
    zh: '腓利門書',
    'zh-cn': '腓利门书',
    es: 'Filemón',
    short: ['phm'],
  },
  HEB: {
    id: 'HEB',
    en: 'Hebrews',
    zh: '希伯來書',
    'zh-cn': '希伯来书',
    es: 'Hebreos',
    short: ['heb'],
  },
  JAS: {
    id: 'JAS',
    en: 'James',
    zh: '雅各書',
    'zh-cn': '雅各书',
    es: 'Santiago',
    short: ['jas'],
  },
  '1PE': {
    id: '1PE',
    en: '1 Peter',
    zh: '彼得前書',
    'zh-cn': '彼得前书',
    es: '1 Pedro',
    short: ['1pe'],
  },
  '2PE': {
    id: '2PE',
    en: '2 Peter',
    zh: '彼得後書',
    'zh-cn': '彼得后书',
    es: '2 Pedro',
    short: ['2pe'],
  },
  '1JN': {
    id: '1JN',
    en: '1 John',
    zh: '約翰一書',
    'zh-cn': '约翰一书',
    es: '1 Juan',
    short: ['1jn'],
  },
  '2JN': {
    id: '2JN',
    en: '2 John',
    zh: '約翰二書',
    'zh-cn': '约翰二书',
    es: '2 Juan',
    short: ['2jn'],
  },
  '3JN': {
    id: '3JN',
    en: '3 John',
    zh: '約翰三書',
    'zh-cn': '约翰三书',
    es: '3 Juan',
    short: ['3jn'],
  },
  JUD: {
    id: 'JUD',
    en: 'Jude',
    zh: '猶大書',
    'zh-cn': '犹大书',
    es: 'Judas',
    short: ['jud'],
  },
  REV: {
    id: 'REV',
    en: 'Revelation',
    zh: '啟示錄',
    'zh-cn': '启示录',
    es: 'Apocalipsis',
    short: ['rev'],
  },
};

export const ALL_SEARCH_LABELS: Record<string, any> = {
  en: {
    searchBiblePlaceholder: 'Search this chapter...',
    searchHymnalPlaceholder: 'Search hymnal...',
    goStraightTo: 'Go straight to {q}',
    goToHymn: 'Go directly to hymn',
    home: {
      title: 'Home',
      keywords: ['welcome', 'start', 'pulse', 'livestream', 'happening'],
    },
    community: {
      title: 'Community',
      keywords: [
        'events',
        'schedule',
        'sabbath',
        'groups',
        'calendar',
        'volunteer',
        'in-person',
        'hub',
        'service',
        'fellowship',
        'small groups',
        'gathering',
        'roles',
      ],
    },
    resources: {
      title: 'Explore',
      keywords: [
        'video',
        'preach',
        'message',
        'bible',
        'hymnal',
        'spiritual',
        'scripture',
        'worship',
        'sermons',
        'watch',
        'listen',
        'library',
        'pdf',
        'devotional',
        'youtube',
        'spotify',
        'podcast',
        'archive',
        'reader',
      ],
    },
    bible: {
      title: 'Holy Bible',
      keywords: ['scripture', 'word', 'verse', 'read', 'chapter', 'testament'],
    },
    hymnal: {
      title: 'English Hymnal',
      keywords: ['songs', 'lyrics', 'music', 'sing', 'worship', 'praise'],
    },
    chineseHymnal: {
      title: 'Chinese Hymnal',
      keywords: [
        '506',
        'songs',
        'lyrics',
        'music',
        'praise',
        'worship',
        'traditional',
        'simplified',
      ],
    },
    aboutSDA: {
      title: 'About Denomination',
      keywords: ['sda', 'adventist', 'beliefs', 'doctrine', '28'],
    },
    aboutHistory: {
      title: 'Our History',
      keywords: ['history', 'church', 'origins', 'milestones'],
    },
    connect: {
      title: 'Connect',
      keywords: [
        'contact',
        'email',
        'phone',
        'location',
        'call',
        'map',
        'directions',
        'address',
        'staff',
      ],
    },
    give: {
      title: 'Tithe & Offering',
      keywords: ['give', 'tithe', 'offering', 'donation', 'tithing'],
    },
    team: { title: 'Meet Our Team', keywords: ['staff', 'pastors', 'elders', 'team'] },
    bulletin: {
      title: 'Weekly Bulletin',
      keywords: ['program', 'announcements', 'news'],
    },
    events: {
      title: 'Upcoming Events',
      keywords: ['announcements', 'news', 'calendar', 'special', 'programs', 'events'],
    },
    baptism: { title: 'Joining the Church', keywords: ['baptism', 'membership', 'join'] },
    worship: { title: 'Sabbath Worship', keywords: ['service', 'program', 'saturday'] },
    fellowship: { title: 'Fellowship', keywords: ['groups', 'lunch', 'gathering'] },
    roster: {
      title: 'Service Roster',
      keywords: ['volunteer', 'assignments', 'schedule'],
    },
    prayer: { title: 'Prayer Wall', keywords: ['requests', 'intercession', 'community'] },
    language: {
      title: 'Language',
      keywords: ['chinese', 'spanish', 'english', 'translate', 'settings'],
    },
    darkMode: {
      title: 'Dark Mode',
      keywords: ['theme', 'appearance', 'night', 'settings', 'dark'],
    },
  },
  zh: {
    searchBiblePlaceholder: '搜尋本章...',
    searchHymnalPlaceholder: '搜尋詩歌...',
    goStraightTo: '直接前往 {q}',
    goToHymn: '直接前往讚美詩',
    home: {
      title: '首頁',
      keywords: ['歡迎', '開始', 'home', '脈搏', '直播'],
    },
    community: {
      title: '教會社群',
      keywords: [
        '活動',
        '時間表',
        '安息日',
        '小組',
        '義工',
        'calendar',
        'community',
        '中心',
        '服事',
        '團契',
        '聚會',
        '小組',
      ],
    },
    resources: {
      title: '探索',
      keywords: [
        '視頻',
        '證道',
        '信息',
        '聖經',
        '詩歌',
        'sermons',
        'resources',
        '圖書館',
        '靈修',
        '敬拜',
        '收看',
        '收聽',
        'youtube',
        'spotify',
        'podcast',
        '檔案',
      ],
    },
    bible: {
      title: '聖經',
      keywords: ['經文', '閱讀', '聖言', 'scripture', 'bible'],
    },
    hymnal: {
      title: '英文詩歌本',
      keywords: ['讚美詩', '歌詞', '音樂', '敬拜', 'hymnal', 'music'],
    },
    chineseHymnal: {
      title: '506 讚美詩',
      keywords: ['詩歌', '歌詞', '音樂', '506', '讚美詩', 'hymnal', 'chinese'],
    },
    aboutSDA: {
      title: '關於教派',
      keywords: ['復臨安息日會', '信仰', '教義', '28條', 'sda'],
    },
    aboutHistory: {
      title: '我們的歷史',
      keywords: ['歷史', '教會', '起源', '發展'],
    },
    connect: {
      title: '聯繫我們',
      keywords: [
        '聯絡',
        '電子郵件',
        '電話',
        '地點',
        '電郵',
        '地圖',
        '導航',
        '地址',
        '路線',
        'connect',
        'contact',
        'email',
        'call',
        'map',
        '同工',
      ],
    },
    give: {
      title: '奉獻',
      keywords: ['什一', '奉獻', '捐款', 'give', 'tithe', 'tithing'],
    },
    team: { title: '認識我們的團隊', keywords: ['同工', '牧師', '長老', 'team'] },
    bulletin: { title: '每週週報', keywords: ['程序', '報告', 'bulletin'] },
    events: {
      title: '近期活動',
      keywords: ['報告', '公告', '消息', '日曆', '特別項目', 'events'],
    },
    baptism: { title: '加入教會', keywords: ['浸禮', '會籍', 'baptism'] },
    worship: { title: '安息日崇拜', keywords: ['崇拜', '聚會', 'worship'] },
    fellowship: { title: '團契', keywords: ['小組', '午餐', 'fellowship'] },
    roster: { title: '服事安排', keywords: ['義工', '服事表', 'roster'] },
    prayer: { title: '教會禱告牆', keywords: ['代禱', '請求', 'prayer'] },
    language: {
      title: '語言設定',
      keywords: ['中文', '英文', '西班牙文', '翻譯', 'language', '設定'],
    },
    darkMode: {
      title: '深色模式',
      keywords: ['theme', 'dark mode', '主題', '外觀', 'settings', '深色'],
    },
  },
  'zh-cn': {
    searchBiblePlaceholder: '搜索本章...',
    searchHymnalPlaceholder: '搜索诗歌...',
    goStraightTo: '直接前往 {q}',
    goToHymn: '直接前往赞美诗',
    home: {
      title: '首页',
      keywords: ['欢迎', '开始', 'home', '脉搏', '直播'],
    },
    community: {
      title: '教会社区',
      keywords: [
        '活动',
        '时间表',
        '安息日',
        '日历',
        '小组',
        '义工',
        'calendar',
        'community',
        '中心',
        '服事',
        '团契',
        '聚会',
      ],
    },
    resources: {
      title: '探索',
      keywords: [
        '视频',
        '证道',
        '信息',
        '圣经',
        '诗歌',
        'sermons',
        'resources',
        '图书馆',
        '灵修',
        '敬拜',
        '收看',
        '收听',
        'youtube',
        'spotify',
        'podcast',
        '存档',
      ],
    },
    bible: {
      title: '圣经',
      keywords: ['经文', '阅读', '圣言', 'scripture', 'bible'],
    },
    hymnal: {
      title: '英文诗歌本',
      keywords: ['赞美诗', '歌词', '音乐', '敬拜', 'hymnal', 'music'],
    },
    chineseHymnal: {
      title: '506 赞美诗',
      keywords: ['诗歌', '歌词', '音乐', '506', '赞美诗', 'hymnal', 'chinese'],
    },
    aboutSDA: {
      title: '关于教派',
      keywords: ['复临安息日会', '信仰', '教义', '28条', 'sda'],
    },
    aboutHistory: {
      title: '我们的历史',
      keywords: ['历史', '教会', '起源', '发展'],
    },
    connect: {
      title: '联系我们',
      keywords: [
        '联络',
        '电子邮件',
        '电话',
        '电邮',
        '地点',
        '地图',
        '导航',
        '地址',
        '路线',
        'connect',
        'contact',
        'email',
        'phone',
        'call',
        'map',
        '同工',
      ],
    },
    give: {
      title: '奉献',
      keywords: ['什一', '奉献', '捐款', 'give', 'tithe'],
    },
    team: { title: '认识我们的团队', keywords: ['同工', '牧师', '长老', 'team'] },
    bulletin: { title: '每周周报', keywords: ['程序', '报告', 'bulletin'] },
    events: {
      title: '近期活动',
      keywords: ['报告', '公告', '消息', '日历', '特别项目', 'events'],
    },
    baptism: { title: '加入教会', keywords: ['浸礼', '会籍', 'baptism'] },
    worship: { title: '安息日崇拜', keywords: ['崇拜', '聚会', 'worship'] },
    fellowship: { title: '团契', keywords: ['小组', '午餐', 'fellowship'] },
    roster: { title: '服事安排', keywords: ['义工', '服事表', 'roster'] },
    prayer: { title: '教会祷告墙', keywords: ['代祷', '请求', 'prayer'] },
    language: {
      title: '语言设置',
      keywords: ['中文', '英文', '西班牙文', '翻译', 'language', '设置'],
    },
    darkMode: {
      title: '深色模式',
      keywords: ['theme', 'dark mode', '主题', '外观', 'settings', '深色'],
    },
  },
  es: {
    searchBiblePlaceholder: 'Buscar en este capítulo...',
    searchHymnalPlaceholder: 'Buscar himnos...',
    goStraightTo: 'Ir directamente a {q}',
    goToHymn: 'Ir directamente al himno',
    home: {
      title: 'Inicio',
      keywords: ['bienvenido', 'comenzar', 'home', 'pulso', 'en vivo'],
    },
    community: {
      title: 'Comunidad',
      keywords: [
        'eventos',
        'horario',
        'sábado',
        'grupos',
        'voluntario',
        'calendar',
        'community',
        'centro',
        'servicio',
        'compañerismo',
        'grupos',
        'reunión',
        'horario',
        'calendario',
      ],
    },
    resources: {
      title: 'Explorar',
      keywords: [
        'video',
        'predicación',
        'mensaje',
        'biblia',
        'escritura',
        'adoración',
        'sermones',
        'ver',
        'escuchar',
        'himnario',
        'sermons',
        'resources',
        'biblioteca',
        'devocional',
        'youtube',
        'spotify',
        'podcast',
        'archivo',
      ],
    },
    bible: {
      title: 'Santa Biblia',
      keywords: ['escritura', 'palabra', 'versículo', 'leer', 'testamento'],
    },
    hymnal: {
      title: 'Himnario en Inglés',
      keywords: ['cantos', 'letras', 'música', 'cantar', 'adoración'],
    },
    chineseHymnal: {
      title: 'Himnario Chino',
      keywords: ['cantos', 'letras', 'música', 'chino', '506'],
    },
    aboutSDA: {
      title: 'Sobre la Denominación',
      keywords: ['adventista', 'creencias', 'doctrina', '28', 'sda'],
    },
    aboutHistory: {
      title: 'Nuestra Historia',
      keywords: ['historia', 'iglesia', 'origen'],
    },
    connect: {
      title: 'Conéctate',
      keywords: [
        'contacto',
        'correo',
        'teléfono',
        'ubicación',
        'llamar',
        'mapa',
        'direcciones',
        'dirección',
        'connect',
        'contact',
        'email',
        'phone',
        'personal',
      ],
    },
    give: {
      title: 'Diezmos y Ofrendas',
      keywords: ['dar', 'diezmo', 'ofrenda', 'donación', 'give', 'tithe', 'diezmos'],
    },
    team: {
      title: 'Conoce a nuestro equipo',
      keywords: ['personal', 'pastores', 'team'],
    },
    bulletin: {
      title: 'Boletín Semanal',
      keywords: ['programa', 'anuncios', 'bulletin'],
    },
    events: {
      title: 'Próximos Eventos',
      keywords: ['anuncios', 'noticias', 'calendario', 'programas', 'events'],
    },
    baptism: {
      title: 'Unirse a la Iglesia',
      keywords: ['bautismo', 'membresía', 'join'],
    },
    worship: {
      title: 'Adoración Sabática',
      keywords: ['servicio', 'liturgia', 'worship'],
    },
    fellowship: { title: 'Compañerismo', keywords: ['grupos', 'fellowship'] },
    roster: { title: 'Registro de Servicio', keywords: ['voluntario', 'roster'] },
    prayer: { title: 'Muro de Oración', keywords: ['peticiones', 'prayer'] },
    language: {
      title: 'Idioma',
      keywords: ['chino', 'español', 'inglés', 'traducir', 'language', 'ajustes'],
    },
    darkMode: {
      title: 'Modo oscuro',
      keywords: ['theme', 'dark mode', 'apariencia', 'ajustes', 'oscuro'],
    },
  },
};

export const getSearchableItems = (language: string): SearchableItem[] => {
  const labels = ALL_SEARCH_LABELS[language] || ALL_SEARCH_LABELS.en;

  const baseItems: SearchableItem[] = [
    { ...labels.home, icon: 'home', route: '/' },
    {
      ...labels.community,
      icon: 'account-group',
      route: '/bible/bible1',
    },
    {
      ...labels.resources,
      icon: 'bookmark-multiple',
      route: '/resources',
    },
    {
      ...labels.bible,
      icon: 'book-cross',
      route: '/bible',
      isBibleBook: true,
    },
    {
      ...labels.hymnal,
      icon: 'music-note',
      route: '/resources/english-hymnal',
    },
    {
      ...labels.chineseHymnal,
      icon: 'music-note',
      route: '/resources/hymnal-selection',
    },
    { ...labels.give, icon: 'gift', route: '/home/give' },
    { ...labels.darkMode, icon: 'theme-light-dark', route: '/you' },
    { ...labels.language, icon: 'translate', route: '/you/language' },
    { ...labels.aboutSDA, icon: 'information', route: '/home/about-sda' },
    { ...labels.aboutHistory, icon: 'history', route: '/home/about-my-church' },
    { ...labels.team, icon: 'account-multiple', route: '/home/team' },
    { ...labels.bulletin, icon: 'file-document-outline', route: '/home/bulletin' },
    { ...labels.events, icon: 'calendar-star', route: '/home/events' },
    { ...labels.baptism, icon: 'water-outline', route: '/home/baptism' },
    { ...labels.worship, icon: 'church', route: '/home/worship' },
    { ...labels.fellowship, icon: 'account-group', route: '/home/fellowship' },
    { ...labels.roster, icon: 'clipboard-text-outline', route: '/home/bulletin' },
    { ...labels.prayer, icon: 'hands-pray', route: '/home/prayer' },
  ];

  // Dynamically add all Bible books to the search list
  const bibleBooks: SearchableItem[] = Object.entries(BIBLE_BOOKS_DATA).map(
    ([id, data]) => {
      const langKey = language as 'en' | 'zh' | 'zh-cn' | 'es';
      const localizedName = data[langKey] || data.en;
      const defaultTransId =
        BibleService.DEFAULT_TRANSLATION_MAP[language as SupportedLanguage] || 'BSB';

      return {
        title: localizedName,
        keywords: [localizedName, id, ...data.short],
        icon: 'book-cross',
        route: `/bible?bookId=${id}&translationId=${defaultTransId}`,
        isBibleBook: true,
      };
    },
  );

  // Dynamically add all English hymns to the search list
  // This allows the unified search bar to act as the primary filter for the hymnal.
  const englishHymns: SearchableItem[] = getSortedHymns('en').map((h) => ({
    title: `${h.number}. ${h.title}`,
    subtitle: formatHymnalScriptureReference(h.scriptureReference),
    keywords: [
      h.number.toString(),
      h.title,
      h.scriptureReference || '',
      labels.hymnal?.title || 'Hymnal',
    ],
    icon: 'music-note',
    route: `/resources/english-hymnal?hymnNum=${h.number}&backTo=/resources`,
    isHymn: true,
  }));

  return [...baseItems, ...bibleBooks, ...englishHymns];
};
