#!/usr/bin/env node

// Maps 505 hymn numbers to piano accompaniment videos in a YouTube playlist,
// so a 505 hymn's Piano only button can open its accompaniment for a church
// without a pianist.
//
// The videos are titled with the number, the Chinese title, and the English
// one, like "01 在主寶座前Before Jehovah's Awful Throne" or "251)非我乃主Not I
// but Christ". A video is mapped only when its number and Chinese title match
// the hymn:
// - the title, converted to Simplified Chinese, equals the hymnal's title, or
//   is the start of it, since many video titles are cut short, apart from
//   punctuation, spaces, and the reverential forms 祢, 祂, and 阿; or
// - the number is in REVIEWED_TITLES and the video's title is exactly the one a
//   person compared against the hymn. A changed title needs a new review.
//
// Usage, as for every playlist mapping (scripts/youtube-hymn-playlist.mjs):
//   YOUTUBE_API_KEY=... node scripts/map-chinese-505-piano-youtube.mjs
//   node scripts/map-chinese-505-piano-youtube.mjs --input playlist.json [--output file.json]

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { normalizeChineseTitle, runPlaylistMapping } from './youtube-hymn-playlist.mjs';

const MAPPING = resolve('features/hymnal/Chinese505PianoYouTube.json');
const HYMNAL = resolve('features/hymnal/Chinese505Hymnal.json');

// Same hymn and number, different wording: a typo in the hymnal's title (from
// zgaxr) or the video's, a variant character, or words in another order. Most
// were also checked against the English title of the 1985 hymn that the
// cross-reference table pairs with the 505 number.
//
// Left out on purpose: 194, 207, 370, 493, and 494, where the video is another
// hymn than the hymnal's title. At 207 and 370 the cross-reference table agrees
// with the video, so the hymnal's titles there may be the ones that are wrong.
const REVIEWED_TITLES = {
  7: '主慈愛如河',
  10: '聖徙祟拜',
  11: '讚美三一真',
  16: '快樂歌',
  27: '讚主聖名',
  35: '遵命工作',
  47: '創造乃我王',
  63: '美哉小城',
  71: '巍然乘驢',
  78: '請往客西馬',
  79: '願釘十架',
  86: '神聖純愛',
  88: '我有一好友',
  109: '公義審判之主',
  113: '信徒須宣告',
  114: '儆醒預備',
  127: '務要忠心',
  142: '主施鴻恩',
  146: '上帝聖言萬古存',
  160: '祇要靠祂',
  183: '卸罪與主',
  198: '美哉鍚安',
  203: '世上城邑',
  211: '榮歸天父',
  220: '幸褔的保證',
  235: '聖明洞鑒',
  239: '先求真光',
  242: '耶穌曾應許',
  260: '披主義袍',
  268: '領我到髑髏',
  274: '親愛救主',
  291: '拋碇於靈磐',
  300: '行在主光中',
  306: '至寶聖名',
  317: '流淚作工',
  325: '因愛作工',
  338: '務要提防',
  344: '洪福之望',
  348: '將看我君王',
  362: '我願見主耶穌',
  381: '上主是我牧者',
  453: '謹守十誡',
  455: '你會預備？',
  492: '讚美天上真神',
};

await runPlaylistMapping({
  mappingPath: MAPPING,
  hymnal: JSON.parse(await readFile(HYMNAL, 'utf8')),
  // The Chinese title runs from the number to the English one.
  parseTitle: (title) => {
    const match = title.trim().match(/^(\d{1,3})\s*\)?\s*([^A-Za-z]+)/);
    return match && { number: Number(match[1]), videoTitle: match[2].trim() };
  },
  matches: (number, videoTitle, hymnTitle) => {
    const video = normalizeChineseTitle(videoTitle);
    const hymn = normalizeChineseTitle(hymnTitle);
    return (
      video === hymn ||
      (video.length >= 4 && hymn.startsWith(video)) ||
      REVIEWED_TITLES[number] === videoTitle
    );
  },
});
