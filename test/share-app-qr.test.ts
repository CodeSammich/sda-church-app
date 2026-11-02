import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { APP_DOWNLOAD_URL } from '@/constants/ExternalLinks';

const QR_IMAGE = resolve('assets/images/app-download-qr.jpg');

describe("the You tab's Share the App QR code (#555)", () => {
  it('points where the printed bulletin\'s app QR code does', () => {
    const bulletinCodes = JSON.parse(readFileSync(resolve('scripts/bulletin-qr-codes.json'), 'utf8'));
    expect(bulletinCodes['mobile_app_qr_code_368x368.jpg']).toBe(APP_DOWNLOAD_URL);
  });

  it('is the code scripts/generate-qr.mjs makes for that address', () => {
    // If the address changes, regenerate the image:
    // node scripts/generate-qr.mjs --url <address> --output assets/images/app-download-qr.jpg
    const folder = mkdtempSync(join(tmpdir(), 'share-app-qr-'));
    try {
      const fresh = join(folder, 'qr.jpg');
      execFileSync(process.execPath, [
        resolve('scripts/generate-qr.mjs'),
        '--url',
        APP_DOWNLOAD_URL,
        '--output',
        fresh,
      ]);
      expect(readFileSync(QR_IMAGE).equals(readFileSync(fresh))).toBe(true);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
