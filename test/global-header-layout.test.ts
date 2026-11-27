import { readFileSync } from 'node:fs';
import {
  fitHeaderTitleScale,
  getGlobalHeaderHeightForScale,
  getHeaderTitleFontSize,
  HEADER_TITLE_MIN_SCALE,
} from '@/hooks/useGlobalHeaderHeight';

describe('global header measured-content sizing', () => {
  it('preserves the standard one-line header at 100%', () => {
    expect(getGlobalHeaderHeightForScale(1, false, 40)).toBe(64);
  });

  it('expands to contain a measured title that wraps to three or more lines', () => {
    expect(getGlobalHeaderHeightForScale(4, false, 320)).toBe(336);
    expect(getGlobalHeaderHeightForScale(4, false, 400)).toBe(416);
  });

  it('ignores invalid measured heights', () => {
    expect(getGlobalHeaderHeightForScale(1, false, Number.NaN)).toBe(64);
    expect(getGlobalHeaderHeightForScale(1, false, -100)).toBe(64);
  });
});

describe("a page's title in the header (#797)", () => {
  it('stays whole where it fits, with two points spare', () => {
    expect(fitHeaderTitleScale(180, 198)).toBe(1);
    expect(fitHeaderTitleScale(196, 198)).toBe(1);
  });

  it('shrinks to stay on one line, as 中文讚美詩 — 505 版 beside the search button at 150% on an Android phone', () => {
    // About 226 points at its full size, in 196 points of room.
    const scale = fitHeaderTitleScale(226, 196);
    expect(scale).toBeCloseTo(194 / 226);
    expect(226 * scale).toBeLessThanOrEqual(196 - 2);
  });

  it('shrinks no further than HEADER_TITLE_MIN_SCALE, then wraps between its words', () => {
    expect(HEADER_TITLE_MIN_SCALE).toBe(0.8);
    expect(fitHeaderTitleScale(400, 198)).toBe(HEADER_TITLE_MIN_SCALE);
  });

  it('draws it whole until both it and its room are measured', () => {
    expect(fitHeaderTitleScale(0, 198)).toBe(1);
    expect(fitHeaderTitleScale(226, 0)).toBe(1);
    expect(fitHeaderTitleScale(226, -20)).toBe(1);
    expect(fitHeaderTitleScale(Number.NaN, 198)).toBe(1);
  });

  it('draws a smaller title in whole pixels, rounded down, since Android rounds a size up', () => {
    // 24 points at 0.83 on the 1.875-pixel Android phone: 37.35 pixels, which
    // Android drew at 38, so the title wrapped. 37 pixels fits.
    expect(getHeaderTitleFontSize(24, 0.83, 1.875) * 1.875).toBeCloseTo(37);
    expect(getHeaderTitleFontSize(24, 0.83, 1.875)).toBeLessThanOrEqual(24 * 0.83);
    // Whole, it's left as it is, and so is a size without a pixel ratio.
    expect(getHeaderTitleFontSize(24, 1, 1.875)).toBe(24);
    expect(getHeaderTitleFontSize(24, 0.83, 0)).toBe(24);
    const header = readFileSync('components/GlobalHeader.tsx', 'utf8');
    expect(header).toContain('PixelRatio.get() * getHeaderFontScale(fontScale)');
  });

  it('measures a hidden copy at full size and sizes the shown title from it', () => {
    const header = readFileSync('components/GlobalHeader.tsx', 'utf8');
    expect(header).toContain('setTitleWidth(Math.ceil(event.nativeEvent.layout.width))');
    expect(header).toContain('style={[titleTextStyle(1), styles.titleMeasureText]}');
    expect(header).toContain('style={titleTextStyle(titleScale)}');
    // Its screen reader label is the title itself, without the joiners.
    expect(header).toContain('accessibilityLabel={title}');
  });
});
