import {
  CONTENT_MAX_WIDTH,
  contentColumnStyle,
  contentColumnWithin,
  DESIGN_TOKENS,
  getBottomTabContentHeight,
  getContentMaxWidth,
  getContentSideInset,
  getContentWidth,
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
    // Not shrink-to-fit: Android ignores its floor and shrank the labels to dots.
    expect(label).not.toContain('adjustsFontSizeToFit={true}');
    expect(label).not.toMatch(/\n\s+adjustsFontSizeToFit\n/);
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

describe('the content column on wide screens (#324)', () => {
  // The widest phone the app supports today, and 13-inch iPad widths: portrait,
  // landscape, and a window beside another app.
  it.each([320, 390, 440])('leaves a %i-point phone its whole width', (width) => {
    expect(getContentWidth(width)).toBe(width);
    expect(getContentSideInset(width)).toBe(0);
    // At every text size.
    expect(getContentWidth(width, 2)).toBe(width);
  });

  it.each([
    { width: 1032, inset: (1032 - CONTENT_MAX_WIDTH) / 2 },
    { width: 1376, inset: (1376 - CONTENT_MAX_WIDTH) / 2 },
    { width: 744, inset: (744 - CONTENT_MAX_WIDTH) / 2 },
  ])('centers the column in a $width-point window', ({ width, inset }) => {
    expect(getContentWidth(width)).toBe(CONTENT_MAX_WIDTH);
    expect(getContentSideInset(width)).toBe(inset);
  });

  it('is wider than every phone, so phone layouts never change', () => {
    expect(CONTENT_MAX_WIDTH).toBeGreaterThan(440);
    expect(contentColumnStyle()).toEqual({
      width: '100%',
      maxWidth: CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    });
  });

  it('widens with the text above the default 125%, so a line holds as many words', () => {
    expect(getContentMaxWidth(1)).toBe(CONTENT_MAX_WIDTH);
    expect(getContentMaxWidth(1.25)).toBe(CONTENT_MAX_WIDTH);
    expect(getContentMaxWidth(1.5)).toBe(864);
    expect(getContentMaxWidth(2)).toBe(1152);
    // At 200%, a 13-inch iPad's whole width in portrait, and most of it in landscape.
    expect(getContentWidth(1032, 2)).toBe(1032);
    expect(getContentSideInset(1376, 2)).toBe((1376 - 1152) / 2);
    expect(contentColumnStyle(1.5).maxWidth).toBe(864);
  });

  it("lines a padded banner's text up with the column below it", () => {
    expect(contentColumnWithin(20)).toEqual({
      width: '100%',
      maxWidth: CONTENT_MAX_WIDTH - 40,
      alignSelf: 'center',
    });
    expect(contentColumnWithin(20, 2).maxWidth).toBe(1152 - 40);
  });
});

describe('popup width on wide screens (#324)', () => {
  const { getPopupWidthStyle, POPUP_MAX_WIDTH } = require('@/styles/PopupStyles');

  it("keeps a phone popup's width", () => {
    // The Bible's popups: the screen less 20-point margins.
    expect(getPopupWidthStyle(390 - 40)).toEqual({ alignSelf: 'center', width: 350 });
    // The dialogs: 90% of the screen.
    expect(getPopupWidthStyle(390 * 0.9)).toEqual({ alignSelf: 'center', width: 351 });
  });

  it('holds popups on a tablet to their widest, as a number Paper applies to the whole popup', () => {
    expect(POPUP_MAX_WIDTH).toBe(560);
    expect(getPopupWidthStyle(1032 - 40).width).toBe(560);
    expect(getPopupWidthStyle(1376 * 0.9).width).toBe(560);
    expect(getPopupWidthStyle(1032 * 0.9, 500).width).toBe(500);
  });

  it("gives no popup a percentage width and a maxWidth, which iOS's Paper Surface splits", () => {
    // Any style in a file with a Paper Dialog or Modal. A plain View, such as
    // the library banner's cover, applies both to one view.
    const { readdirSync, statSync } = require('node:fs');
    const { join } = require('node:path');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (path.endsWith('.tsx')) files.push(path);
      }
    };
    ['app', 'components', 'features'].forEach(walk);
    const popups = files.filter((file) => /<(Dialog|Modal)\b/.test(readFileSync(file, 'utf8')));
    const offenders = popups.flatMap((file) =>
      (readFileSync(file, 'utf8').match(/\{[^{}]*\}/g) || [])
        .filter((style) => /\bwidth: '\d+%'/.test(style) && /\bmaxWidth: \d+/.test(style))
        .map((style) => `${file}: ${style.replace(/\s+/g, ' ')}`),
    );
    expect(offenders).toEqual([]);
    expect(popups.length).toBeGreaterThanOrEqual(8);
  });
});

describe('the column follows the app text size and the device text size (#324)', () => {
  it('multiplies them, since the app holds their product to a cap', () => {
    const source = readFileSync('hooks/useContentColumnScale.ts', 'utf8');
    expect(source).toContain('return textScale * (');
    // With the iPad's largest text, the app draws its own text near 100%, yet the
    // text is 3.2× and the column has to be as wide as the screen.
    expect(getContentWidth(1032, 1.03 * 3.1)).toBe(1032);
  });

  it('gives Bible text margins on a tablet, not a phone', () => {
    const bible = readFileSync('app/(tabs)/bible/index.tsx', 'utf8');
    expect(bible).toContain('viewportWidth > CONTENT_MAX_WIDTH ? { paddingLeft: 24, paddingRight: 24 } : null');
    expect(bible).toContain('const columnScale = textScale * osFontScale;');
  });
});
