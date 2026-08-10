/**
 * Chinese Hymns of Praise, 707 collection
 *
 * The three published editions have distinct zgaxr directories, page IDs, and
 * occasional title differences, so their mappings remain separate here.
 * Regenerate them with scripts/scrape-chinese-707-hymnals.mjs.
 */

import version1Data from './Chinese707HymnalV1.json';
import version2Data from './Chinese707HymnalV2.json';
import version3Data from './Chinese707HymnalV3.json';
import { openURL } from '@/constants/ExternalLinks';

export type Chinese707Version = 1 | 2 | 3;

export interface Chinese707Hymn {
  number: number | string;
  title: string;
  pageId: number;
}

interface Chinese707HymnMetadata {
  title: string;
  pageId: number;
}

const VERSION_CONFIG = {
  1: {
    catId: 15,
    data: version1Data,
  },
  2: {
    catId: 20,
    data: version2Data,
  },
  3: {
    catId: 234,
    data: version3Data,
  },
} as const;

export const getChinese707DirectoryUrl = (version: Chinese707Version) =>
  `https://m.zgaxr.com/index.php?m=content&c=index&a=lists&catid=${VERSION_CONFIG[version].catId}`;

export const getSortedChinese707Hymns = (
  version: Chinese707Version,
): Chinese707Hymn[] => {
  const data = VERSION_CONFIG[version].data as Record<
    string,
    Chinese707HymnMetadata
  >;

  return Object.entries(data)
    .map(([number, hymn]) => ({
      number: number.endsWith('B') ? number : Number.parseInt(number, 10),
      ...hymn,
    }))
    .sort((a, b) => {
      const numberDifference = Number.parseInt(a.number.toString(), 10) -
        Number.parseInt(b.number.toString(), 10);
      return numberDifference || a.number.toString().localeCompare(b.number.toString());
    });
};

export const getChinese707HymnUrl = (
  version: Chinese707Version,
  hymnNumber?: number | string,
) => {
  const config = VERSION_CONFIG[version];
  const directoryUrl = getChinese707DirectoryUrl(version);
  if (hymnNumber === undefined) return directoryUrl;

  const data = config.data as Record<string, Chinese707HymnMetadata>;
  const hymn = data[hymnNumber.toString()];
  if (!hymn) return directoryUrl;

  return `https://m.zgaxr.com/index.php?m=content&c=index&a=show&catid=${config.catId}&id=${hymn.pageId}`;
};

export const openChinese707Hymn = (
  version: Chinese707Version,
  hymnNumber?: number | string,
) =>
  openURL(
    getChinese707HymnUrl(version, hymnNumber),
    'Error',
    'Could not open the Chinese hymnal link.',
  );
