import {
  getScrollDownOffset,
  getScrollHints,
  PopupFlatList,
  PopupScrollView,
} from '@/components/PopupScrollView';
import { MIN_TAP_TARGET } from '@/styles/ReaderStyles';
import { fireEvent } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { createElement, createRef, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
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

  // The ⌄ looked like a button but let taps through, so a tap on it in the
  // Bible's book list opened the book under it, 1 Samuel (#794). Now a tap on
  // it scrolls down most of a page, and never reaches the row under it.
  describe('a tap on the ⌄', () => {
    it.each([
      // A page less the two 32-point fades, so the faded rows land below the top fade.
      ['the top of longer content', { offset: 0, viewport: 300, content: 900 }, 236],
      ['the middle', { offset: 250, viewport: 300, content: 900 }, 486],
      // It stops at the end, not past it, which iOS would show as blank.
      ['near the end', { offset: 500, viewport: 300, content: 900 }, 600],
      // A short popup still moves half its height.
      ['a short popup', { offset: 0, viewport: 100, content: 900 }, 50],
      ['content that fits', { offset: 0, viewport: 300, content: 280 }, 0],
    ])('at %s scrolls to %s', (_, metrics, offset) => {
      expect(getScrollDownOffset(metrics)).toBe(offset);
    });

    // A list like the Bible's book list, each row choosing a made-up book.
    const books = ['Book of Alder', 'Book of Birch', 'Book of Cedar', 'Book of Dogwood'];
    const renderBookList = (onChoose: (book: string) => void) =>
      renderWithPreferences(
        createElement(PopupFlatList<string>, {
          testID: 'book-list',
          data: books,
          keyExtractor: (book) => book,
          renderItem: ({ item }) =>
            createElement(
              Pressable,
              { accessibilityRole: 'button', onPress: () => onChoose(item) },
              createElement(Text, null, item),
            ),
        }),
      );
    const showMoreBelow = async (list: Parameters<typeof fireEvent>[0]) => {
      await fireEvent(list, 'layout', { nativeEvent: { layout: { height: 300, width: 300 } } });
      await fireEvent(list, 'contentSizeChange', 300, 900);
    };
    // The ⌄ is hidden from screen readers, so the queries include hidden elements.
    const hidden = { includeHiddenElements: true } as const;

    it('scrolls a popup’s list and doesn’t choose the row under it', async () => {
      const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
      const onChoose = jest.fn();
      const screen = await renderBookList(onChoose);
      await showMoreBelow(screen.getByTestId('book-list'));

      await fireEvent.press(screen.getByTestId('popup-scroll-more', hidden));

      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ y: 236, animated: true }));
      expect(onChoose).not.toHaveBeenCalled();
    });

    it('scrolls a popup’s ScrollView, such as Text size', async () => {
      const ref = createRef<ComponentRef<typeof ScrollView>>();
      const screen = await renderWithPreferences(
        createElement(PopupScrollView, { ref, testID: 'popup-scroll' }, createElement(Text, null, 'Verse')),
      );
      await showMoreBelow(screen.getByTestId('popup-scroll'));

      await fireEvent.press(screen.getByTestId('popup-scroll-more', hidden));

      expect(ref.current?.scrollTo).toHaveBeenCalledWith({ y: 236, animated: true });
    });

    it('is a tap target at least 44 points square, inside what holds it', async () => {
      const screen = await renderBookList(jest.fn());
      await showMoreBelow(screen.getByTestId('book-list'));
      const size = (testID: string) => {
        const { width, height } = StyleSheet.flatten(screen.getByTestId(testID, hidden).props.style);
        return { width, height };
      };

      expect(size('popup-scroll-more')).toEqual({ width: MIN_TAP_TARGET, height: MIN_TAP_TARGET });
      // Android sends a tap only to what lies inside its parent's bounds.
      expect(size('popup-scroll-hint-below').height).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
      // Beside the ⌄, taps reach the rows: only the button takes them.
      expect(screen.getByTestId('popup-scroll-hint-below', hidden).props.pointerEvents).toBe('box-none');
    });
  });

  it('is used by every popup that scrolls', () => {
    for (const file of [
      'components/LanguageDialog.tsx',
      'components/ThemeDialog.tsx',
      'components/ContrastDialog.tsx',
      'components/TextSizeDialog.tsx',
      // First-launch setup's and the contrast question's full screen (#708).
      'components/SetupScreen.tsx',
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
