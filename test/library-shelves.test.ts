import { EGW_BOOKS } from '@/features/library/EgwBookCatalog';
import { LIBRARY_CATALOG } from '@/features/library/LibraryCatalog';
import {
  FEATURED_LIBRARY_BOOKS,
  LIBRARY_SHELF_LEADERS,
  orderShelfBooks,
} from '@/features/library/LibraryShelves';

const books = (...keys: string[]) => keys.map((key) => ({ key }));

describe('library shelf order', () => {
  it('puts the leading books first and keeps the rest in catalog order', () => {
    const ordered = orderShelfBooks('egw', books(
      'egw:prophets-and-kings',
      'egw:education',
      'egw:acts-of-the-apostles',
      'sabbath-encouragement',
      'egw:desire-of-ages',
    ));
    expect(ordered.map(({ key }) => key)).toEqual([
      'sabbath-encouragement',
      'egw:desire-of-ages',
      'egw:education',
      'egw:prophets-and-kings',
      'egw:acts-of-the-apostles',
    ]);
  });

  it('leads Christian Classics with The Bruised Reed and Ellen G. White with Sabbath Encouragement', () => {
    expect(LIBRARY_SHELF_LEADERS.classics?.[0]).toBe('sibbes-bruised-reed');
    expect(LIBRARY_SHELF_LEADERS.egw?.[0]).toBe('sabbath-encouragement');
    expect(orderShelfBooks('children', books('b', 'a'))).toEqual(books('b', 'a'));
  });

  it('names only books that exist, on shelves and in the featured banner', () => {
    const keys = new Set([
      ...EGW_BOOKS.map(({ id }) => `egw:${id}`),
      ...LIBRARY_CATALOG.publicDomainWorks.map(({ id }) => id),
      ...LIBRARY_CATALOG.officialCollections.map(({ id }) => id),
      ...LIBRARY_CATALOG.churchDocuments.map(({ id }) => id),
    ]);
    for (const leaders of Object.values(LIBRARY_SHELF_LEADERS)) {
      for (const key of leaders ?? []) expect(keys).toContain(key);
    }
    for (const key of FEATURED_LIBRARY_BOOKS) expect(keys).toContain(key);
  });
});
