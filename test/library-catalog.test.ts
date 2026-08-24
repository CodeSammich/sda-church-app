import { getLibraryItemsForLanguage, LIBRARY_CATALOG } from '@/features/library/LibraryCatalog';

describe('library catalog', () => {
  it('keeps native-eligible public-domain works tied to explicit Gutenberg records', () => {
    expect(LIBRARY_CATALOG.publicDomainWorks.length).toBeGreaterThan(0);

    for (const work of LIBRARY_CATALOG.publicDomainWorks) {
      expect(work.rights).toBe('public-domain-us');
      expect(work.publicationYear).toBeLessThan(1928);
      expect(work.sourceName).toBe('Project Gutenberg');
      expect(work.sourceUrl).toMatch(/^https:\/\/(www\.)?gutenberg\.org\/ebooks\/\d+$/);
    }
  });

  it('uses official reading links for the children starter shelf', () => {
    expect(LIBRARY_CATALOG.officialCollections).toHaveLength(1);
    expect(
      LIBRARY_CATALOG.officialCollections.map(({ collection }) => collection).sort(),
    ).toEqual(['children']);
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
    ).toHaveLength(2);
    expect(
      LIBRARY_CATALOG.publicDomainWorks.filter(
        ({ collection }) => collection === 'christian-classics',
      ),
    ).toHaveLength(1);
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
});
