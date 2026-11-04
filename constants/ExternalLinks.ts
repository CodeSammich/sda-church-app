import * as WebBrowser from 'expo-web-browser';
import { showAppAlert, type LocalizedText } from '@/components/AppAlert';
import { Linking, Platform } from 'react-native';
import { SupportedLanguage } from './LanguageContext';
import {
  findChildrenLessonUrl,
  type ChildrenSabbathSchoolCurriculum,
} from '@/features/sabbath-school/ChildrenLessons';

/**
 * Church Identity & Branding Constants
 * Hardcoding these directly satisfies Tenet 5 (Simplicity) by removing
 * dependency on .env for static branding information.
 */
export const CHURCH_NAME = 'New York Chinese SDA Church';
export const CHURCH_PHONE = '(718) 205-8618';
export const CHURCH_EMAIL = 'pastor@nyccsda.org';

// Relative path to various church specific images in the public folder on GitHub Pages
export const CHURCH_BUILDING_IMAGE_URL =
  'https://assets.adventistconnect.org/newyork2/2026/07/13221703/church_building.jpg';
export const PASTOR_IMAGE_URL =
  'https://assets.adventistconnect.org/newyork2/2026/07/13221020/moses_fang-1536x1024.jpg';
export const BIBLE_WORKER_IMAGE_URL =
  'https://assets.adventistconnect.org/newyork2/2026/07/13221317/sarah_fang-1536x1024.jpg';
export const FLUSHING_FELLOWSHIP_IMAGE_URL =
  'https://assets.adventistconnect.org/newyork2/2026/07/01230029/flushing_fellowship_3.jpg';
export const ELMHURST_SABBATH_URLS = [
  'https://assets.adventistconnect.org/newyork2/2026/07/19124827/elmhurst_sabbath.png',
];

export const IOS_PWA_INSTALL_GUIDE_URL =
  'https://youtu.be/5IwrG8BTylw?si=7FW6G4DWiJmLkz89&t=15';

// Hardcoded to 760 41st Ave Elmhurst, NY 11373
export const CHURCH_LATITUDE = 40.74546;
export const CHURCH_LONGITUDE = -73.88914;

/**
 * Production bulletin API. The public PWA sends only a Sabbath date; Apps
 * Script joins the yearly schedule with Queens/Brooklyn worship responses and
 * returns privacy-filtered JSON.
 *
 * Architecture, deployment, privacy, and verification documentation:
 * https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/blob/main/docs/operations/bulletin-automation.md
 */
export const BULLETIN_API_BASE_URL =
  'https://script.google.com/macros/s/AKfycbzBDlptzh5JpDyAiucJBXO4pQXe2hy2X3DL_1t6NixK-2tV3md_WbyhdDAtCGvGCwzX/exec';

// The app's version tells the API which response shapes it understands, such
// as a bulletin whose schedule isn't set (#580).
export const getBulletinApiUrl = (date: string, appVersion?: string) =>
  `${BULLETIN_API_BASE_URL}?date=${encodeURIComponent(date)}` +
  (appVersion ? `&appVersion=${encodeURIComponent(appVersion)}` : '');

/**
 * Centralized hub for external destinations.
 * Consolidating these here satisfies Tenet 5 (Simplicity) by providing
 * a single source of truth for the app's external touchpoints.
 */

// What a link that won't open says, in the app's popup.
const LINK_ERROR_TITLE: LocalizedText = {
  en: 'Couldn’t open the link',
  zh: '無法開啟連結',
  'zh-cn': '无法打开链接',
  es: 'No se pudo abrir el enlace',
};
export const LINK_ERROR_MESSAGE: LocalizedText = {
  en: 'Check your connection, then try again.',
  zh: '請檢查網路連線，然後再試一次。',
  'zh-cn': '请检查网络连接，然后再试一次。',
  es: 'Revisa tu conexión y vuelve a intentarlo.',
};

/**
 * Opens a website in the in-app browser, which slides up over the app and
 * closes back to it: Safari View Controller on iOS, a Custom Tab on Android.
 * On web it opens a new tab. Every website link uses this, so they all open the
 * same way; a link that belongs to another app uses openInItsApp instead.
 */
export const openURL = async (
  url: string,
  errorTitle: LocalizedText = LINK_ERROR_TITLE,
  errorMessage: LocalizedText = LINK_ERROR_MESSAGE,
) => {
  try {
    if (Platform.OS === 'web') {
      await Linking.openURL(url);
    } else {
      await WebBrowser.openBrowserAsync(url);
    }
  } catch (error) {
    showAppAlert(errorTitle, errorMessage);
    console.error('In-app browser error:', error);
  }
};

/**
 * Hands a link to the app it belongs to: phone numbers to the phone, email
 * addresses to the mail app, and YouTube, Spotify, Zoom, Google Maps, App Store
 * and Google Play links to those apps, where people are signed in and can watch,
 * join, get directions, or install. A phone without that app opens the link in
 * its own browser.
 */
