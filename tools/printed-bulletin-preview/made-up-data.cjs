// Made-up bulletin weeks for the printed bulletin preview. Every name here is
// invented (Bible names on common surnames); never copy one from a real
// roster, sheet or bulletin. The data is in the shape the renderers get after
// preparePrintedBulletinForPrint_: each person as "Chinese\nEnglish".
'use strict';

const DATE = '2026-11-14';
const NEXT_DATE = '2026-11-21';

function person(chinese, english) {
  return chinese + '\n' + english;
}

// Fields the printed renderers read from a location's week, with
// short, ordinary values.
function regularLocation() {
  return {
    ssChair: person('溫保羅', 'Paul Wen'),
    ssOpeningPrayer: person('何路得', 'Ruth Ho'),
    sabbathSchoolHymns: ['SDAH 100', 'SDAH 206'],
    closingPrayer: person('馬大衛', 'David Ma'),
    chairPastoralPrayer: person('張約翰', 'John Zhang'),
    hymnOfPraise: { english: 'SDAH 100', chinese: '' },
    bibleVerses: 'Isaiah 53:5',
    offeringPrayer: person('李撒拉', 'Sarah Li'),
    specialMusicTitle: '我心堅定於你\nMy Heart Is Steadfast',
    specialMusic: person('孫雅各', 'James Sun'),
    sermonTitle: { english: 'The Promise of Grace and Hope', chinese: '恩典的應許與盼望' },
    sermon: '林恩典牧師\nPastor Grace Lin',
    hymnOfResponse: { english: 'SDAH 336', chinese: '' },
    pianist: person('周馬可', 'Mark Zhou'),
    englishTeacher: person('吳提摩太', 'Timothy Wu'),
    chineseTeacher: person('鄭以斯帖', 'Esther Zheng'),
    translation: person('黃以利亞', 'Elijah Huang'),
    specialMusic2: '',
    flowerOffering: person('許約拿', 'Jonah Xu'),
    chair: person('溫保羅', 'Paul Wen'),
    technician: person('錢彼得', 'Peter Qian'),
    encouragement: person('何路得', 'Ruth Ho'),
    sabbathMessage: person('何路得', 'Ruth Ho'),
    sabbathMessageTitle: '安息日的祝福\nThe Blessing of the Sabbath',
    sabbathSchool: person('馬大衛', 'David Ma'),
    sunsetTime: '4:28 PM',
    announcements: ANNOUNCEMENTS.slice(0, 2),
  };
}

// The longest week seen in practice, or a little longer: a long sermon title,
// two singers, a reading of several verses, and four announcements.
const LONG_WEEK = {
  bibleVerses: 'Isaiah 53:4-6, 10',
  specialMusicTitle: '我心堅定於你，我要歌唱讚美\nMy Heart Is Steadfast, I Will Sing and Make Music',
  specialMusic: person('孫雅各、高路加', 'James Sun & Luke Gao'),
  sermonTitle: {
    english: 'Watchmen on the Walls: Hope and Courage for the Last Days in the Light of Daniel and Revelation',
    chinese: '城牆上的守望者——從但以理書與啟示錄看末世的盼望與勇氣',
  },
};

const ANNOUNCEMENTS = [
  {
    chinese: '請用捐款信封。請將英文姓名或漢語拼音清楚寫在捐款信封上，並寫明捐款數目。支票抬頭請寫：New York Chinese SDA Church。謝謝合作。',
    english: 'Please use an offering envelope. Write your English name or pinyin clearly on the envelope, with the amount. Make checks payable to New York Chinese SDA Church. Thank you.',
  },
  {
    chinese: '本教會將於十二月十九日舉行聖誕慶祝聚會，歡迎大家邀請親友一同參加。',
    english: 'Our church will hold a Christmas celebration on December 19. Everyone is welcome to invite family and friends.',
  },
  {
    chinese: '經過四個月的聖經學習，以下弟兄姊妹申請受洗加入教會，今天第二次宣讀並表決：王撒母耳，李以撒，張米利暗，陳約書亞。',
    english: 'After four months of Bible study, the following members have applied for baptism and membership. Their names are read a second time today for a vote: Samuel Wang, Isaac Li, Miriam Zhang, Joshua Chen.',
  },
  {
    chinese: '下週六午餐後有長者探訪小組聚會，請願意參加的弟兄姊妹在教會辦公室登記。',
    english: 'After lunch next Sabbath the senior visitation team will meet. Please sign up at the church office if you would like to join.',
  },
];

