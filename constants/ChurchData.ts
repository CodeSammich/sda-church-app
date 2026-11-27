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

/**
 * When each location meets, in CHURCH_LOCATIONS' order, for New Member &
 * Visitor's Address & Service Times (#793): the day and hours only. They don't
 * name the gathering: a Saturday holds Sabbath School and the worship service,
 * and some afternoons more, such as the seminary (#808). Brooklyn's span
 * Sabbath Worship's schedule (app/(tabs)/home/worship.tsx), and Flushing's the
 * Thursday program on Fellowships. Written out by hand, not with Intl, which
 * Hermes writes in English for Chinese (constants/DateFormat.ts). The no-break
 * spaces keep "10:00 AM" and "a. m." whole on one line.
 */
export const CHURCH_SERVICE_TIMES: Record<SupportedDataLang, string[]> = {
  en: [
    'Saturdays, 10:00 AM – 1:00 PM',
    'Saturdays, 10:00 AM – 1:00 PM',
    'Thursdays, 6:30 – 9:00 PM',
  ],
  zh: ['每週六 上午10:00–下午1:00', '每週六 上午10:00–下午1:00', '每週四 晚上6:30–9:00'],
  'zh-cn': ['每周六 上午10:00–下午1:00', '每周六 上午10:00–下午1:00', '每周四 晚上6:30–9:00'],
  es: [
    'Sábados, 10:00 a. m. – 1:00 p. m.',
    'Sábados, 10:00 a. m. – 1:00 p. m.',
    'Jueves, 6:30 – 9:00 p. m.',
  ],
};

/** When each location meets, in the app's language, English if it has none. */
export const getServiceTimes = (lang: string): string[] =>
  CHURCH_SERVICE_TIMES[lang as SupportedDataLang] || CHURCH_SERVICE_TIMES.en;
