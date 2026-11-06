import { LibraryShelfRow } from '@/components/LibraryShelfRow';
import { fireEvent } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderWithPreferences } from './helpers/render-preferences';

describe("a library shelf's heading (#681)", () => {
  it('opens the shelf from anywhere on its row, as See all does', async () => {
    const onSeeAll = jest.fn();
    const screen = await renderWithPreferences(
      createElement(LibraryShelfRow, { books: [], onSeeAll, seeAllLabel: 'See all', title: 'Christian Classics' }),
    );
    fireEvent.press(screen.getByTestId('library-shelf-heading'));
    fireEvent.press(screen.getByRole('button', { name: 'See all: Christian Classics' }));
    expect(onSeeAll).toHaveBeenCalledTimes(2);
    // Screen readers still find the title as a heading, and See all as a button.
    expect(screen.getByRole('header', { name: 'Christian Classics' })).toBeTruthy();
  });

  it("puts See all at the screen's edge on a wide screen, where the row ends", () => {
    const source = readFileSync('components/LibraryShelfRow.tsx', 'utf8');
    expect(source).toContain('style={[styles.header, { paddingLeft: 20 + sideInset }');
    expect(source).not.toContain('contentColumnStyle');
  });
});
