import fs from 'node:fs';
import path from 'node:path';
import { OPEN_SOURCE_NOTICES } from '@/constants/OpenSourceNotices';

// Compare wording only; the upstream file's line wrapping and indentation vary.
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('open-source notices', () => {
  it.each(OPEN_SOURCE_NOTICES.map((notice) => [notice.name, notice]))(
    'reproduces the installed %s license exactly',
    (_name, notice) => {
      const installed = fs.readFileSync(
        path.join(__dirname, '..', notice.licenseFile),
        'utf8',
      );
      expect(normalize(notice.license)).toBe(normalize(installed));
    },
  );

  it('lists every package that requires a notice in LEGAL.md', () => {
    // LEGAL.md shows each notice as a block quote.
    const legal = fs
      .readFileSync(path.join(__dirname, '..', 'docs', 'LEGAL.md'), 'utf8')
      .replace(/^>\s?/gm, '');
    for (const notice of OPEN_SOURCE_NOTICES) {
      expect(normalize(legal)).toContain(normalize(notice.license));
    }
  });
});
