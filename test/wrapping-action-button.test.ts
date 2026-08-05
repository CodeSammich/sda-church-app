import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { StyleSheet } from 'react-native';

import { WrappingActionButton } from '@/components/WrappingActionButton';
import { TextSizeContext } from '@/constants/TextSizeContext';

jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => {
  const React = require('react');
  const MockIcon = (props: { name: string }) =>
    React.createElement('MockIcon', { ...props, testID: `icon-${props.name}` });
  MockIcon.glyphMap = {};
  return MockIcon;
});

describe('wrapping text action button', () => {
  it('keeps its full label and one hit target at 200% app and OS text', () => {
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
        React.createElement(WrappingActionButton, {
          borderColor: '#ffffff',
          icon: 'share-variant',
          label: 'Share Verse Without Truncation',
          onPress,
          textColor: '#ffffff',
        }),
      ),
    );

    expect(view.getAllByRole('button')).toHaveLength(1);
    const button = view.getByLabelText('Share Verse Without Truncation');
    expect(view.getByText('Share Verse Without Truncation').props.numberOfLines).toBeUndefined();
    expect(StyleSheet.flatten(button.props.style).minHeight).toBe(116);
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
