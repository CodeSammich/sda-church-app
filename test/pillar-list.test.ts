import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { StyleSheet } from 'react-native';

import { breakAfterHyphens, PillarList, pillarsFitSideBySide } from '@/components/PillarList';
import type { TextScale } from '@/constants/AppPreferences';
import { renderWithPreferences } from './helpers/render-preferences';

let mockWindow = { fontScale: 1, height: 853, scale: 2, width: 384 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

const ENGLISH = ['Bible-Centered', 'Faith & Love', 'Community'];
const SPANISH = ['Biblia', 'Fe y Amor', 'Comunidad'];
const PILLARS = [
  { title: 'Bible-Centered', icon: 'book-cross' },
  { title: 'Faith & Love', icon: 'heart-flash' },
  { title: 'Community', icon: 'account-group' },
] as const;
// The page's sections sit 16 points in from each side.
const row = (windowWidth: number) => Math.min(windowWidth, 720) - 2 * 16;

describe("About Denomination's pillars (#819)", () => {
  it('may break a label after its hyphen, which Android broke as "Bible-Cente" / "red"', () => {
    expect(breakAfterHyphens('Bible-Centered')).toBe('Bible-\u200bCentered');
    expect(breakAfterHyphens('Faith & Love')).toBe('Faith & Love');
    expect(breakAfterHyphens('以聖經為中心')).toBe('以聖經為中心');
  });

  it.each([
    // 112 points each: Centered fits, as Bible-Centered whole, 116 points, wouldn't.
    ['English at 125% on the 384-point Android phone', ENGLISH, 384, 1.25, true],
    ['English at 150% on a 411-point Pixel', ENGLISH, 411, 1.5, true],
    ['Spanish at 125% on the 384-point Android phone', SPANISH, 384, 1.25, true],
    ['English at 200% on the 384-point Android phone', ENGLISH, 384, 2, false],
    ['Spanish at 200% on the 384-point Android phone', SPANISH, 384, 2, false],
    ['English at 150% in a 320-point iPad window', ENGLISH, 320, 1.5, false],
  ])('sit side by side for %s: %p', (_case, titles, width, scale, sideBySide) => {
    expect(pillarsFitSideBySide(titles as string[], row(width as number), scale as number)).toBe(sideBySide);
  });

  it('draw as plain content, with no card, border, or button, side by side or a row each', async () => {
    for (const [textScale, direction] of [[1.25, 'row'], [2, 'column']] as const) {
      const screen = await renderWithPreferences(createElement(PillarList, { pillars: PILLARS }), {
        textScale: textScale as TextScale,
      });
      const list = screen.getByTestId('pillar-list');
      expect(StyleSheet.flatten(list.props.style)).toMatchObject({ flexDirection: direction });
      expect(screen.getByText('Bible-\u200bCentered')).toBeTruthy();
      expect(screen.queryAllByRole('button')).toHaveLength(0);
      for (const title of ENGLISH) {
        const pillar = screen.getByLabelText(title);
        const style = StyleSheet.flatten(pillar.props.style);
        expect(style.borderWidth).toBeUndefined();
        expect(style.backgroundColor).toBeUndefined();
      }
      screen.unmount();
    }
  });

  it('is what About Denomination shows, no longer bordered cards', () => {
    const page = readFileSync('app/(tabs)/home/about-sda.tsx', 'utf8');
    expect(page).toContain('<PillarList pillars={labels.pillarItems as Pillar[]} />');
    expect(page).not.toMatch(/pillarCard|pillarContainer/);
  });
});
