import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as WebBrowser from 'expo-web-browser';

import { PRIVACY_POLICY_URL, openPrivacyPolicy } from '@/constants/ExternalLinks';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

const repoFile = (path: string) => join(process.cwd(), path);

// The website keeps the only copy of the privacy policy (#403). Both store
// listings link to this exact address, so a moved page would break them.
describe('the privacy policy link', () => {
  it('opens the hosted page in the in-app browser', async () => {
    await openPrivacyPolicy();
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      'https://app.nyccsda.org/privacy-policy.html',
    );
  });

  it('points at the page the website serves', () => {
    expect(PRIVACY_POLICY_URL).toBe('https://app.nyccsda.org/privacy-policy.html');
    expect(readFileSync(repoFile('public/privacy-policy.html'), 'utf8')).toContain(
      '<h1>Privacy Policy</h1>',
    );
  });

  it('keeps no second copy of the policy in the app', () => {
    expect(existsSync(repoFile('app/(tabs)/you/privacy.tsx'))).toBe(false);
  });
});
