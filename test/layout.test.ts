import {
  DESIGN_TOKENS,
  getBottomTabContentHeight,
  getMeasuredTextLineCount,
  getGlobalHeaderContentHeight,
} from '@/constants/Layout';

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

  it('derives wrapped label lines from web-supported layout height', () => {
    expect(getMeasuredTextLineCount(66, 32)).toBe(2);
    expect(getMeasuredTextLineCount(98, 32)).toBe(3);
    expect(getMeasuredTextLineCount(Number.NaN, 32)).toBe(1);
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
