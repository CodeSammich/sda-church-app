import { createElement, type ComponentType } from 'react';
import { StyleSheet } from 'react-native';

import { shouldUseLibraryListLayout } from '@/components/LibraryBookCard';
import type { TextScale } from '@/constants/AppPreferences';
import { customLightTheme } from '@/constants/Themes';
import { renderWithPreferences } from './helpers/render-preferences';

// The window every screen here sees; each test sets its width.
let mockWindow = { fontScale: 1, height: 1024, scale: 2, width: 390 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ collection: 'youth' }),
}));

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

// Made-up books whose titles and authors wrap to different lengths, as the
// Youth shelf's do (#777).
const mockBooks = [
  { title: 'A Short Title', author: 'Ann Lee' },
  { title: 'A Much Longer Title That Wraps Onto a Third Line', author: 'Bartholomew Q. Ashworth-Lindqvist' },
  { title: 'Middling', author: 'Cy Ng' },
  { title: 'Fourth Book', author: 'Dee Ortiz' },
].map((book, index) => ({
  ...book,
  accessibilityHint: 'Opens the book',
  key: `book-${index}`,
  onPress: jest.fn(),
}));

jest.mock('@/features/library/useLibraryShelfBooks', () => ({
  useLibraryShelfBooks: () => ({ getShelfBooks: () => mockBooks }),
}));

describe('library book layout', () => {
  it('uses compact cover tiles at standard text size', () => {
    expect(shouldUseLibraryListLayout(390, 1)).toBe(false);
  });

  it('switches to a readable list when text is enlarged', () => {
    expect(shouldUseLibraryListLayout(390, 1.2)).toBe(true);
  });

  it('uses a list on very narrow screens', () => {
    expect(shouldUseLibraryListLayout(340, 1)).toBe(true);
  });
});

describe('library grid on wide screens (#324)', () => {
  const { getLibraryGridCardWidth, getLibraryGridColumns } = require('@/components/LibraryBookCard');

  it('keeps two covers a row on a phone, the same width as before', () => {
    expect(getLibraryGridColumns(390)).toBe(2);
    // Half of what's left after the 20-point padding and the 12-point gap.
    expect(getLibraryGridCardWidth(390)).toBe(169);
  });

  it("puts three covers in a row of a tablet's content column", () => {
    expect(getLibraryGridColumns(720)).toBe(3);
    expect(getLibraryGridCardWidth(720)).toBe(218);
  });
});

// Yoga doesn't run under Jest, so these check the styles that make a row's
// cards one height: the grid stretches each card to its row's tallest, and a
// card's details fill what's under the cover, with the author at the bottom.
describe("a library shelf's cards in a row (#777)", () => {
  const flatStyle = (node: any) => StyleSheet.flatten(node?.props?.style) ?? {};
  const ancestor = (node: any, matches: (style: Record<string, any>) => boolean) => {
    let current = node?.parent;
    while (current && !matches(flatStyle(current))) current = current.parent;
    return current;
  };

  const renderShelf = async (width: number, textScale: TextScale) => {
    mockWindow = { ...mockWindow, width };
    const LibraryShelfScreen: ComponentType =
      require('@/app/(tabs)/explore/library/[collection]').default;
    return await renderWithPreferences(createElement(LibraryShelfScreen), {
      textScale,
      theme: customLightTheme,
    });
  };

  const cardOf = (view: any, book: (typeof mockBooks)[number]) =>
    view.getByLabelText(`${book.title}. ${book.author}`);

  it.each([
    // An iPad in landscape: the column is 864 points at 150%, three covers wide.
    ["an iPad's three columns at its 150%", 1194, 1.5, 266],
    ["a phone's two columns at 100%", 390, 1, 169],
  ] as const)('are as tall as the tallest in %s', async (_name, width, textScale, cardWidth) => {
    const view = await renderShelf(width, textScale);
    const grid = ancestor(cardOf(view, mockBooks[0]), (style) => style.flexWrap === 'wrap');
    expect(flatStyle(grid)).toMatchObject({ alignItems: 'stretch', flexDirection: 'row' });

    for (const book of mockBooks) {
      const card = flatStyle(cardOf(view, book));
      expect(card.width).toBe(cardWidth);
      // Nothing holds a card to its own height.
      expect(card.height).toBeUndefined();
      expect(card.alignSelf).toBeUndefined();
      // The cover stays at the top; the details take the rest of the card.
      const details = ancestor(view.getByText(book.title), (style) => style.padding === 12);
      expect(flatStyle(details)).toMatchObject({ flexGrow: 1, justifyContent: 'space-between' });
      const cover = flatStyle(details.parent.children.find((child: any) => child !== details));
      expect(cover).toMatchObject({ aspectRatio: 2 / 3, width: '100%' });
      expect(cover.flexGrow).toBeUndefined();
    }
  });

  it("keeps the list's cards as they were at a phone's 125%", async () => {
    const view = await renderShelf(390, 1.25);
    const details = ancestor(view.getByText(mockBooks[1].title), (style) => style.padding !== undefined);
    expect(flatStyle(details)).toMatchObject({ flex: 1, justifyContent: 'center', padding: 16 });
    expect(flatStyle(details).flexGrow).toBeUndefined();
    expect(flatStyle(cardOf(view, mockBooks[1]))).toMatchObject({ flexDirection: 'row', width: '100%' });
  });
});
