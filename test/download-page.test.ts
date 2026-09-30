import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import QRCode from 'qrcode';

// public/download.html is the permanent address for QR codes and download
// links (https://app.nyccsda.org/download). These tests run its redirect
// script with the devices issue #237 lists.
const page = readFileSync(resolve(process.cwd(), 'public/download.html'), 'utf8');
const redirectScript = page.match(/<script>([\s\S]*?)<\/script>/)![1];

const APP_STORE = 'https://apps.apple.com/app/id6816789535';
const GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=org.nyccsda.app';

const agents = {
  iPhone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iPad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  androidPhone:
    'Mozilla/5.0 (Linux; Android 16; Pixel 9a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  androidTablet:
    'Mozilla/5.0 (Linux; Android 15; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  chromebook:
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
};

const visit = ({
  userAgent,
  maxTouchPoints = 0,
  userAgentData,
  search = '',
}: {
  userAgent: string;
  maxTouchPoints?: number;
  userAgentData?: { platform: string };
  search?: string;
}) => {
  const replace = jest.fn();
  const window: Record<string, any> = { location: { search, replace } };
  runInNewContext(redirectScript, {
    window,
    navigator: { userAgent, maxTouchPoints, userAgentData },
  });
  return { destination: replace.mock.calls[0]?.[0], ...window.appDownload };
};

describe('the download page', () => {
  it('sends iPhones and iPads to the App Store', () => {
    expect(visit({ userAgent: agents.iPhone, maxTouchPoints: 5 }).destination).toBe(APP_STORE);
    expect(visit({ userAgent: agents.iPad, maxTouchPoints: 5 }).destination).toBe(APP_STORE);
  });

  it('recognizes an iPad asking for desktop sites, which reports itself as a Mac', () => {
    expect(visit({ userAgent: agents.mac, maxTouchPoints: 5 }).destination).toBe(APP_STORE);
  });

  it('sends Android phones and tablets to Google Play', () => {
    expect(visit({ userAgent: agents.androidPhone, maxTouchPoints: 5 }).destination).toBe(
      GOOGLE_PLAY,
    );
    expect(visit({ userAgent: agents.androidTablet, maxTouchPoints: 10 }).destination).toBe(
      GOOGLE_PLAY,
    );
  });

  it('uses client hints when the browser provides them', () => {
    const reduced = 'Mozilla/5.0 (Linux; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
    expect(
      visit({ userAgent: reduced, maxTouchPoints: 5, userAgentData: { platform: 'Android' } })
        .destination,
    ).toBe(GOOGLE_PLAY);
  });

  it('keeps computers and unknown devices on the page', () => {
    expect(visit({ userAgent: agents.mac }).destination).toBeUndefined();
    expect(visit({ userAgent: agents.windows }).destination).toBeUndefined();
    expect(visit({ userAgent: agents.chromebook }).destination).toBeUndefined();
    expect(visit({ userAgent: '' }).destination).toBeUndefined();
  });

  it("keeps Android in WeChat on the page, since WeChat's browser blocks Google Play", () => {
    const weChatAndroid = `${agents.androidPhone} MicroMessenger/8.0.50`;
    expect(visit({ userAgent: weChatAndroid, maxTouchPoints: 5 })).toMatchObject({
      destination: undefined,
      inWeChat: true,
      platform: 'android',
    });
    expect(
      visit({ userAgent: `${agents.iPhone} MicroMessenger/8.0.50`, maxTouchPoints: 5 }).destination,
    ).toBe(APP_STORE);
  });

  it('stays on the page with ?stay, for checking it on a phone', () => {
    expect(
      visit({ userAgent: agents.iPhone, maxTouchPoints: 5, search: '?stay' }).destination,
    ).toBeUndefined();
  });

  it('shows both store buttons, which match the redirect', () => {
    expect(page).toContain(`href="${APP_STORE}"`);
    expect(page).toContain(`href="${GOOGLE_PLAY}"`);
    expect(redirectScript).toContain(`'${APP_STORE}'`);
    expect(redirectScript).toContain(`'${GOOGLE_PLAY}'`);
  });

  it('has a QR code for the stable custom-domain address', async () => {
    const svg = await QRCode.toString('https://app.nyccsda.org/download', {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 4,
    });
    const path = (markup: string) => markup.match(/<path stroke="#000000" d="([^"]+)"/)?.[1];
    expect(path(page)).toBeDefined();
    expect(path(page)).toBe(path(svg));
  });
});
