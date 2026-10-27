import { getScrollHints, PopupScrollView } from '@/components/PopupScrollView';
import { fireEvent } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { Text } from 'react-native';
import { renderWithPreferences } from './helpers/render-preferences';

// Popups show when there's more to scroll (#521): a fade and ⌄ at the bottom
// while there's more below, and a fade at the top once scrolled.
describe('popup scroll hints', () => {
  it.each([
    ['content that fits', { offset: 0, viewport: 300, content: 280 }, { above: false, below: false }],
    ['the top of longer content', { offset: 0, viewport: 300, content: 900 }, { above: false, below: true }],
    ['the middle', { offset: 250, viewport: 300, content: 900 }, { above: true, below: true }],
    ['the end', { offset: 600, viewport: 300, content: 900 }, { above: true, below: false }],
    ['a point from the end', { offset: 599, viewport: 300, content: 900 }, { above: true, below: false }],
    ['before the first layout', { offset: 0, viewport: 0, content: 900 }, { above: false, below: false }],
  ])('at %s', (_, metrics, hints) => {
    expect(getScrollHints(metrics)).toEqual(hints);
  });

  it('shows and hides them as the popup scrolls', async () => {
    const screen = await renderWithPreferences(
      createElement(PopupScrollView, { testID: 'popup-scroll' }, createElement(Text, null, 'Verse')),
    );
    const scroll = screen.getByTestId('popup-scroll');
    const scrollTo = (y: number) =>
      fireEvent.scroll(scroll, {
        nativeEvent: {
          contentOffset: { x: 0, y },
          contentSize: { height: 900, width: 300 },
          layoutMeasurement: { height: 300, width: 300 },
        },
      });
    // The hints are hidden from screen readers, so the queries include hidden elements.
    const shown = () => ({
      above: screen.queryByTestId('popup-scroll-hint-above', { includeHiddenElements: true }) !== null,
      below: screen.queryByTestId('popup-scroll-hint-below', { includeHiddenElements: true }) !== null,
    });

    expect(shown()).toEqual({ above: false, below: false });
    await fireEvent(scroll, 'layout', { nativeEvent: { layout: { height: 300, width: 300 } } });
    await fireEvent(scroll, 'contentSizeChange', 300, 900);
    expect(shown()).toEqual({ above: false, below: true });
    await scrollTo(250);
    expect(shown()).toEqual({ above: true, below: true });
    await scrollTo(600);
    expect(shown()).toEqual({ above: true, below: false });
  });

  it('keeps a popup’s own scroll handler', async () => {
    const onScroll = jest.fn();
    const screen = await renderWithPreferences(
      createElement(PopupScrollView, { testID: 'popup-scroll', onScroll }, createElement(Text, null, 'Verse')),
    );
    await fireEvent.scroll(screen.getByTestId('popup-scroll'), {
      nativeEvent: { contentOffset: { x: 0, y: 10 }, contentSize: { height: 900, width: 300 }, layoutMeasurement: { height: 300, width: 300 } },
    });
    expect(onScroll).toHaveBeenCalledTimes(1);
  });

  it('is used by every popup that scrolls', () => {
    for (const file of [
      'components/LanguageDialog.tsx',
      'components/ThemeDialog.tsx',
      'components/TextSizeDialog.tsx',
      'components/InitialSetup.tsx',
    ]) {
      const source = readFileSync(file, 'utf8');
      expect([file, /<ScrollView\b/.test(source), source.includes('<PopupScrollView')]).toEqual([file, false, true]);
    }
    const bible = readFileSync('app/(tabs)/bible/index.tsx', 'utf8');
    // Only the reader itself and the chapter controls aren't popups.
    expect(bible.match(/<ScrollView\b/g)).toHaveLength(2);
    expect(bible.match(/<FlatList\b/g)).toBeNull();
    // Audio settings, the background-audio note, the sleep timer, a verse's
    // hymns, and the verse popup; saved verses and the pickers.
    expect(bible.match(/<PopupScrollView\b/g)).toHaveLength(5);
    expect(bible.match(/<PopupFlatList\b/g)).toHaveLength(2);
  });
});
