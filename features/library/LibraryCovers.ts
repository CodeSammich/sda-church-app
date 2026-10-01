import type { ImageSourcePropType } from 'react-native';

// Covers bundled with the app, keyed by catalog id. Typographic covers are
// drawn by scripts/generate-library-covers.py.
export const BOOK_COVERS: Readonly<Record<string, ImageSourcePropType>> = {
  'bates-seventh-day-sabbath': require('../../assets/images/library/bates-seventh-day-sabbath.png'),
  'andrews-history-sabbath': require('../../assets/images/library/andrews-history-sabbath.png'),
  'bunyan-pilgrims-progress': require('../../assets/images/library/bunyan-pilgrims-progress.png'),
  'story-of-jesus': require('../../assets/images/library/story-of-jesus.png'),
  'smith-state-dead-destiny-wicked': require('../../assets/images/library/smith-state-dead-destiny-wicked.png'),
  'smith-daniel-revelation': require('../../assets/images/library/smith-daniel-revelation.png'),
  'murray-humility': require('../../assets/images/library/murray-humility.png'),
  'murray-abide-in-christ': require('../../assets/images/library/murray-abide-in-christ.png'),
  'foxe-book-of-martyrs': require('../../assets/images/library/foxe-book-of-martyrs.png'),
  'sibbes-bruised-reed': require('../../assets/images/library/sibbes-bruised-reed.png'),
  'sabbath-encouragement': require('../../assets/images/library/sabbath-encouragement.png'),
  'hurlbut-story-of-the-bible': require('../../assets/images/library/hurlbut-story-of-the-bible.png'),
  'hurlbut-life-of-christ': require('../../assets/images/library/hurlbut-life-of-christ.png'),
  'taylor-pastor-hsi': require('../../assets/images/library/taylor-pastor-hsi.png'),
  'taylor-hudson-taylor-early-years': require('../../assets/images/library/taylor-hudson-taylor-early-years.png'),
};

// Covers for Spanish editions, keyed by the book's catalog id, shown when the
// app is in Spanish. The same generator draws them in Spanish.
export const SPANISH_BOOK_COVERS: Readonly<Record<string, ImageSourcePropType>> = {
  'andrews-history-sabbath': require('../../assets/images/library/andrews-history-sabbath-es.png'),
  'bunyan-pilgrims-progress': require('../../assets/images/library/bunyan-pilgrims-progress-es.png'),
  'story-of-jesus': require('../../assets/images/library/story-of-jesus-es.png'),
};

// Covers for Chinese editions, keyed by the book's catalog id, shown to
// Chinese readers when the book has a `chineseEdition`. One cover serves both
// scripts.
export const CHINESE_BOOK_COVERS: Readonly<Record<string, ImageSourcePropType>> = {
  'bunyan-pilgrims-progress': require('../../assets/images/library/bunyan-pilgrims-progress-zh.png'),
};

// Bundled covers for Ellen G. White's books, shown when the official covers
// from EGW Writings (getEgwCoverUrlsForLanguage) can't load.
export const EGW_COVERS: Readonly<Record<string, ImageSourcePropType>> = {
  'patriarchs-and-prophets': require('../../assets/images/library/egw/patriarchs-and-prophets.jpg'),
  'prophets-and-kings': require('../../assets/images/library/egw/prophets-and-kings.jpg'),
  'desire-of-ages': require('../../assets/images/library/egw/desire-of-ages.jpg'),
  'acts-of-the-apostles': require('../../assets/images/library/egw/acts-of-the-apostles.jpg'),
  'great-controversy': require('../../assets/images/library/egw/great-controversy.jpg'),
  'steps-to-christ': require('../../assets/images/library/egw/steps-to-christ.jpg'),
  'christs-object-lessons': require('../../assets/images/library/egw/christs-object-lessons.jpg'),
  'ministry-of-healing': require('../../assets/images/library/egw/ministry-of-healing.jpg'),
  education: require('../../assets/images/library/egw/education.jpg'),
  'child-guidance': require('../../assets/images/library/egw/child-guidance.png'),
  'messages-to-young-people': require('../../assets/images/library/egw/messages-to-young-people.png'),
};