// Roster cells print without a title; the renderers find people by these.
function withRosterNames(location) {
  location.rosterNames = {};
  ['pianist', 'englishTeacher', 'chineseTeacher', 'chairPastoralPrayer', 'offeringPrayer', 'sermon', 'translation', 'specialMusic', 'flowerOffering'].forEach((key) => {
    location.rosterNames[key] = String(location[key]).replace(/牧師|Pastor /g, '');
  });
  return location;
}

function weekLocation(longWeek) {
  const location = regularLocation();
  if (longWeek) Object.assign(location, LONG_WEEK, { announcements: ANNOUNCEMENTS });
  return withRosterNames(location);
}

/** This Sabbath's bulletin and next Sabbath's, as the renderers get them. */
function bulletinWeek(longWeek) {
  const bulletin = {
    date: DATE,
    queens: weekLocation(longWeek),
    brooklyn: weekLocation(longWeek),
    tithePurpose: 'Adventist Community Services',
    sunsetTime: '4:28 PM',
    sabbathSchoolLesson: { english: 'Lesson 7: The Faith of Abraham', chinese: '第7課 亞伯拉罕的信心' },
    communionPastor: '林恩典牧師\nPastor Grace Lin',
  };
  const nextQueens = weekLocation(false);
  nextQueens.pianist = person('錢百合', 'Lily Qian');
  const next = {
    date: NEXT_DATE,
    queens: withRosterNames(nextQueens),
    brooklyn: weekLocation(false),
    tithePurpose: 'Local Church Budget',
    sunsetTime: '4:22 PM',
  };
  return { bulletin, next };
}

// Machine translation stand-ins. The English is filler about three times the
// Chinese length, as a translation runs; a Bible quotation's token is kept,
// as the real translator keeps it.
const TRANSLATIONS = {
  'Adventist Community Services': '基督復臨安息日會社區服務',
  'Local Church Budget': '本地教會預算',
};

function englishFiller(length) {
  const seed = 'The Sabbath is a gift of rest and a sign of the love of God for His people, who remember the Creator each week. ';
  let out = '';
  while (out.length < length) out += seed;
  return out.slice(0, Math.max(1, length)).trim() + '.';
}

function fakeTranslate(text, from, to) {
  const source = String(text);
  if (String(to).toLowerCase().startsWith('zh')) {
    return TRANSLATIONS[source.trim()] || '中文翻譯'.repeat(Math.max(1, Math.round(source.length / 8)));
  }
  return source
    .split(/(SABBATH_BSB_TOKEN_\d+)/)
    .map((part) => (/^SABBATH_BSB_TOKEN_\d+$/.test(part) || !part.trim() ? part : englishFiller(part.length * 3)))
    .join(' ');
}

// Pixel sizes of the Drive images. The script sets each one's width, at
// most a cap, and scales its height by the picture's own shape, so only the
// shape matters here. The logo (48×48) and the QR codes (368×368) are the
// documented sizes. The Last Supper prints 3.33 × 2.63 in (240 × 189 pt) in
// the Word copy, measured in LibreOffice on 2026-11-27: 320 × 252 px at
// Communion's 320 px cap, so 800 × 630 has its shape. The church sketch is
// about 1.88 : 1, 460 × 245 px at Regular's 460 px cap: ESTIMATED FROM A
// SCREENSHOT of a real Queens cover; to confirm by measuring a Word copy.
const IMAGE_SIZES = {
  logo: [48, 48],
  qr: [368, 368],
  churchSketch: [1880, 1000],
  lastSupper: [800, 630],
};

const VARIANTS = [
  { name: 'queens-regular', location: 'queens', format: 'regular', longWeek: false },
  { name: 'queens-communion', location: 'queens', format: 'communion', longWeek: false },
  { name: 'brooklyn-regular', location: 'brooklyn', format: 'regular', longWeek: false },
  { name: 'queens-regular-long-week', location: 'queens', format: 'regular', longWeek: true },
  { name: 'queens-communion-long-week', location: 'queens', format: 'communion', longWeek: true },
  { name: 'brooklyn-regular-long-week', location: 'brooklyn', format: 'regular', longWeek: true },
];

module.exports = { VARIANTS, IMAGE_SIZES, ANNOUNCEMENTS, bulletinWeek, fakeTranslate };