export const openInItsApp = async (
  url: string,
  errorTitle: LocalizedText = LINK_ERROR_TITLE,
  errorMessage: LocalizedText = LINK_ERROR_MESSAGE,
) => {
  try {
    await Linking.openURL(url);
  } catch (error) {
    showAppAlert(errorTitle, errorMessage);
    console.error('Linking error:', error);
  }
};

/**
 * The app's download page, which sends a phone to its app store (#237). The
 * printed bulletin's app QR code (scripts/bulletin-qr-codes.json) and the You
 * tab's **Share the App** code (assets/images/app-download-qr.jpg, #555) both
 * point here.
 */
export const APP_DOWNLOAD_URL = 'https://app.nyccsda.org/download';

/**
 * The privacy policy is kept only on the website, which both store listings
 * link to (#403), so a wording fix needs a website deploy, not a new app build.
 * Keep public/privacy-policy.html at this path.
 */
export const PRIVACY_POLICY_URL = 'https://app.nyccsda.org/privacy-policy.html';

export const openPrivacyPolicy = () =>
  openURL(PRIVACY_POLICY_URL);

/**
 * The legal disclaimer is kept only on the website too (#412), beside the
 * privacy policy. The open-source notices stay in the app, under You →
 * Open-Source Licenses. Keep public/legal.html at this path.
 */
export const LEGAL_DISCLAIMER_URL = 'https://app.nyccsda.org/legal.html';

export const openLegalDisclaimer = () =>
  openURL(LEGAL_DISCLAIMER_URL);

/**
 * Whether the Tithe & Offering page shows the church's Zelle section. Off until
 * the address can receive gifts (#384, #392); turning it on needs a new release.
 */
export const SHOW_ZELLE_GIVING = false;

export const openAdventistGiving = async () => {
  return openURL('https://adventistgiving.org/donate/AN48CO');
};

/**
 * The church as a donor-advised fund sponsor lists it, for recommending a
 * grant: its legal name and EIN, as the Tithe & Offering page gives them.
 */
export const CHURCH_LEGAL_NAME = 'New York Chinese Seventh-day Adventist Church';
export const CHURCH_EIN = '11-3004814';

export type DafSponsor = Readonly<{
  id: string;
  /** The sponsor's name as its website gives it. Not translated. */
  name: string;
  /** The name members may still know it by, which the popup gives as "Formerly …". */
  formerName?: string;
  /** The page its button opens, in the in-app browser. */
  url: string;
}>;

/**
 * Fidelity Charitable's own link to a grant to one charity, from the "Making
 * the Most of DAF Direct" section of its DAF Direct user guide
 * (dafdirect.org): it opens the Giving Account sign-in, then a grant
 * recommendation with the church, by EIN, already chosen.
 */
export const FIDELITY_CHARITABLE_GRANT_URL =
  'https://charitablegift.fidelity.com/cgfweb/CGFLogon.cgfdo' +
  `?Npo_Id=${CHURCH_EIN.replace('-', '')}&Device_Type=Widget&App_Id=MDNR&source=widget`;

/**
 * Donor-advised fund sponsors on the Tithe & Offering page (#646), each opening
 * its website, where the donor recommends the grant. The church prefers the
 * first, Fidelity Charitable (#230), which has its own button on the page and
 * opens a grant to the church. DAFgiving360 and Vanguard Charitable have no such
 * link, so they open their home pages; they're in the page's Other Sponsors
 * popup, for donors whose fund is there, who contact church staff first. The
 * app takes no payment.
 */
export const DAF_SPONSORS: readonly DafSponsor[] = [
  { id: 'fidelity', name: 'Fidelity Charitable', url: FIDELITY_CHARITABLE_GRANT_URL },
  // Schwab Charitable became DAFgiving360 in June 2024.
  { id: 'dafgiving360', name: 'DAFgiving360', formerName: 'Schwab Charitable', url: 'https://www.dafgiving360.org/' },
  { id: 'vanguard', name: 'Vanguard Charitable', url: 'https://www.vanguardcharitable.org/' },
];

export const [PREFERRED_DAF_SPONSOR, ...OTHER_DAF_SPONSORS] = DAF_SPONSORS;

export const openDafSponsor = (sponsor: DafSponsor) => openURL(sponsor.url);

export const openSpotifyPodcast = async () => {
  return openInItsApp('https://open.spotify.com/show/6Ig7RqU3A5vivl4x3FJFLV');
};

export const openZoomClass = async () => {
  return openInItsApp('https://us06web.zoom.us/j/2541879535?pwd=Rmhsa0pFK3hQVTRHMzVqQ2swZlBodz09');
};

