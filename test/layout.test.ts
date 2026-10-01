import {
  DESIGN_TOKENS,
  getBottomTabContentHeight,
  getGlobalHeaderContentHeight,
} from '@/constants/Layout';
import { readFileSync } from 'node:fs';
import { getBottomTabTextScale, HEADER_MAX_FONT_SCALE } from '@/hooks/useGlobalHeaderHeight';

describe('responsive bottom-tab height', () => {
  it('keeps the base height at 100%', () => {
    expect(getBottomTabContentHeight(1)).toBe(
      DESIGN_TOKENS.TAB_BAR_CONTENT_HEIGHT,
    );
  });

  it('adds every measured wrapped line without capping it', () => {
    expect(getBottomTabContentHeight(2, 3)).toBe(
      DESIGN_TOKENS.TAB_BAR_CONTENT_HEIGHT +
        DESIGN_TOKENS.BOTTOM_TAB_LABEL_LINE_HEIGHT +
        DESIGN_TOKENS.BOTTOM_TAB_LABEL_LINE_HEIGHT * 2 * 2,
    );
  });

  it.each([
    { effectiveScale: 3, lines: 4 },
    { effectiveScale: 4, lines: 6 },
  ])(
    'fits all $lines phone tab-label lines at $effectiveScale effective scale',
    ({ effectiveScale, lines }) => {
      const oneLineHeight = getBottomTabContentHeight(effectiveScale, 1);
      expect(getBottomTabContentHeight(effectiveScale, lines)).toBe(
        oneLineHeight +
          DESIGN_TOKENS.BOTTOM_TAB_LABEL_LINE_HEIGHT *
            effectiveScale *
            (lines - 1),
      );
    },
  );

  // At Android's largest font with the app at 200%, the labels were about 40pt
  // and "Explore" wrapped onto a second line (#380).
  it("caps the tab bar's text scale, so it never takes over the screen", () => {
    expect(getBottomTabTextScale(1, 1)).toBe(1);
    expect(getBottomTabTextScale(1.5, 1)).toBe(1.3); // the app's size, up to the icons' cap
    expect(getBottomTabTextScale(1, 2)).toBe(HEADER_MAX_FONT_SCALE); // the phone's, up to the header's
    const largest = getBottomTabTextScale(2, 2);
    expect(largest).toBeCloseTo(1.3 * HEADER_MAX_FONT_SCALE, 5);
    // 69pt tall at most. It used to reach 104pt, and 168pt with a wrapped line.
    expect(getBottomTabContentHeight(largest)).toBe(69);
    expect(getBottomTabContentHeight(2 * 2, 2)).toBe(168);
    expect(getBottomTabTextScale(Number.NaN, Number.NaN)).toBe(1);
  });

  it('keeps every tab label on one line, capped like the header', () => {
    const tabs = readFileSync('app/(tabs)/_layout.tsx', 'utf8');
    const label = tabs.slice(tabs.indexOf('function TabBarLabel'), tabs.indexOf('export default function TabLayout'));
    expect(label).toContain('numberOfLines={1}');
    expect(label).toContain('adjustsFontSizeToFit');
    expect(label).toContain('maxFontSizeMultiplier={HEADER_MAX_FONT_SCALE}');
    expect(tabs).toContain('getBottomTabContentHeight(getBottomTabTextScale(textScale, fontScale))');
    // Everything that sizes around the tab bar uses the same scale.
    for (const file of ['app/_layout.tsx', 'styles/NavigationStyles.ts', 'app/(tabs)/bible/index.tsx']) {
      expect(readFileSync(file, 'utf8')).toContain('getBottomTabContentHeight(getBottomTabTextScale(textScale, ');
    }
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0.5])(
    'uses a safe base scale for %p',
    (scale) => {
      expect(getBottomTabContentHeight(scale)).toBe(
        DESIGN_TOKENS.TAB_BAR_CONTENT_HEIGHT,
      );
    },
  );

  it('grows the global header to fit a two-line title at 200%', () => {
    expect(getGlobalHeaderContentHeight(1)).toBe(
      DESIGN_TOKENS.HEADER_HEIGHT_BASE,
    );
    expect(getGlobalHeaderContentHeight(2)).toBe(88);
  });

  it.each([Number.NaN, Number.NEGATIVE_INFINITY, 0.75])(
    'normalizes invalid global-header scale %p',
    (scale) => {
      expect(getGlobalHeaderContentHeight(scale)).toBe(
        DESIGN_TOKENS.HEADER_HEIGHT_BASE,
      );
    },
  );
});
