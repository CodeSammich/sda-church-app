import AsyncStorage from '@react-native-async-storage/async-storage';
import OpenCC from 'opencc-js/t2cn';
import { Platform } from 'react-native';

import { formatAppDate } from '@/constants/DateFormat';
import type { SupportedLanguage } from '@/constants/LanguageContext';

/**
 * The mission video in Mandarin, for Chinese readers (#508). CHTV 希望電視台, the
 * Chinese Union Mission's Hope Channel, posts Adventist Mission's weekly
 * Mission Spotlight to YouTube as 聖工剪影 on the Tuesday before its Sabbath,
 * with the Sabbath in the title: 【聖工剪影】2026 第四季 10月31日 三扇窗的視野.
 *
 * The app finds it in the channel's public feed, which needs no API key. The
 * feed lists only the 15 newest uploads, about four days of CHTV's, and YouTube
 * sometimes answers it with an error. So the phone remembers the newest video
 * it has found, and until this week's turns up, the card offers that one,
 * named by its Sabbath, for up to four weeks. A phone that has none opens the
 * English Mission Spotlight page instead. The External Dependency Monitor reads
 * the same feed and reads titles the same way
 * (test/integration/external-dependencies.mjs).
 */
export const CHTV_CHANNEL_ID = 'UC5ucz7CvoYYVULo8Qgl-JdA';
export const CHTV_FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHTV_CHANNEL_ID}`;

/** How many days before this Sabbath a remembered video's Sabbath may be: four weeks. */
export const REMEMBERED_VIDEO_MAX_AGE_DAYS = 28;

// Give up after this long; the card offers what the phone already has.
const LOOKUP_TIMEOUT_MS = 12_000;

// A few bytes, kept with the app's settings (docs/feature_designs/on_device_storage.md).
export const CHINESE_MISSION_SPOTLIGHT_KEY = 'chinese-mission-spotlight';

export type ChineseMissionSpotlight = Readonly<{
  /** The Sabbath it's for, YYYY-MM-DD. */
  sabbath: string;
  /** The YouTube video's ID. */
  id: string;
  /** The story's name from the video's title, in Traditional Chinese; '' when the title has none. */
  story: string;
}>;

const pad = (value: number) => String(value).padStart(2, '0');

const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const fromIsoDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const daysBetween = (earlier: string, later: string) =>
  Math.round((fromIsoDate(later).getTime() - fromIsoDate(earlier).getTime()) / 86_400_000);

const decodeXml = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, code: string) => {
    const lower = code.toLowerCase();
    if (lower.startsWith('#x')) return String.fromCodePoint(parseInt(lower.slice(2), 16));
    if (lower.startsWith('#')) return String.fromCodePoint(Number(lower.slice(1)));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[lower] ?? entity;
  });

/**
 * The Sabbath (YYYY-MM-DD) and story a CHTV video title names, when it's the
 * Mandarin 聖工剪影, such as 2026-10-31 and 三扇窗的視野; null for any other
 * video, including a Cantonese one, or a date that isn't a Saturday.
 */
export const readChineseMissionSpotlightTitle = (
  title: string,
): { sabbath: string; story: string } | null => {
  if (!title.includes('聖工剪影') || /粵語|粤语/.test(title)) return null;
  const match = /(20\d\d)\D[^]*?(?:^|\D)(\d{1,2})月(\d{1,2})日\s*(.*)$/.exec(title);
  if (!match) return null;
  const sabbath = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (sabbath.getDay() !== 6 || sabbath.getDate() !== Number(match[3])) return null;
  return { sabbath: toIsoDate(sabbath), story: match[4].trim() };
};

/** Every 聖工剪影 in CHTV's feed (YouTube's Atom XML), newest Sabbath first. */
export const readChtvFeed = (xml: string): ChineseMissionSpotlight[] => {
  const videos: ChineseMissionSpotlight[] = [];
  for (const [, entry] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const id = /<yt:videoId>([\w-]{11})<\/yt:videoId>/.exec(entry)?.[1];
    const title = /<title>([^<]*)<\/title>/.exec(entry)?.[1];
    const read = title === undefined ? null : readChineseMissionSpotlightTitle(decodeXml(title));
    if (id && read) videos.push({ id, ...read });
  }
  return videos.sort((a, b) => b.sabbath.localeCompare(a.sabbath));
};

const isVideo = (value: unknown): value is ChineseMissionSpotlight => {
  const video = value as ChineseMissionSpotlight | null;
  return (
    typeof video?.id === 'string' &&
    /^[\w-]{11}$/.test(video.id) &&
    typeof video.sabbath === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(video.sabbath) &&
    typeof video.story === 'string'
  );
};

const readRemembered = async () => {
  try {
    const value: unknown = JSON.parse((await AsyncStorage.getItem(CHINESE_MISSION_SPOTLIGHT_KEY)) ?? 'null');
    return isVideo(value) ? value : null;
  } catch {
    return null;
  }
};

/** The video to offer for a Sabbath (YYYY-MM-DD): one dated that Sabbath or up to four weeks before it. */
const usableFor = (video: ChineseMissionSpotlight | null, sabbath: string) => {
  if (!video) return null;
  const age = daysBetween(video.sabbath, sabbath);
  return age >= 0 && age <= REMEMBERED_VIDEO_MAX_AGE_DAYS ? video : null;
};

/**
 * The video the phone already has for a Sabbath, without asking YouTube: the
 * remembered one, if it isn't too old. Never rejects.
 */
export const readRememberedChineseMissionSpotlight = async (sabbath: Date) =>
  usableFor(await readRemembered(), toIsoDate(sabbath));

const lookUp = async (sabbath: string, fetchText: typeof fetch) => {
  let remembered = await readRemembered();
  if (remembered?.sabbath === sabbath) return remembered;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetchText(CHTV_FEED_URL, { signal: controller.signal });
    if (response.ok) {
      const newest = readChtvFeed(await response.text()).find((video) => video.sabbath <= sabbath);
      if (newest && (!remembered || newest.sabbath > remembered.sabbath)) {
        remembered = newest;
        await AsyncStorage.setItem(CHINESE_MISSION_SPOTLIGHT_KEY, JSON.stringify(newest)).catch(() => undefined);
      }
    }
  } catch {
    // Offline, timed out, or YouTube answered with an error: offer what the phone has.
  } finally {
    clearTimeout(timer);
  }
  return usableFor(remembered, sabbath);
};

const lookups = new Map<string, Promise<ChineseMissionSpotlight | null>>();

/**
 * The video to offer for a Sabbath: that Sabbath's, once CHTV has posted it,
 * or else the newest the phone has found, up to four weeks old; null when it
 * has none. Never rejects. Once a Sabbath's own video is found it isn't looked
 * up again; until then, each call reads the feed. The web app never looks: a
 * browser can't read YouTube's feed from another site.
 */
export const findChineseMissionSpotlight = (
  sabbath: Date,
  fetchText: typeof fetch = fetch,
): Promise<ChineseMissionSpotlight | null> => {
  if (Platform.OS === 'web') return Promise.resolve(null);
  const key = toIsoDate(sabbath);
  let lookup = lookups.get(key);
  if (!lookup) {
    lookup = lookUp(key, fetchText).catch(() => null);
    lookups.set(key, lookup);
    void lookup.then((found) => {
      if (found?.sabbath !== key) lookups.delete(key);
    });
  }
  return lookup;
};

export const getChineseMissionSpotlightUrl = ({ id }: ChineseMissionSpotlight) =>
  `https://www.youtube.com/watch?v=${id}`;

const traditionalToSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });

/**
 * The card's title and description for a video offered on `sabbath`'s week.
 * This week's is 本週聖工剪影; an older one is named by its own Sabbath and says
 * this week's will replace it. Both note the video is in Mandarin, so Cantonese
 * speakers know. CHTV writes in Traditional Chinese; Simplified readers get the
 * story converted.
 */
export const describeChineseMissionSpotlight = (
  video: ChineseMissionSpotlight,
  sabbath: Date,
  language: SupportedLanguage,
) => {
  const simplified = language === 'zh-cn';
  const story = simplified ? traditionalToSimplified(video.story) : video.story;
  const mandarin = simplified ? '（普通话）' : '（普通話）';
  const series = simplified ? '圣工剪影' : '聖工剪影';
  const date = formatAppDate(fromIsoDate(video.sabbath), language);
  if (video.sabbath === toIsoDate(sabbath)) {
    return {
      title: simplified ? '本周圣工剪影' : '本週聖工剪影',
      description: story ? `${date}安息日：${story}${mandarin}` : `${date}安息日的${series}${mandarin}`,
    };
  }
  const later = simplified ? '本周的视频出来后会换上。' : '本週的影片出來後會換上。';
  return {
    title: `${date}${series}`,
    description: story ? `${story}${mandarin}。${later}` : `${simplified ? '普通话' : '普通話'}。${later}`,
  };
};
