import { EGW_BOOKS } from '@/features/library/EgwBookCatalog';
import { getLibraryItemShelf, LIBRARY_CATALOG } from '@/features/library/LibraryCatalog';
import {
  CATALOG_ITEM_IDS_BY_SHELF,
  EGW_BOOK_IDS_BY_SHELF,
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

describe('keeping the library balanced (#391)', () => {
  const catalogItems = [
    ...LIBRARY_CATALOG.publicDomainWorks,
    ...LIBRARY_CATALOG.officialCollections,
    ...LIBRARY_CATALOG.churchDocuments,
  ];

  it('puts her books after the others even when a shelf leads with one of hers', () => {
    expect(
      orderShelfBooks('children', [
        { key: 'sabbath-encouragement', byEllenWhite: true },
        { key: 'egw:education', byEllenWhite: true },
        { key: 'other', byEllenWhite: false },
      ]).map(({ key }) => key),
    ).toEqual(['other', 'sabbath-encouragement', 'egw:education']);
    expect(
      orderShelfBooks('egw', [
        { key: 'egw:education', byEllenWhite: true },
        { key: 'sabbath-encouragement', byEllenWhite: false },
      ]).map(({ key }) => key),
    ).toEqual(['sabbath-encouragement', 'egw:education']);
  });

  it('puts each of her books on one shelf besides her own at most', () => {
    const ids = Object.values(EGW_BOOK_IDS_BY_SHELF).flatMap((ids) => ids ?? []);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(EGW_BOOKS.map((book) => book.id)).toContain(id);
  });

  it('features one Ellen G. White book at most', () => {
    const hers = FEATURED_LIBRARY_BOOKS.filter((key) => {
      const item = catalogItems.find(({ id }) => id === key);
      return (
        key.startsWith('egw:') ||
        item?.author === 'Ellen G. White' ||
        (item && getLibraryItemShelf(item) === 'egw')
      );
    });
    expect(hers).toEqual(['egw:steps-to-christ']);
  });

  it('names only catalog books as extra shelf books', () => {
    for (const ids of Object.values(CATALOG_ITEM_IDS_BY_SHELF)) {
      for (const id of ids ?? []) expect(catalogItems.map((item) => item.id)).toContain(id);
    }
  });
});