export const openSermonArchive = async () => {
  return openInItsApp('https://www.youtube.com/playlist?list=PLX85oBoVF4TKC4p0hJ6EK6X_2zXOB53eW');
};

export const openSabbathStream = async () => {
  return openInItsApp('https://www.youtube.com/@newyorkchinesesdachurch1334/streams');
};

export const openYouTubeSearch = (query: string) => {
  return openInItsApp(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
};

export const openYouTubeVideo = (url: string) =>
  openInItsApp(url);

export const openIosPwaInstallGuide = () =>
  openInItsApp(IOS_PWA_INSTALL_GUIDE_URL);

// SABBATH SCHOOL DIGITAL ECOSYSTEM
// DENOMINATIONAL CORE FRAMEWORK & PUBLIC DATA BACKBONE
// URL: https://sabbath-school.adventech.io
// Status: Official / Direct Institutional Partner
// Context: Developed by Adventech via direct authorization from the General
//          Conference (Sabbath School and Personal Ministries Department).
// Content: Web parity for the official "Sabbath School & PM" mobile app,
//          hosting authorized curriculum for all age divisions.
// Architecture: Functions as the open-source data engine/API backend that
//               independent platforms consume to render alternative layouts.
//
// Adventech and the General Conference of Seventh-day Adventists have an official partnership
// https://sspmadventist.org/sspmapp
export const openSabbathSchool = (language: SupportedLanguage) => {
  let path = language || 'en';

  if (language === 'zh' || language === 'zh-cn') {
    // There is no traditional Chinese version of the Sabbath School site,
    // so we default to simplified Chinese which is more widely used online
    path = 'zh';
  }

  return openURL(`https://sabbath-school.adventech.io/${path}`);
};

const getSabbathSchoolLanguage = (language: SupportedLanguage) =>
  language === 'zh' || language === 'zh-cn' ? 'zh' : language || 'en';

export const getCurrentSabbathSchoolUrl = (
  language: SupportedLanguage,
  date = new Date(),
) => {
  const candidates = [date.getFullYear() - 1, date.getFullYear(), date.getFullYear() + 1]
    .flatMap((year) =>
      [1, 2, 3, 4].map((quarter) => {
        const start = new Date(year, (quarter - 1) * 3, 1);
        start.setDate(start.getDate() - ((start.getDay() + 1) % 7));
        return { quarter, start, year };
      }),
    )
    .filter(({ start }) => start.getTime() <= date.getTime())
    .sort((a, b) => b.start.getTime() - a.start.getTime());
  const { quarter, start: quarterStart, year } = candidates[0];
  const lesson = Math.max(
    1,
    Math.min(14, Math.floor((date.getTime() - quarterStart.getTime()) / 604_800_000) + 1),
  );
  return `https://sabbath-school.adventech.io/${getSabbathSchoolLanguage(language)}/${year}-${String(quarter).padStart(2, '0')}/${String(lesson).padStart(2, '0')}`;
};

export const openCurrentSabbathSchool = (language: SupportedLanguage) =>
  openURL(getCurrentSabbathSchoolUrl(language));

export const openChildrenSabbathSchool = () =>
  openURL('https://aliveinjesus.info/');

/**
 * Opens this week's children's lesson in the browser. The web uses this; a
 * phone downloads the lesson with a progress popup instead and opens it in the
 * phone's own viewer (hooks/useChildrenLessonOpener.ts, #529).
 */
export const openCurrentChildrenSabbathSchool = (
  curriculum: ChildrenSabbathSchoolCurriculum,
  language: SupportedLanguage = 'en',
) => {
  // Reserve the web browsing context during the original tap. Waiting for the
  // API first can cause installed PWAs to treat the PDF as an in-app redirect.
  const externalWindow =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.open('about:blank', '_blank')
      : null;
  if (externalWindow) externalWindow.opener = null;

  findChildrenLessonUrl(curriculum, language)
    .then(async (url) => {
      if (Platform.OS === 'web') {
        if (!externalWindow) {
          throw new Error('The external browser window was blocked.');
        }
        externalWindow.location.replace(url);
      } else {
        await openURL(url);
      }
    })
    .catch((error) => {
      externalWindow?.close();
      showAppAlert(LINK_ERROR_TITLE, LINK_ERROR_MESSAGE);
      console.error('Children Sabbath School lesson error:', error);
    });
};

export const getBabiesSabbathSchoolUrl = (language: SupportedLanguage = 'en') => {
  if (language === 'zh' || language === 'zh-cn') {
    return 'https://babies.aliveinjesus.info/zh/resources';
  }
  if (language === 'es') {
    return 'https://babies.aliveinjesus.info/es/resources';
  }
  return 'https://babies.aliveinjesus.info/resources';
};

export const openBabiesSabbathSchool = (language: SupportedLanguage = 'en') =>
  openURL(getBabiesSabbathSchoolUrl(language));

/**
 * Adventist Mission's Mission Spotlight page (#508): this quarter's weekly
 * mission videos, the ones Sabbath School plays, each dated by its Sabbath.
 * Each story's own page is named after its title, so the app can't work out
 * this week's; the button names the Sabbath to look for instead
 * (getMissionSpotlightSabbath). Spanish has its own edition. Chinese readers
 * get CHTV's Mandarin video of the week on YouTube instead, and this page only
 * when their phone has none (features/sabbath-school/ChineseMissionSpotlight.ts).
 */
export const getMissionSpotlightUrl = (language: SupportedLanguage = 'en') =>
  language === 'es'
    ? 'https://adventistmission.org/mission-plus/mission-promotion/for-sabbath-school/mission-spotlight/mission-spotlight-spanish'
    : 'https://adventistmission.org/mission-plus/mission-promotion/for-sabbath-school/mission-spotlight';

/**
 * The Sabbath whose mission video is this week's: today on a Sabbath, otherwise
 * the next one. Adventist Mission dates each weekly story by the Sabbath it's
 * shown, and puts the whole quarter's up ahead of time.
 */
export const getMissionSpotlightSabbath = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + 6 - date.getDay());

