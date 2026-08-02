import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { StyleSheet, Text } from 'react-native';

import {
  getGridMenuCardTitleBlockMinHeight,
  GridMenuCard,
} from '@/components/GridMenuCard';
import { MenuCard, MenuCardSwitchVisual } from '@/components/MenuCard';
import { AppIcon } from '@/components/AppIcon';
import { TextSizeContext } from '@/constants/TextSizeContext';

jest.mock('@/constants/Themes', () => ({
  useAppTheme: () => ({
    colors: {
      onSurface: '#111111',
      onSurfaceVariant: '#555555',
      outlineVariant: '#dddddd',
      surface: '#ffffff',
      tertiary: '#0066cc',
    },
  }),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const MockIcon = (props: { name: string }) =>
    React.createElement('MockIcon', {
      ...props,
      testID: `icon-${props.name}`,
    });
  MockIcon.font = {};
  MockIcon.glyphMap = {};
  return { Ionicons: MockIcon, MaterialCommunityIcons: MockIcon };
});

const renderAtScale = (element: React.ReactElement, textScale: 1 | 2) =>
  render(
    React.createElement(
      TextSizeContext.Provider,
      {
        value: {
          setTextScale: jest.fn(async () => {}),
          textScale,
        },
      },
      element,
    ),
  );

describe('menu card press surfaces', () => {
  it('reserves the same two-line text region at every effective scale', () => {
    expect(getGridMenuCardTitleBlockMinHeight(1)).toBe(41);
    expect(getGridMenuCardTitleBlockMinHeight(1.15)).toBe(48);
    expect(getGridMenuCardTitleBlockMinHeight(1.25)).toBe(52);
    expect(getGridMenuCardTitleBlockMinHeight(4)).toBe(164);
  });

  beforeEach(() => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      fontScale: 1,
      height: 640,
      scale: 1,
      width: 320,
    });
  });

  it('routes title and icon presses through one MenuCard hit target', () => {
    const onPress = jest.fn();
    const view = renderAtScale(
      React.createElement(MenuCard, {
        description: 'A private request',
        icon: 'hands-pray',
        onPress,
        rightElement: () => React.createElement(Text, null, 'control'),
        title: 'Prayer',
      }),
      2,
    );

    expect(view.getAllByRole('button')).toHaveLength(1);
    expect(view.getByText('Prayer').parent?.props.pointerEvents).toBe('none');
    expect(view.getByTestId('icon-hands-pray').props.pointerEvents).toBe('none');
    expect(view.getByTestId('icon-hands-pray').props.size).toBe(64);
    expect(view.getByText('control').parent?.props.pointerEvents).toBe('none');

    const card = view.getByLabelText('Prayer. A private request');
    expect(card.props.accessibilityRole).toBe('button');
    fireEvent.press(card);
    expect(onPress).toHaveBeenCalledTimes(1);

    const titleStyle = StyleSheet.flatten(view.getByText('Prayer').props.style);
    expect(titleStyle.fontSize).toBe(36);
    expect(titleStyle.lineHeight).toBe(48);
  });

  it('allows reader UI icons to use a capped text scale', () => {
    const view = renderAtScale(
      React.createElement(AppIcon, {
        name: 'play',
        size: 20,
        textScale: 1.3,
      }),
      2,
    );

    expect(view.getByTestId('icon-play').props.size).toBe(26);
  });

  it('announces a switch card description and checked state', () => {
    const onPress = jest.fn();
    const view = renderAtScale(
      React.createElement(MenuCard, {
        accessibilityRole: 'switch',
        accessibilityState: { checked: true },
        description: 'Toggle between light and dark themes',
        icon: 'theme-light-dark',
        onPress,
        rightElement: () =>
          React.createElement(MenuCardSwitchVisual, {
            active: true,
            activeColor: '#0066cc',
            inactiveColor: '#dddddd',
            thumbColor: '#ffffff',
          }),
        title: 'Dark Mode',
      }),
      1,
    );

    const card = view.getByRole('switch');
    expect(view.getAllByRole('switch')).toHaveLength(1);
    expect(card.props.accessibilityLabel).toBe(
      'Dark Mode. Toggle between light and dark themes',
    );
    expect(card.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true }),
    );
    expect(
      view.getByTestId('menu-card-switch-visual', {
        includeHiddenElements: true,
      }).props.accessible,
    ).toBe(false);
    fireEvent.press(card);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps GridMenuCard content decorative while enlarging its layout', () => {
    const onPress = jest.fn();
    const view = renderAtScale(
      React.createElement(GridMenuCard, {
        color: '#eeeeee',
        icon: 'calendar',
        onPress,
        subtitle: 'Church calendar',
        title: 'Upcoming Events',
      }),
      2,
    );

    expect(view.getAllByRole('button')).toHaveLength(1);
    expect(view.getByText('Upcoming Events').parent?.props.pointerEvents).toBe(
      'none',
    );
    expect(view.getByTestId('icon-arrow-top-right').props.size).toBe(28);
    expect(
      StyleSheet.flatten(view.getByTestId('grid-menu-card-arrow-badge').props.style)
        .width,
    ).toBe(56);

    const card = view.getByLabelText('Upcoming Events. Church calendar');
    expect(card.props.accessibilityLabel).toContain('Church calendar');
    fireEvent.press(card);
    expect(onPress).toHaveBeenCalledTimes(1);

    const buttonStyle = StyleSheet.flatten(
      card.props.style,
    );
    expect(buttonStyle.minHeight).toBeGreaterThan(148);
  });

  it('keeps one uncapped GridMenuCard target at 200% app and 200% OS text', () => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      fontScale: 2,
      height: 568,
      scale: 1,
      width: 320,
    });
    const view = renderAtScale(
      React.createElement(GridMenuCard, {
        color: '#eeeeee',
        icon: 'video',
        onPress: jest.fn(),
        subtitle: 'Livestream status remains fully announced',
        title: 'Watch Livestream',
      }),
      2,
    );

    expect(view.getAllByRole('button')).toHaveLength(1);
    const card = view.getByLabelText(
      'Watch Livestream. Livestream status remains fully announced',
    );
    expect(StyleSheet.flatten(card.props.style).minHeight).toBe(340);
    expect(view.getByText('Watch Livestream').props.numberOfLines).toBeUndefined();
  });
});
