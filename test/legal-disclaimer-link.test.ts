import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as WebBrowser from 'expo-web-browser';

import { LEGAL_DISCLAIMER_URL, openLegalDisclaimer } from '@/constants/ExternalLinks';
import { OPEN_SOURCE_NOTICES } from '@/constants/OpenSourceNotices';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

const repoFile = (path: string) => join(process.cwd(), path);

// Like the privacy policy, the legal disclaimer is kept only on the website
// (#412), so a wording fix needs a website deploy, not a new app build.
describe('the legal disclaimer link', () => {
  it('opens the hosted page in the in-app browser', async () => {
    await openLegalDisclaimer();
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      'https://app.nyccsda.org/legal.html',
    );
  });

  it('points at the page the website serves', () => {
    expect(LEGAL_DISCLAIMER_URL).toBe('https://app.nyccsda.org/legal.html');
    expect(readFileSync(repoFile('public/legal.html'), 'utf8')).toContain(
      '<h1>Legal Disclaimer</h1>',
    );
  });

  it('keeps no second copy of the disclaimer in the app', () => {
    expect(existsSync(repoFile('app/(tabs)/you/legal.tsx'))).toBe(false);
  });

  // SunCalc's BSD license asks binary copies to reproduce its notice, so the
  // notices stay in the app, on their own screen.
  it('keeps the open-source notices in the app', () => {
    const screen = readFileSync(repoFile('app/(tabs)/you/licenses.tsx'), 'utf8');
    expect(screen).toContain('OPEN_SOURCE_NOTICES.map');
    expect(OPEN_SOURCE_NOTICES.length).toBeGreaterThan(0);
  });
});
