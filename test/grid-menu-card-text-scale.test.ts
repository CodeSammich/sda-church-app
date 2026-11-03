import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { StyleSheet } from 'react-native';

import {
  fitGridMenuCardTextScale,
  GRID_MENU_CARD_TEXT_MAX_SCALE,
  GRID_MENU_CARD_TEXT_MIN_SCALE,
  getGridMenuCardTextScale,
  getGridMenuCardTitleWidth,
  GridMenuCard,
} from '@/components/GridMenuCard';
import { TextSizeContext } from '@/constants/TextSizeContext';

jest.mock('@/constants/Themes', () => {
  const themes = jest.requireActual('@/constants/Themes');
  return { ...themes, useAppTheme: () => themes.customLightTheme };
});

// Two cards share a row at every text size, so their titles stop growing at
// the default 1.25×, where "Compañerismo" still fits a card (#387).
describe('grid menu card text size', () => {
  it.each([
    // app, phone, card text
    [1.25, 1, 1.25],
    [1, 1.2, 1.2],
    [1, 0.85, 0.85],
    [1.25, 1.5, 1.25],
    [1, 3.1, 1.25],
    [1.6, 2, 1.25],
    [2, 1, 1.25],
  ] as const)('scales card text to %s× app and %s× phone as %s×', (textScale, fontScale, scale) => {
    expect(getGridMenuCardTextScale(textScale, fontScale)).toBeCloseTo(scale, 5);
    expect(getGridMenuCardTextScale(textScale, fontScale)).toBeLessThanOrEqual(
      GRID_MENU_CARD_TEXT_MAX_SCALE,
    );
  });

  it('holds the title and subtitle to the cap at 200% app and 200% phone text', async () => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      fontScale: 2,
      height: 915,
      scale: 2.625,
      width: 412,
    });
    const view = await render(
      React.createElement(
        TextSizeContext.Provider,
        { value: { setTextScale: jest.fn(async () => {}), textScale: 2 } },
        React.createElement(GridMenuCard, {
          color: '#eeeeee',
          icon: 'video',
          subtitle: 'Live now',
          title: 'Watch Livestream',
        }),
      ),
    );

    const title = view.getByText('Watch Livestream');
    expect(StyleSheet.flatten(title.props.style).fontSize).toBeCloseTo(18.75, 5);
    // The card applies the phone's size itself, so React Native mustn't again.
    expect(title.props.allowFontScaling).toBe(false);
    const subtitle = view.getByText('Live now');
    expect(StyleSheet.flatten(subtitle.props.style).fontSize).toBeCloseTo(15, 5);
    expect(subtitle.props.allowFontScaling).toBe(false);
  });

  // A card on a 375-point iPhone is 168 points wide, leaving its title 117; at
  // 125%, Android's "Denomination" was 117 points and broke (#324).
  it('shrinks the text only as far as keeps the widest word whole', () => {
    expect(getGridMenuCardTitleWidth(168)).toBeCloseTo(117, 5);
    expect(fitGridMenuCardTextScale(1.25, 168, 117)).toBeCloseTo((1.25 * 115) / 117, 5);
    // A wider card, or no measurement yet, keeps the size.
    expect(fitGridMenuCardTextScale(1.25, 200, 117)).toBe(1.25);
    expect(fitGridMenuCardTextScale(1.25, 0, 117)).toBe(1.25);
    expect(fitGridMenuCardTextScale(1.25, 168, 0)).toBe(1.25);
    // Never below 80%, even in a very narrow window.
    expect(fitGridMenuCardTextScale(1.25, 140, 200)).toBe(GRID_MENU_CARD_TEXT_MIN_SCALE);
  });

  it("measures the grid's words and shrinks every card to the widest one", async () => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      fontScale: 1,
      height: 667,
      scale: 2,
      width: 375,
    });
    const fitTitles = ['About Denomination', 'Locations & History'];
    const view = await render(
      React.createElement(
        TextSizeContext.Provider,
        { value: { setTextScale: jest.fn(async () => {}), textScale: 1.25 } },
        React.createElement(GridMenuCard, {
          color: '#eeeeee',
          fitTitles,
          icon: 'cross',
          onPress: jest.fn(),
          title: 'Locations & History',
        }),
      ),
    );
    const titleSize = () => StyleSheet.flatten(view.getByText('Locations & History').props.style).fontSize;
    expect(titleSize()).toBeCloseTo(18.75, 5);

    // Every word of the grid's titles, one a line, measured at the capped size.
    // Hidden from screen readers, so the query must ask for hidden elements.
    const measure = view.getByTestId('grid-menu-card-word-measure', { includeHiddenElements: true });
    expect(measure.props.children).toBe(['About', 'Denomination', 'Locations', '&', 'History'].join('\n'));
    await fireEvent(view.getByRole('button'), 'layout', { nativeEvent: { layout: { height: 200, width: 168, x: 0, y: 0 } } });
    await fireEvent(measure, 'textLayout', { nativeEvent: { lines: [{ width: 52 }, { width: 117 }, { width: 80 }] } });

    // Font sizes are rounded to hundredths.
    expect(titleSize()).toBeCloseTo(15 * ((1.25 * 115) / 117), 2);
  });
});
