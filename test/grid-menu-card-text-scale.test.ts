import React from 'react';
import { render } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { StyleSheet } from 'react-native';

import {
  GRID_MENU_CARD_TEXT_MAX_SCALE,
  getGridMenuCardTextScale,
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

  it('holds the title and subtitle to the cap at 200% app and 200% phone text', () => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      fontScale: 2,
      height: 915,
      scale: 2.625,
      width: 412,
    });
    const view = render(
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
});
