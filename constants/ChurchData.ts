export const CHURCH_LOCATIONS = [
  {
    address: '76-06 41st Ave, Elmhurst, Queens, NY 11373',
    searchQuery: 'New York Chinese Seventh-day Adventist Church',
    icon: 'church' as const,
  },
  {
    address: '53-18 4th Ave (3F), Brooklyn, NY 11220',
    searchQuery: '53-18 4th Ave, Brooklyn, NY 11220',
    icon: 'church' as const,
  },
  {
    address: '143-11 Willets Point Blvd, Whitestone, Queens, NY 11357',
    searchQuery:
      'New York Theological Education Center - Chinese Online School of Theology',
    icon: 'church' as const,
  },
];

export const CHURCH_LOCATION_LABELS = {
  en: [
    'Elmhurst Church',
    'Brooklyn Church (Bay Ridge)',
    'Flushing Fellowship (Mandarin)',
  ],
  zh: ['艾姆赫斯特教會', '布魯克林教會 (Bay Ridge)', '法拉盛團契 (晚餐與靈修) (國語)'],
  'zh-cn': [
    '艾姆赫斯特教会',
    '布鲁克林教会 (Bay Ridge)',
    '法拉盛团契 (晚餐与灵修) (普通话)',
  ],
  es: [
    'Iglesia de Elmhurst',
    'Iglesia de Brooklyn (Bay Ridge)',
    'Compañerismo en Flushing (Cena y Devoción) (Mandarín)',
  ],
};

export type SupportedDataLang = keyof typeof CHURCH_LOCATION_LABELS;

/**
 * Helper to get the correct location names based on language
 */
export const getLocationNames = (lang: string): string[] => {
  return CHURCH_LOCATION_LABELS[lang as SupportedDataLang] || CHURCH_LOCATION_LABELS.en;
};

export interface ChurchServiceTime {
  /** What gathers there, such as Sabbath worship. */
  service: string;
  /** Its day and hours, as the app writes times. */
  time: string;
}

/**
 * Each location's regular gathering, in CHURCH_LOCATIONS' order, for New
 * Member & Visitor's Address & Service Times (#793). Fellowships shows
 * Elmhurst's from here. Brooklyn's spans Sabbath Worship's schedule
 * (app/(tabs)/home/worship.tsx), and Flushing's the Thursday program on
 * Fellowships. The Saturday service is 安息日崇拜 (Sabbath worship), never
 * the Lord's day's (主日) worship, which many Chinese Christians read as
 * Sunday's.
 */
export const CHURCH_SERVICE_TIMES: Record<SupportedDataLang, ChurchServiceTime[]> = {
  en: [
    { service: 'Sabbath Worship', time: 'Saturday, 10:00 AM - 1:00 PM' },
    { service: 'Sabbath Worship', time: 'Saturday, 10:00 AM - 1:00 PM' },
    { service: 'Weekly Gathering', time: 'Thursday, 6:30 - 9:00 PM' },
  ],
  zh: [
    { service: '安息日崇拜', time: '星期六上午 10:00 - 下午 1:00' },
    { service: '安息日崇拜', time: '星期六上午 10:00 - 下午 1:00' },
    { service: '每週聚會', time: '星期四晚上 6:30 - 9:00' },
  ],
  'zh-cn': [
    { service: '安息日崇拜', time: '星期六上午 10:00 - 下午 1:00' },
    { service: '安息日崇拜', time: '星期六上午 10:00 - 下午 1:00' },
    { service: '每周聚会', time: '星期四晚上 6:30 - 9:00' },
  ],
  es: [
    { service: 'Adoración Sabática', time: 'Sábado, 10:00 AM - 1:00 PM' },
    { service: 'Adoración Sabática', time: 'Sábado, 10:00 AM - 1:00 PM' },
    { service: 'Reunión Semanal', time: 'Jueves, 6:30 - 9:00 PM' },
  ],
};

/** Each location's regular gathering in the app's language, English if it has none. */
export const getServiceTimes = (lang: string): ChurchServiceTime[] =>
  CHURCH_SERVICE_TIMES[lang as SupportedDataLang] || CHURCH_SERVICE_TIMES.en;