export const openMissionSpotlight = (language: SupportedLanguage = 'en') =>
  openURL(getMissionSpotlightUrl(language));

export const openChineseHymnalIos = () =>
  openInItsApp(
    'https://apps.apple.com/us/app/506%E8%AE%9A%E7%BE%8E%E8%A9%A9-traditional-chinese/id6498894032',
  );

export const openChineseHymnalAndroid = () =>
  openInItsApp('https://play.google.com/store/apps/details?id=org.chumadventist.hymnal506.next');

/**
 * Opens a given address in the Google Maps app, or the browser without it.
 * @param address The formatted address string to search for.
 */
export const openInMaps = async (address: string) => {
  if (!address) return;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    address,
  )}`;
  return openInItsApp(url);
};

export const openBeliefs = () =>
  openURL('https://adventist.org/beliefs#official-beliefs');
export const openGNYC = () => openURL('https://gnyc.org/');
export const openAtlanticUnion = () => openURL('https://atlantic-union.org/');

export const openPhone = (phone: string) => {
  const cleanedPhone = phone.replace(/[^\d+]/g, '');
  return openInItsApp(`tel:${cleanedPhone}`);
};

export const openEmail = (email: string) =>
  openInItsApp(`mailto:${email}`);

/** The app's public support address, also on the support page and store listings. */
export const TECHNOLOGY_EMAIL = 'technology@nyccsda.org';

/**
 * Starts the subject of every email the app drafts, so they're easy to spot
 * and filter, and to label automatically later.
 */
export const APP_EMAIL_SUBJECT_PREFIX = '[NYCCSDA App]';

/**
 * An email asking for another Bible translation or language (#344). The subject
 * is always English, so requests are easy to find and count for #241; the
 * prompt in the body is in the reader's language.
 */
export const getBibleRequestEmailUrl = (prompt: string) =>
  `mailto:${TECHNOLOGY_EMAIL}?subject=${encodeURIComponent(`${APP_EMAIL_SUBJECT_PREFIX} Bible translation request`)}` +
  `&body=${encodeURIComponent(prompt)}`;

export const openBibleRequestEmail = (prompt: string) =>
  openInItsApp(getBibleRequestEmailUrl(prompt));

/** The app version and phone system, the first things support asks. */
export const getAppAndSystemLine = (
  version: string,
  os: string = Platform.OS,
  osVersion: string | number | undefined = Platform.Version,
) => {
  const system =
    os === 'ios' ? `iOS ${osVersion}` : os === 'android' ? `Android, API level ${osVersion}` : 'web app';
  return `App ${version} · ${system}`;
};

/**
 * An email asking for help with the app or suggesting a feature, from You →
 * About & Support (#541). As with the Bible request, the subject is always
 * English and the prompt is in the reader's language. The prompt asks, more
 * simply, what the bug report and feature request issue templates ask:
 * problem or idea, what happened or what they'd like, and what they were
 * doing. The last line gives the app version and phone system. The draft
 * opens in the phone's email app, so the person sees all of it, and nothing
 * is sent unless they send it.
 */
export const getSupportEmailUrl = (prompt: string, appAndSystem: string) =>
  `mailto:${TECHNOLOGY_EMAIL}?subject=${encodeURIComponent(`${APP_EMAIL_SUBJECT_PREFIX} Help or feature request`)}` +
  `&body=${encodeURIComponent(`${prompt}\n\n\n\n${appAndSystem}`)}`;

export const openSupportEmail = (prompt: string, version: string) =>
  openInItsApp(getSupportEmailUrl(prompt, getAppAndSystemLine(version)));
