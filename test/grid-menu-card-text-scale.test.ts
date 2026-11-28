import React from 'react';
import { readFileSync } from 'node:fs';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import {
  fitGridMenuCardTextScale,
  GRID_MENU_CARD_TEXT_MIN_SCALE,
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

// The marks a Chinese title's words carry: a zero-width space between its
// words, and keepWordsWhole's word joiner between the characters of each.
const WORD_MARK = String.fromCharCode(0x200b);
const JOINER = String.fromCharCode(0x2060);
const marked = (...words: string[]) => words.join(WORD_MARK);

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

/** Lays a rendered card out `width` points wide, its grid's widest word `word` points wide. */
const layOut = async (view: Awaited<ReturnType<typeof renderCard>>, width: number, word: number) => {
  await fireEvent(view.getByRole('button'), 'layout', { nativeEvent: { layout: { height: 300, width, x: 0, y: 0 } } });
  const measure = view.getByTestId('grid-menu-card-word-measure', { includeHiddenElements: true });
  await fireEvent(measure, 'textLayout', { nativeEvent: { lines: [{ width: word }] } });
};

// The cards on Home and New Member & Visitor, two a row at every size (#387).
// Until 1.9.2 their titles stopped at the default 1.25× while their icons and
// the cards grew with the text size, so at 200% the icons were big and the
// titles small. Now title, icon and card grow together, up to the largest size
// at which the widest word of the grid's titles fits a card.
describe('grid menu card text size', () => {
  it.each([
    // app, phone, card's scale before it's fitted
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

  it.each([1, 1.25, 1.5, 2])('grows the title with its icon and the card at %s× text, while the words fit', async (textScale) => {
    mockWindow(384);
    const view = await renderCard(textScale);
    // Half the 384-point phone's row, and a word 60 points wide at 100%.
    await layOut(view, 172, 60 * textScale);
    const title = StyleSheet.flatten(view.getByText('Watch Livestream').props.style);
    const icon = view.getByTestId('icon-video');
    expect(title.fontSize).toBeCloseTo(15 * textScale, 5);
    expect(icon.props.size).toBeCloseTo(68 * textScale, 5);
    expect(StyleSheet.flatten(view.getByRole('button').props.style).minHeight).toBe(
      148 + Math.round((textScale - 1) * 64),
    );
  });

  it('stops the title, icon and card together at the largest size the widest word fits', async () => {
    // 200% app and 160% phone text: 3.2×, where "Denomination" is about 260
    // points, twice what a 172-point card's title has.
    mockWindow(384, 1.6);
    const view = await renderCard(2);
    await layOut(view, 172, 260);
    const cap = (3.2 * 132) / 260;
    const title = StyleSheet.flatten(view.getByText('Watch Livestream').props.style);
    const icon = view.getByTestId('icon-video');
    expect(title.fontSize).toBeCloseTo(15 * cap, 1);
    expect(icon.props.size).toBeCloseTo(68 * cap, 1);
    // The title stays in proportion to the icon, as at 100%.
    expect(title.fontSize / icon.props.size).toBeCloseTo(15 / 68, 2);
    expect(StyleSheet.flatten(view.getByRole('button').props.style).minHeight).toBe(148 + Math.round((cap - 1) * 64));
    // Larger than the 1.25× the title stopped at until 1.9.2.
    expect(cap).toBeGreaterThan(1.25);
  });

  it('applies the phone text size itself, in full, before the card knows its width', async () => {
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

  // A card on Home on the 384-point Android phone is 168 points wide, and its
  // title has all of it but the padding and border: 130 points, less 2 spare.
  it('keeps the size while the widest word fits, and stops where it no longer would', () => {
    expect(getGridMenuCardTitleWidth(168)).toBe(130);
    expect(fitGridMenuCardTextScale(1.25, 168, 128)).toBe(1.25);
    expect(fitGridMenuCardTextScale(1.25, 168, 140)).toBeCloseTo((1.25 * 128) / 140, 5);
    // Chinese at 200%: 安息日學, 4 characters of 30 points, still fits.
    expect(fitGridMenuCardTextScale(2, 168, 4 * 30)).toBe(2);
    // 本週安息日學課程 unmarked, one word of 8 characters, stopped Chinese at
    // about 107% even at the default 125%.
    expect(fitGridMenuCardTextScale(1.25, 168, 8 * 18.75)).toBeCloseTo((1.25 * 128) / 150, 5);
    // No measurement yet keeps the size.
    expect(fitGridMenuCardTextScale(2, 0, 320)).toBe(2);
    expect(fitGridMenuCardTextScale(2, 168, 0)).toBe(2);
    // Never below 80%, even in a very narrow window.
    expect(fitGridMenuCardTextScale(1.25, 140, 400)).toBe(GRID_MENU_CARD_TEXT_MIN_SCALE);
  });

  it('breaks a Chinese title only between the words marked in it', () => {
    const words = (title: string) => getGridMenuCardTitleWords(title).map((word) => word.split(JOINER).join(''));
    expect(words('About Denomination')).toEqual(['About', 'Denomination']);
    expect(words(marked('本週', '安息日學', '課程'))).toEqual(['本週', '安息日學', '課程']);
    expect(words(marked('新會友／', '訪客'))).toEqual(['新會友／', '訪客']);
    // Unmarked, the title is one word, which a phone may break anywhere.
    expect(words('本週安息日學課程')).toEqual(['本週安息日學課程']);
    // keepWordsWhole holds each word's characters together.
    expect(getGridMenuCardTitleWords(marked('本週', '安息日學'))[1]).toBe(['安', '息', '日', '學'].join(JOINER));
  });

  it("keeps every Chinese word of Home's and New Member & Visitor's cards to 4 characters", () => {
    // So Chinese titles grow to 200% on the 384-point phone, 120 points a word
    // (#797). A longer title marks its words with a zero-width space.
    const keys = /\b(livestream|discover|bulletin|give|sabbathSchool|hymnal|aboutSDA|aboutHistory|meetTeam|join|fellowship|bible): '([^']*)'/gu;
    const escapedMark = `${String.fromCharCode(92)}u200b`;
    const titles = ['app/(tabs)/index.tsx', 'app/(tabs)/home/discover.tsx'].flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(keys)].map((match) => match[2].split(escapedMark).join(WORD_MARK)),
    );
    const chinese = titles.filter((title) => /\p{Script=Han}/u.test(title));
    // Six cards in each of two Chinese scripts on each of the two pages.
    expect(chinese).toHaveLength(24);
    for (const title of chinese) {
      for (const word of getGridMenuCardTitleWords(title)) {
        expect([title, [...word.split(JOINER).join('')].length <= 4]).toEqual([title, true]);
      }
    }
  });

  it('keeps the cards on Home and New Member & Visitor two a row at every size', () => {
    const home = readFileSync('app/(tabs)/index.tsx', 'utf8');
    expect(home).toMatch(/const useStackedLayout = false;/);
    expect(home).toMatch(/flexBasis: useStackedLayout \? '100%' : '47\.5%',/);
    const discover = readFileSync('app/(tabs)/home/discover.tsx', 'utf8');
    expect(discover).toMatch(/gridCell: \{\s*flexBasis: '47\.5%',\s*flexGrow: 1,\s*\}/);
    for (const source of [home, discover]) {
      // Every card measures the grid's words, so the cards keep one size.
      expect(source.match(/<GridMenuCard\b/gu)).toHaveLength(6);
      expect(source.match(/fitTitles=\{gridTitles\}/gu)).toHaveLength(6);
    }
  });

  it("measures the grid's words at the reader's size", async () => {
    mockWindow(375);
    const fitTitles = ['About Denomination', 'Locations & History'];
    const view = await renderCard(1.25, { fitTitles, title: 'Locations & History' });
    const titleSize = () => StyleSheet.flatten(view.getByText('Locations & History').props.style).fontSize;
    expect(titleSize()).toBeCloseTo(18.75, 5);

    // Every word of the grid's titles, one a line, measured at the reader's size.
    // Hidden from screen readers, so the query must ask for hidden elements.
    const measure = view.getByTestId('grid-menu-card-word-measure', { includeHiddenElements: true });
    expect(measure.props.children).toBe(['About', 'Denomination', 'Locations', '&', 'History'].join('\n'));
    expect(StyleSheet.flatten(measure.props.style).fontSize).toBeCloseTo(18.75, 5);
    await fireEvent(view.getByRole('button'), 'layout', { nativeEvent: { layout: { height: 200, width: 168, x: 0, y: 0 } } });
    await fireEvent(measure, 'textLayout', { nativeEvent: { lines: [{ width: 52 }, { width: 117 }, { width: 80 }] } });
    // It fits the card's 128 points, so the text keeps its size.
    expect(titleSize()).toBeCloseTo(18.75, 5);

    // A wider word, as in a narrow window, stops it where that word fits.
    await fireEvent(measure, 'textLayout', { nativeEvent: { lines: [{ width: 140 }] } });
    expect(titleSize()).toBeCloseTo(15 * ((1.25 * 128) / 140), 2);
  });

  it('reads a Chinese title aloud without the marks between its words', async () => {
    mockWindow(384);
    const view = await renderCard(1.5, { title: marked('本週', '安息日學', '課程') });
    expect(view.getByLabelText('本週安息日學課程')).toBeTruthy();
  });
});
