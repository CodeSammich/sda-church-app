import React from 'react';
import { readFileSync } from 'node:fs';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import {
  fitGridMenuCardTextScale,
  GRID_MENU_CARD_TEXT_MIN_SCALE,
  getGridMenuCardColumns,
  getGridMenuCardTextScale,
  getGridMenuCardTitleWidth,
  getGridMenuCardTitleWords,
  GridMenuCard,
} from '@/components/GridMenuCard';
import { TextSizeContext } from '@/constants/TextSizeContext';

jest.mock('@/constants/Themes', () => {
  const themes = jest.requireActual('@/constants/Themes');
  return { ...themes, useAppTheme: () => themes.customLightTheme };
});

// The phone's window: its width, in points, and its text size. (A spy on
// react-native's export doesn't reach the card, which React Native's own test
// window, at 2× text, would.)
let mockWindowDimensions = { fontScale: 1, height: 853, scale: 2, width: 384 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindowDimensions,
}));
const mockWindow = (width: number, fontScale = 1) => {
  mockWindowDimensions = { fontScale, height: 853, scale: 2, width };
};

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const MockIcon = (props: { name: string }) =>
    React.createElement('MockIcon', { ...props, testID: `icon-${props.name}` });
  MockIcon.glyphMap = {};
  return { Ionicons: MockIcon, MaterialCommunityIcons: MockIcon };
});

const renderCard = (textScale: number, props: Partial<React.ComponentProps<typeof GridMenuCard>> = {}) =>
  render(
    React.createElement(
      TextSizeContext.Provider,
      { value: { setTextScale: jest.fn(async () => {}), textScale: textScale as any } },
      React.createElement(GridMenuCard, {
        color: '#eeeeee',
        icon: 'video',
        onPress: jest.fn(),
        title: 'Watch Livestream',
        ...props,
      }),
    ),
  );

