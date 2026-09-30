import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  getLibraryItemDisplayText,
  getLibraryItemShelf,
  getLibraryItemsForLanguage,
  LIBRARY_CATALOG,
} from '@/features/library/LibraryCatalog';
import {
  isLibraryShelf,
  LIBRARY_SHELF_TITLES,
  LIBRARY_SHELVES,
} from '@/features/library/LibraryShelves';

describe('library catalog', () => {
  it('ties public-domain works to explicit Gutenberg or Internet Archive records', () => {
    expect(LIBRARY_CATALOG.publicDomainWorks.length).toBeGreaterThan(0);

    for (const work of LIBRARY_CATALOG.publicDomainWorks) {
      expect(work.rights).toBe('public-domain-us');
      expect(work.publicationYear).toBeLessThan(1928);
      if (work.sourceName === 'Internet Archive') {
        // A scan's own edition must be public domain, not just the original work.
        expect(work.editionYear).toBeLessThan(1928);
        expect(work.sourceUrl).toMatch(/^https:\/\/archive\.org\/details\/[A-Za-z0-9._-]+$/);
      } else {
        expect(work.sourceName).toBe('Project Gutenberg');
        expect(work.sourceUrl).toMatch(/^https:\/\/(www\.)?gutenberg\.org\/ebooks\/\d+$/);
      }
    }
  });

  it('uses EGW Writings reading links for books not on Project Gutenberg', () => {
    expect(
      LIBRARY_CATALOG.officialCollections.map(({ collection }) => collection).sort(),
    ).toEqual(['adventist-pioneers', 'children']);
    for (const work of LIBRARY_CATALOG.officialCollections) {
      expect(work.rights).toBe('official-external');
      expect(work.sourceName).toBe('EGW Writings');
      expect(work.sourceUrl).toMatch(/^https:\/\/text\.egwwritings\.org\/read\/\d+\.\d+$/);
    }
  });

  it('separates Adventist pioneers from broader Christian classics', () => {
    expect(
      LIBRARY_CATALOG.publicDomainWorks.filter(
        ({ collection }) => collection === 'adventist-pioneers',
      ),
    ).toHaveLength(3);
    expect(
      LIBRARY_CATALOG.publicDomainWorks.filter(
        ({ collection }) => collection === 'christian-classics',
      ),
    ).toHaveLength(5);
  });

  it('puts every book on a shelf the library screens can open', () => {
    const shelves = [
      ...LIBRARY_CATALOG.publicDomainWorks,
      ...LIBRARY_CATALOG.officialCollections,
      ...LIBRARY_CATALOG.churchDocuments,
    ].map((work) => [work.id, getLibraryItemShelf(work)]);

    for (const [, shelf] of shelves) {
      expect(LIBRARY_SHELVES).toContain(shelf);
    }
    expect(Object.fromEntries(shelves)).toMatchObject({
      'bates-seventh-day-sabbath': 'pioneers',
      'andrews-history-sabbath': 'pioneers',
      'smith-state-dead-destiny-wicked': 'pioneers',
      'smith-daniel-revelation': 'pioneers',
      'murray-humility': 'classics',
      'murray-abide-in-christ': 'classics',
      'sibbes-bruised-reed': 'classics',
      'story-of-jesus': 'children',
      'sabbath-encouragement': 'egw',
    });
  });

  it('shows the general Christian shelf first and names every shelf in every language', () => {
    // A visitor should meet the wider Christian shelf before Adventist writers.
    expect(LIBRARY_SHELVES[0]).toBe('classics');
    expect(LIBRARY_SHELVES.indexOf('egw')).toBeGreaterThan(LIBRARY_SHELVES.indexOf('children'));
    for (const shelf of LIBRARY_SHELVES) {
      expect(Object.keys(LIBRARY_SHELF_TITLES[shelf]).sort()).toEqual(['en', 'es', 'zh', 'zh-cn']);
      expect(isLibraryShelf(shelf)).toBe(true);
    }
    expect(isLibraryShelf('topics')).toBe(false);
  });

  it('ships a cover for every book, so none shows the blank placeholder', () => {
    for (const work of [
      ...LIBRARY_CATALOG.publicDomainWorks,
      ...LIBRARY_CATALOG.officialCollections,
      ...LIBRARY_CATALOG.churchDocuments,
    ]) {
      expect(existsSync(join(process.cwd(), 'assets/images/library', `${work.id}.png`))).toBe(true);
    }
  });

  it('serves each church document from the web app and ships its file', () => {
    expect(LIBRARY_CATALOG.churchDocuments.length).toBeGreaterThan(0);
    for (const work of LIBRARY_CATALOG.churchDocuments) {
      const url = new URL(work.sourceUrl);
      expect(work.rights).toBe('church-hosted');
      expect(url.origin).toBe('https://app.nyccsda.org');
      // Files in public/ deploy at the web app's root.
      expect(existsSync(join(process.cwd(), 'public', url.pathname))).toBe(true);
    }
  });

  it('prioritizes Chinese sources for Chinese readers without hiding English works', () => {
    const catalog = getLibraryItemsForLanguage('zh');

    expect(catalog.officialCollections).toHaveLength(
      LIBRARY_CATALOG.officialCollections.length,
    );
    expect(catalog.publicDomainWorks).toHaveLength(
      LIBRARY_CATALOG.publicDomainWorks.length,
    );
  });

  it('lists Sabbath Encouragement only for Chinese readers until it has an English translation', () => {
    const lists = (language: 'en' | 'es' | 'zh' | 'zh-cn') =>
      getLibraryItemsForLanguage(language).churchDocuments.map(({ id }) => id);
    expect(lists('zh')).toContain('sabbath-encouragement');
    expect(lists('zh-cn')).toContain('sabbath-encouragement');
    expect(lists('en')).not.toContain('sabbath-encouragement');
    expect(lists('es')).not.toContain('sabbath-encouragement');
  });

  it('shows each title in one language: Chinese for Chinese readers, English otherwise', () => {
    const [sabbathEncouragement] = LIBRARY_CATALOG.churchDocuments;
    const title = (language: 'en' | 'es' | 'zh' | 'zh-cn') =>
      getLibraryItemDisplayText(sabbathEncouragement, language).title;
    expect(title('en')).toBe('Sabbath Encouragement');
    expect(title('es')).toBe('Sabbath Encouragement');
    expect(title('zh')).toBe('安息日勉言');
    expect(title('zh-cn')).toBe('安息日勉言');
    // A compilation of Bible verses and Ellen G. White quotations.
    expect(sabbathEncouragement.author).toBe('Various');

    // The English text, which every non-Chinese language shows, has no Chinese in it.
    const chinese = /[\u3400-\u9fff]/;
    for (const item of Object.values(LIBRARY_CATALOG).flat()) {
      expect(`${item.id}: ${item.title} ${item.author}`).not.toMatch(chinese);
    }
  });
});
