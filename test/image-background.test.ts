import { execFileSync } from 'node:child_process';
import { render } from '@testing-library/react-native';
import { createElement } from 'react';
import { Image, StyleSheet, Text } from 'react-native';
import { ImageBackground } from '@/components/ImageBackground';

describe('ImageBackground', () => {
  it('draws the image behind its children and fills the whole view', () => {
    const onLayout = jest.fn();
    const style = { paddingTop: 80, borderBottomLeftRadius: 28, overflow: 'hidden' as const };
    const screen = render(
      createElement(
        ImageBackground,
        { source: { uri: 'hero.jpg' }, style, onLayout },
        createElement(Text, null, 'Explore'),
      ),
    );

    const image = screen.UNSAFE_getByType(Image);
    expect(image.props.source).toEqual({ uri: 'hero.jpg' });
    expect(image.props.resizeMode).toBe('cover');
    expect(StyleSheet.flatten(image.props.style)).toEqual({
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
    // The view takes the style and layout callback, so the image is clipped to
    // its corners and a page can measure the whole hero.
    expect(image.parent?.props.style).toBe(style);
    expect(image.parent?.props.onLayout).toBe(onLayout);
    expect(screen.getByText('Explore')).toBeTruthy();
  });

  it("replaces React Native's deprecated ImageBackground everywhere", () => {
    let matches = '';
    try {
      matches = execFileSync(
        'git',
        ['grep', '-nE', 'import \\{[^}]*\\bImageBackground\\b[^}]*\\} from .react-native.', '--', 'app', 'components', 'features'],
        { encoding: 'utf8' },
      );
    } catch {
      // git grep exits with 1 when nothing matches.
    }
    expect(matches).toBe('');
  });
});