// The cards on Home and New Member & Visitor. Until 1.9.2 their titles
// stopped at the default 1.25× (#387) and shrank from there to keep a word
// whole beside another card (#324), so at 200% the cards and their icons grew
// and the titles didn't. Now the titles grow with the text, and a card takes a
// row of its own where a word wouldn't fit beside another.
describe('grid menu card text size', () => {
  it.each([
    // app, phone, card text
    [1.25, 1, 1.25],
    [1, 1.2, 1.2],
    [1, 0.85, 0.85],
    [1.25, 1.5, 1.875],
    [1.5, 1, 1.5],
    [2, 1, 2],
    [1.6, 2, 3.2],
  ] as const)('scales card text to %s× app and %s× phone as %s×', (textScale, fontScale, scale) => {
    expect(getGridMenuCardTextScale(textScale, fontScale)).toBeCloseTo(scale, 5);
  });

  it.each([1, 1.25, 1.5, 2])('grows the title with its icon at %s× text', async (textScale) => {
    mockWindow(384);
    const view = await renderCard(textScale);
    // A card a row wide on the 384-point phone, with room for every word.
    await fireEvent(view.getByRole('button'), 'layout', { nativeEvent: { layout: { height: 300, width: 344, x: 0, y: 0 } } });
    const title = StyleSheet.flatten(view.getByText('Watch Livestream').props.style);
    const icon = view.getByTestId('icon-video');
    expect(title.fontSize).toBeCloseTo(15 * textScale, 5);
    expect(icon.props.size).toBeCloseTo(68 * textScale, 5);
    expect(title.fontSize / icon.props.size).toBeCloseTo(15 / 68, 5);
  });

  it('applies the phone text size itself, in full, at 200% app and 160% phone text', async () => {
    mockWindow(412, 1.6);
    const view = await renderCard(2, { subtitle: 'Live now' });
    const title = view.getByText('Watch Livestream');
    expect(StyleSheet.flatten(title.props.style).fontSize).toBeCloseTo(48, 5);
    // The card applies the phone's size itself, so React Native mustn't again.
    expect(title.props.allowFontScaling).toBe(false);
    const subtitle = view.getByText('Live now');
    expect(StyleSheet.flatten(subtitle.props.style).fontSize).toBeCloseTo(38.4, 5);
    expect(subtitle.props.allowFontScaling).toBe(false);
  });

  // Home's grid on the 384-point Android phone is 344 points wide: two
  // 168-point cards, whose titles have 130 points, less 2 spare.
  it('puts two cards a row only where the widest word fits beside another card', () => {
    expect(getGridMenuCardTitleWidth(168)).toBe(130);
    expect(getGridMenuCardColumns(344, 8, 128)).toBe(2);
    expect(getGridMenuCardColumns(344, 8, 129)).toBe(1);
    // Chinese at 200%: 安息日學 is 4 characters of 30 points.
    expect(getGridMenuCardColumns(344, 8, 4 * 30)).toBe(2);
    // 本週安息日學課程 whole at 125%, 150 points, wouldn't fit at the default size.
    expect(getGridMenuCardColumns(344, 8, 8 * 18.75)).toBe(1);
    // Two until the word is measured, or the row is.
    expect(getGridMenuCardColumns(344, 8, 0)).toBe(2);
    expect(getGridMenuCardColumns(0, 8, 400)).toBe(2);
  });

  it('shrinks the text only for a word wider than its card', () => {
    // A card a row wide on the 384-point phone: 306 points of title, at the
    // app's 200% and the phone's 160% together.
    const largest = getGridMenuCardTextScale(2, 1.6);
    expect(fitGridMenuCardTextScale(largest, 344, 300)).toBeCloseTo(3.2, 5);
    expect(fitGridMenuCardTextScale(largest, 344, 320)).toBeCloseTo((3.2 * 304) / 320, 5);
    // No measurement yet keeps the size.
    expect(fitGridMenuCardTextScale(2, 0, 320)).toBe(2);
    expect(fitGridMenuCardTextScale(2, 344, 0)).toBe(2);
    // Never below 80%, even in a very narrow window.
    expect(fitGridMenuCardTextScale(1.25, 140, 400)).toBe(GRID_MENU_CARD_TEXT_MIN_SCALE);
  });

  it('breaks a Chinese title only between the words marked in it', () => {
    const words = (title: string) => getGridMenuCardTitleWords(title).map((word) => word.replace(/\u2060/gu, ''));
    expect(words('About Denomination')).toEqual(['About', 'Denomination']);
    expect(words('本週\u200b安息日學\u200b課程')).toEqual(['本週', '安息日學', '課程']);
    expect(words('新會友／\u200b訪客')).toEqual(['新會友／', '訪客']);
    // Unmarked, the title is one word, and a phone may break it anywhere.
    expect(words('本週安息日學課程')).toEqual(['本週安息日學課程']);
    // keepWordsWhole holds each word's characters together.
    expect(getGridMenuCardTitleWords('本週\u200b安息日學')[1]).toBe('安\u2060息\u2060日\u2060學');
  });

  it("keeps every Chinese word of Home's and New Member & Visitor's cards to 4 characters", () => {
    // So Chinese cards share a row up to 200% on the 384-point phone, 120
    // points a word (#797). A longer title marks its words with \u200b.
    const keys = /\b(livestream|discover|bulletin|give|sabbathSchool|hymnal|aboutSDA|aboutHistory|meetTeam|join|fellowship|bible): '([^']*)'/gu;
    const titles = ['app/(tabs)/index.tsx', 'app/(tabs)/home/discover.tsx'].flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(keys)].map((match) => match[2].replace(/\\u200b/gu, '\u200b')),
    );
    const chinese = titles.filter((title) => /\p{Script=Han}/u.test(title));
    // Six cards in each of two Chinese scripts on each of the two pages.
    expect(chinese).toHaveLength(24);
    for (const title of chinese) {
      for (const word of getGridMenuCardTitleWords(title)) {
        expect([title, [...word.replace(/\u2060/gu, '')].length <= 4]).toEqual([title, true]);
      }
    }
  });

  it('gives each card a row of its own on Home and New Member & Visitor where a word would not fit', () => {
    const home = readFileSync('app/(tabs)/index.tsx', 'utf8');
    expect(home).toMatch(
      /useGridMenuCardColumns\(\s*getContentWidth\(windowWidth, effectiveTextScale\) - 2 \* CONTENT_PADDING,\s*GRID_GAP,\s*\)/,
    );
    const discover = readFileSync('app/(tabs)/home/discover.tsx', 'utf8');
    expect(discover).toMatch(
      /useGridMenuCardColumns\(\s*getContentWidth\(windowWidth, columnScale\) - 2 \* GRID_PADDING,\s*GRID_GAP,\s*\)/,
    );
    for (const source of [home, discover]) {
      // Every card measures its grid's words, and takes the grid's cell style.
      expect(source.match(/<GridMenuCard\b/gu)).toHaveLength(6);
      expect(source.match(/onWidestWord=\{onGridWidestWord\}/gu)).toHaveLength(6);
      expect(source.match(/style=\{gridCellStyle\}/gu)).toHaveLength(6);
      expect(source).toMatch(/gridCellFullRow: \{\s*flexBasis: '100%',\s*\}/);
    }
  });

  it("measures the grid's words at the card's size and reports the widest", async () => {
    mockWindow(375);
    const onWidestWord = jest.fn();
    const fitTitles = ['About Denomination', 'Locations & History'];
    const view = await renderCard(1.25, { fitTitles, onWidestWord, title: 'Locations & History' });
    const titleSize = () => StyleSheet.flatten(view.getByText('Locations & History').props.style).fontSize;
    expect(titleSize()).toBeCloseTo(18.75, 5);

    // Every word of the grid's titles, one a line, measured at the card's size.
    // Hidden from screen readers, so the query must ask for hidden elements.
    const measure = view.getByTestId('grid-menu-card-word-measure', { includeHiddenElements: true });
    expect(measure.props.children).toBe(['About', 'Denomination', 'Locations', '&', 'History'].join('\n'));
    expect(StyleSheet.flatten(measure.props.style).fontSize).toBeCloseTo(18.75, 5);
    await fireEvent(view.getByRole('button'), 'layout', { nativeEvent: { layout: { height: 200, width: 168, x: 0, y: 0 } } });
    await fireEvent(measure, 'textLayout', { nativeEvent: { lines: [{ width: 52 }, { width: 117 }, { width: 80 }] } });
    expect(onWidestWord).toHaveBeenLastCalledWith(117);
    // It fits the card's 128 points, so the text keeps its size.
    expect(titleSize()).toBeCloseTo(18.75, 5);

    // A word wider than the card, as in a very narrow window, shrinks it just enough.
    await fireEvent(measure, 'textLayout', { nativeEvent: { lines: [{ width: 140 }] } });
    expect(titleSize()).toBeCloseTo(15 * ((1.25 * 128) / 140), 2);
  });

  it('reads a Chinese title aloud without the marks between its words', async () => {
    mockWindow(384);
    const view = await renderCard(1.5, { title: '本週\u200b安息日學\u200b課程' });
    expect(view.getByLabelText('本週安息日學課程')).toBeTruthy();
  });
});
