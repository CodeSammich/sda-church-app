import { act } from '@testing-library/react-native';
import { createElement } from 'react';
import { StyleSheet } from 'react-native';

import { LibraryFeaturedCarousel } from '@/components/LibraryFeaturedCarousel';
import { customLightTheme } from '@/constants/Themes';
import { renderWithPreferences } from './helpers/render-preferences';

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

const flatStyle = (node: any) => StyleSheet.flatten(node?.props?.style) ?? {};

// The nearest element, from a page dot up, that a style puts in place.
const absoluteAncestor = (node: any) => {
  let current = node;
  while (current && flatStyle(current).position !== 'absolute') current = current.parent;
  return current;
};

// The carousel's own view, which measures the banner's width.
const layOut = async (node: any) => {
  let current = node;
  while (current && typeof current.props?.onLayout !== 'function') current = current.parent;
  await act(() =>
    current.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 500 } } }),
  );
};

// Works with both render APIs: awaiting a plain result returns it unchanged.
const renderCarousel = async () =>
  await renderWithPreferences(
    createElement(LibraryFeaturedCarousel, {
      books: ['a', 'b', 'c'].map((key) => ({ key, title: `Book ${key}`, author: 'A. Writer' })),
      featuredLabel: 'Featured',
      nextLabel: 'Next featured book',
      pageLabel: (page: number, count: number) => `Featured book ${page} of ${count}`,
      previousLabel: 'Previous featured book',
    }),
    { theme: customLightTheme },
  );

describe('the featured carousel page dots', () => {
  it('sit inside the banner, along its bottom edge, once it is laid out', async () => {
    const view = await renderCarousel();
    const dots = absoluteAncestor(view.getByLabelText('Featured book 1 of 3'));
    expect(flatStyle(dots)).toMatchObject({ bottom: 16, left: 0, right: 0, opacity: 0 });

    await layOut(dots);
    expect(flatStyle(absoluteAncestor(view.getByLabelText('Featured book 1 of 3'))).opacity).toBeUndefined();
  });

  it('are light on the darkened cover, with the shown page brightest', async () => {
    const view = await renderCarousel();
    const dot = (page: number) => {
      const button = view.getByLabelText(`Featured book ${page} of 3`);
      let current: any = button;
      while (current && flatStyle(current).height !== 8) current = current.children?.[0];
      return flatStyle(current);
    };
    expect(dot(1)).toMatchObject({ backgroundColor: '#ffffff', width: 20 });
    expect(dot(2)).toMatchObject({ backgroundColor: 'rgba(255, 255, 255, 0.45)', width: 8 });
  });

  it("keep the page's content clear of them", async () => {
    const view = await renderCarousel();
    const dots = absoluteAncestor(view.getByLabelText('Featured book 1 of 3'));
    await layOut(dots);
    // 16 above the edge, 8 tall, and 20 between them and the content.
    expect(flatStyle(view.getByLabelText('Featured: Book a. A. Writer')).paddingBottom).toBe(44);
  });
});
