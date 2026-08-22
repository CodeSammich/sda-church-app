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
