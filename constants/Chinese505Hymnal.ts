/**
 * Chinese Hymnal, 505 Edition
 *
 * This module stores factual metadata and external landing-page IDs only. The
 * sheet music remains on m.zgaxr.com and is always opened in the user's browser.
 * Regenerate the mapping with scripts/scrape-chinese-505-hymnal.mjs.
 */

import hymnalData from './Chinese505Hymnal.json';
import { openURL } from './ExternalLinks';

export const CHINESE_505_DIRECTORY_URL =
  'https://m.zgaxr.com/index.php?m=content&c=index&a=lists&catid=59';

export interface Chinese505Hymn {
  number: number;
  title: string;
  pageId: number;
}

interface Chinese505HymnMetadata {
  title: string;
  pageId: number;
}

const CHINESE_505_HYMNAL = hymnalData as Record<string, Chinese505HymnMetadata>;

export const getSortedChinese505Hymns = (): Chinese505Hymn[] =>
  Object.entries(CHINESE_505_HYMNAL)
    .map(([number, hymn]) => ({
      number: Number.parseInt(number, 10),
      ...hymn,
    }))
    .sort((a, b) => a.number - b.number);

export const getChinese505HymnUrl = (hymnNumber?: number) => {
  if (hymnNumber === undefined) return CHINESE_505_DIRECTORY_URL;

  const hymn = CHINESE_505_HYMNAL[hymnNumber.toString()];
  if (!hymn) return CHINESE_505_DIRECTORY_URL;

  return `https://m.zgaxr.com/index.php?m=content&c=index&a=show&catid=59&id=${hymn.pageId}`;
};

export const openChinese505Hymn = (hymnNumber?: number) =>
  openURL(
    getChinese505HymnUrl(hymnNumber),
    'Error',
    'Could not open the Chinese hymnal link.',
  );
