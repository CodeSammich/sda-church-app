/**
 * Chinese Hymnal, 506 Edition
 *
 * This module stores factual metadata and external landing-page IDs only. The
 * sheet music remains on m.zgaxr.com and is always opened in the user's browser.
 * Regenerate the mapping with scripts/scrape-chinese-506-hymnal.mjs.
 *
 * Recordings come from a YouTube playlist of the 506 hymnal that is still being
 * uploaded. Regenerate their mapping with scripts/map-chinese-506-youtube.mjs.
 */

import hymnalData from './Chinese506Hymnal.json';
import youtubeData from './Chinese506YouTube.json';
import { openURL } from '@/constants/ExternalLinks';

export const CHINESE_506_DIRECTORY_URL =
  'https://m.zgaxr.com/index.php?m=content&c=index&a=lists&catid=90';

export interface Chinese506Hymn {
  number: number;
  title: string;
  pageId: number;
}

interface Chinese506HymnMetadata {
  title: string;
  pageId: number;
}

const CHINESE_506_HYMNAL = hymnalData as Record<string, Chinese506HymnMetadata>;

export const getSortedChinese506Hymns = (): Chinese506Hymn[] =>
  Object.entries(CHINESE_506_HYMNAL)
    .map(([number, hymn]) => ({
      number: Number.parseInt(number, 10),
      ...hymn,
    }))
    .sort((a, b) => a.number - b.number);

export const getChinese506HymnUrl = (hymnNumber?: number) => {
  if (hymnNumber === undefined) return CHINESE_506_DIRECTORY_URL;

  const hymn = CHINESE_506_HYMNAL[hymnNumber.toString()];
  if (!hymn) return CHINESE_506_DIRECTORY_URL;

  return `https://m.zgaxr.com/index.php?m=content&c=index&a=show&catid=90&id=${hymn.pageId}`;
};

export const openChinese506Hymn = (hymnNumber?: number) =>
  openURL(
    getChinese506HymnUrl(hymnNumber),
    'Error',
    'Could not open the Chinese hymnal link.',
  );

const CHINESE_506_YOUTUBE_VIDEOS = youtubeData.videos as Record<string, string>;

/** The hymn's recording in the 506 playlist, if it has been uploaded yet. */
export const getChinese506YouTubeUrl = (hymnNumber: number) => {
  const videoId = CHINESE_506_YOUTUBE_VIDEOS[hymnNumber.toString()];
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined;
};
