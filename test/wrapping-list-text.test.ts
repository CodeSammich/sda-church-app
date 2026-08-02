import React from 'react';
import { render } from '@testing-library/react-native';
import { List, PaperProvider } from 'react-native-paper';

const renderWithPaper = (element: React.ReactElement) =>
  render(React.createElement(PaperProvider, null, element));

describe('uncapped Paper list text', () => {
  it('allows a localized section heading to use every required line', () => {
    const view = renderWithPaper(
      React.createElement(
        List.Subheader,
        {
          children: 'This Week With A Large Accessibility Font',
          numberOfLines: 0,
        },
      ),
    );

    expect(
      view.getByText('This Week With A Large Accessibility Font').props
        .numberOfLines,
    ).toBe(0);
  });

  it('allows both item titles and descriptions to wrap without a line cap', () => {
    const view = renderWithPaper(
      React.createElement(List.Item, {
        description:
          'A complete multilingual description that remains available at large text sizes.',
        descriptionNumberOfLines: 0,
        title: 'A complete multilingual list title',
        titleNumberOfLines: 0,
      }),
    );

    expect(
      view.getByText('A complete multilingual list title').props.numberOfLines,
    ).toBe(0);
    expect(
      view.getByText(
        'A complete multilingual description that remains available at large text sizes.',
      ).props.numberOfLines,
    ).toBe(0);
  });
});
