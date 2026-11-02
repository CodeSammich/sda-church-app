import { shouldUseLibraryListLayout } from '@/components/LibraryBookCard';

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
