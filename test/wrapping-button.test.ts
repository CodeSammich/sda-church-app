import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

import { WrappingButton } from '@/components/WrappingButton';
import { TextSizeContext } from '@/constants/TextSizeContext';

jest.mock('@/constants/Themes', () => ({
  useAppTheme: () => ({
    colors: {
      onPrimary: '#ffffff',
      onSecondaryContainer: '#111111',
      outline: '#777777',
      primary: '#0066cc',
      secondaryContainer: '#dddddd',
    },
  }),
}));

jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => {
  const React = require('react');
  const MockIcon = (props: { name: string }) =>
    React.createElement('MockIcon', { ...props, testID: `icon-${props.name}` });
  MockIcon.glyphMap = {};
  return MockIcon;
});

describe('wrapping replacement for Paper buttons', () => {
  it('renders a complete localized label at 4x effective text', () => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      fontScale: 2,
      height: 568,
      scale: 1,
      width: 320,
    });
    const onPress = jest.fn();
    const view = render(
      React.createElement(
        TextSizeContext.Provider,
        {
          value: {
            setTextScale: jest.fn(async () => {}),
            textScale: 2,
          },
        },
        React.createElement(
          WrappingButton,
          {
            children: 'View Latest Bulletin Without Truncation',
            icon: 'file-pdf-box',
            mode: 'contained',
            onPress,
          },
        ),
      ),
    );

    const button = view.getByRole('button', {
      name: 'View Latest Bulletin Without Truncation',
    });
    expect(view.getAllByRole('button')).toHaveLength(1);
    expect(
      view.getByText('View Latest Bulletin Without Truncation').props
        .numberOfLines,
    ).toBeUndefined();
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('supports selected tab semantics for in-page navigation', () => {
    const view = render(
      React.createElement(WrappingButton, {
        accessibilityRole: 'tab',
        accessibilityState: { selected: true },
        children: 'This Week',
        mode: 'contained-tonal',
        onPress: jest.fn(),
      }),
    );

    expect(view.getByRole('tab', { name: 'This Week', selected: true })).toBeTruthy();
  });
});
