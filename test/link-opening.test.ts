import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

import {
  openAdventistGiving,
  openAtlanticUnion,
  openBabiesSabbathSchool,
  openBeliefs,
  openBibleRequestEmail,
  openChildrenSabbathSchool,
  openChineseHymnalAndroid,
  openChineseHymnalIos,
  openCurrentSabbathSchool,
  openEmail,
  openGNYC,
  openInMaps,
  openPhone,
  openQuarterlySchedule,
  openSabbathSchool,
  openSabbathStream,
  openSermonArchive,
  openSpotifyPodcast,
  openSupportEmail,
  openURL,
  openYouTubeSearch,
  openYouTubeVideo,
  openZoomClass,
} from '@/constants/ExternalLinks';
import { openChinese505Hymn } from '@/features/hymnal/Chinese505Hymnal';
import { openChinese506Hymn } from '@/features/hymnal/Chinese506Hymnal';
import { openChinese707Hymn } from '@/features/hymnal/Chinese707Hymnal';
import { openHymnal } from '@/features/hymnal/EnglishHymnal';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

// Websites open in the in-app browser, which closes back to the app. Links
// that belong to another app open that app instead.
describe('where links open', () => {
  beforeEach(() => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  it.each([
    ['online giving', openAdventistGiving],
    ['Sabbath School', () => openSabbathSchool('en')],
    ["this week's lesson", () => openCurrentSabbathSchool('en')],
    ["children's lessons", openChildrenSabbathSchool],
    ['Babies resources', () => openBabiesSabbathSchool('en')],
    ['our beliefs', openBeliefs],
    ['the conference', openGNYC],
    ['the union', openAtlanticUnion],
    ['the English hymnal', () => openHymnal(1)],
    ['the 505 hymnal', () => openChinese505Hymn(1)],
    ['the 506 hymnal', () => openChinese506Hymn(1)],
    ['the 707 hymnal', () => openChinese707Hymn(1, 1)],
    ['a library book', () => openURL('https://www.gutenberg.org/ebooks/1')],
  ])('opens %s in the in-app browser', async (_name, open) => {
    await open();
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\//),
    );
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it.each([
    ['the livestream', openSabbathStream, 'https://www.youtube.com/'],
    ['the sermon archive', openSermonArchive, 'https://www.youtube.com/'],
    ['a hymn video', () => openYouTubeVideo('https://www.youtube.com/watch?v=Uoi3zhcXZrM'), 'https://www.youtube.com/'],
    ['a hymn search', () => openYouTubeSearch('SDA Hymnal 1985 1'), 'https://www.youtube.com/'],
    ['the podcast', openSpotifyPodcast, 'https://open.spotify.com/'],
    ['the Zoom class', openZoomClass, 'https://us06web.zoom.us/'],
    ['directions', () => openInMaps('760 41st Ave'), 'https://www.google.com/maps/'],
    ['the staff schedule', openQuarterlySchedule, 'https://docs.google.com/spreadsheets/'],
    ['the App Store', openChineseHymnalIos, 'https://apps.apple.com/'],
    ['Google Play', openChineseHymnalAndroid, 'https://play.google.com/'],
    ['a phone number', () => openPhone('(718) 205-8618'), 'tel:'],
    ['an email address', () => openEmail('technology@nyccsda.org'), 'mailto:'],
    ['a Bible request', () => openBibleRequestEmail('Please add'), 'mailto:'],
    ['a support email', () => openSupportEmail('Tell us', '1.4.0'), 'mailto:'],
  ])('hands %s to its app', async (_name, open, prefix) => {
    await open();
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringMatching(`^${prefix}`));
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });

  it('leaves every link to constants/ExternalLinks.ts', () => {
    // A screen that called Linking or the browser itself could open links
    // some other way again.
    const sources = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return sources(path);
        return /\.tsx?$/.test(entry.name) ? [path] : [];
      });
    const files = ['app', 'components', 'constants', 'features', 'hooks', 'services']
      .flatMap(sources)
      .filter((file) => file !== join('constants', 'ExternalLinks.ts'));
    expect(files.length).toBeGreaterThan(100);
    const direct = files.filter((file) =>
      /Linking\.openURL|openBrowserAsync|expo-web-browser|window\.open\(/.test(
        readFileSync(file, 'utf8'),
      ),
    );
    expect(direct).toEqual([]);
  });
});
