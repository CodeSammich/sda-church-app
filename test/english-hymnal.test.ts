import { getEnglishHymnUrl, SDA_HYMNAL_1985 } from '@/features/hymnal/EnglishHymnal';
import missingPages from '@/features/hymnal/EnglishHymnalMissingPages.json';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIRECTORY = 'https://hymnsforworship.org/sda-hymnal/the-seventh-day-adventist-hymnal-1985-edition/';

describe('English hymnal links', () => {
  it('opens a hymn page at its sheet-music section', () => {
    expect(getEnglishHymnUrl(1)).toBe(
      'https://hymnsforworship.org/sdah-001#hymn-score',
    );
    expect(getEnglishHymnUrl('214')).toBe(
      'https://hymnsforworship.org/sdah-214#hymn-score',
    );
  });

  it('keeps the hymnal directory as the fallback destination', () => {
    expect(getEnglishHymnUrl()).toBe(DIRECTORY);
  });

  // Hymns for Worship has no page for SDAH 262, Sweet, Sweet Spirit (#779).
  it('opens the directory, not a page not found, for a hymn the site has no page for', () => {
    expect(getEnglishHymnUrl(262)).toBe(DIRECTORY);
    expect(getEnglishHymnUrl('262')).toBe(DIRECTORY);
    expect(getEnglishHymnUrl(261)).toBe('https://hymnsforworship.org/sdah-261#hymn-score');
    expect(getEnglishHymnUrl(263)).toBe('https://hymnsforworship.org/sdah-263#hymn-score');
  });

  it('keeps the hymns with no page in one list, of real hymns, which the daily monitor skips too', () => {
    expect(missingPages.hymns).toContain(262);
    for (const number of missingPages.hymns) {
      expect(SDA_HYMNAL_1985.en[number]).toBeDefined();
      expect(getEnglishHymnUrl(number)).toBe(DIRECTORY);
    }
    const monitor = readFileSync(join(__dirname, 'integration', 'external-dependencies.mjs'), 'utf8');
    expect(monitor).toContain("readJson('features/hymnal/EnglishHymnalMissingPages.json')");
  });
});
