import { readFileSync } from 'node:fs';
import {
  getBibleControlsLayout,
  getHeaderFontScale,
  HEADER_MAX_FONT_SCALE,
  shortestTranslationLabel,
} from '@/hooks/useGlobalHeaderHeight';

// The Bible header's translation button shares a row with the icon buttons,
// cutting its translation names short with "…" when the row is tight, then
// dropping its 文A icon, and stacks only as a last resort (#376). It used to
// stack whenever the full names didn't fit, as with a back arrow at the app's
// 150% and 200% text sizes, leaving a wide, mostly empty button and a back
// arrow between the rows.
describe("the Bible header's controls", () => {
  // Room for the translation button: 380 − 2 × (56 + 8) − 12 = 240.
  const phone = { rowWidth: 380, iconButtonCount: 2, iconButtonSize: 56 };
  const oneRow = { stack: false, hideTranslationIcon: false };

  it('share one row, with the icon, when the shortest button fits', () => {
    expect(
      getBibleControlsLayout({ ...phone, shortestButtonWidth: 212, shortestButtonWidthWithoutIcon: 185 }),
    ).toEqual(oneRow);
  });

  it('drop the icon only when the shortest button with it would overflow', () => {
    // A Pixel 9a with a back arrow at 150% or 200%: about 200 left for the
    // button, whose shortest form needs about 206 with the icon, 179 without.
    expect(
      getBibleControlsLayout({ ...phone, rowWidth: 332, shortestButtonWidth: 206, shortestButtonWidthWithoutIcon: 179 }),
    ).toEqual({ stack: false, hideTranslationIcon: true });
  });

  it('stack, with the icon, only when even the shortest button without it overflows', () => {
    expect(
      getBibleControlsLayout({ ...phone, rowWidth: 300, shortestButtonWidth: 206, shortestButtonWidthWithoutIcon: 179 }),
    ).toEqual({ stack: true, hideTranslationIcon: false });
  });

  it('start on one row, with the icon, until the widths are measured', () => {
    expect(getBibleControlsLayout({ ...phone, shortestButtonWidth: 0, shortestButtonWidthWithoutIcon: 0 })).toEqual(oneRow);
    expect(
      getBibleControlsLayout({ ...phone, rowWidth: 0, shortestButtonWidth: 500, shortestButtonWidthWithoutIcon: 450 }),
    ).toEqual(oneRow);
  });

  it('measure the shortest form with each name cut to its first letter', () => {
    expect(shortestTranslationLabel('BSB')).toBe('B…');
    expect(shortestTranslationLabel('RVR09')).toBe('R…');
    expect(shortestTranslationLabel('和合本')).toBe('和…');
    expect(shortestTranslationLabel('K')).toBe('K');
    const header = readFileSync('components/GlobalHeader.tsx', 'utf8');
    expect(header).toContain('{renderTranslationChipContent(true)}');
    expect(header).toContain('{renderTranslationChipContent(true, false)}');
    expect(header).not.toMatch(/translationChip: \{[^}]*maxWidth: 240/);
  });

  it('are reported only by the header that shows them', () => {
    // Every tab's header stays mounted and sees the Bible's route while it's
    // open; one without the controls must not overwrite the Bible header's report.
    const header = readFileSync('components/GlobalHeader.tsx', 'utf8');
    expect(header).toContain('if (isBiblePage && bibleTranslation) setBibleControlsStacked(stackBibleControls);');
  });
});

// At the iPhone's accessibility text sizes, the translation button used to fill
// a row of its own with oversized text, and the icon buttons beside it swelled
// around small icons. The header now follows the system text size only up to the
// largest standard size, as Apple's own bars do.
describe("the header's system text size", () => {
  it('follows the phone up to the largest standard size, then stops', () => {
    expect(getHeaderFontScale(1)).toBe(1);
    expect(getHeaderFontScale(1.235)).toBe(1.235); // XXL
    expect(getHeaderFontScale(2.353)).toBe(HEADER_MAX_FONT_SCALE); // Accessibility Large
    expect(getHeaderFontScale(3.118)).toBe(HEADER_MAX_FONT_SCALE); // the largest
  });

  it('never shrinks below the default, or breaks on a bad value', () => {
    expect(getHeaderFontScale(0.82)).toBe(1);
    expect(getHeaderFontScale(Number.NaN)).toBe(1);
  });

  it('caps every text in the header, so its height matches what it draws', () => {
    const header = readFileSync('components/GlobalHeader.tsx', 'utf8');
    const texts = header.match(/<Text\n/g) || [];
    const capped = header.match(/<Text\n\s+maxFontSizeMultiplier=\{HEADER_MAX_FONT_SCALE\}/g) || [];
    expect(texts.length).toBeGreaterThan(0);
    expect(capped).toHaveLength(texts.length);
    expect(header).toMatch(/<Searchbar\n\s+ref=\{searchRef\}\n\s+maxFontSizeMultiplier=\{HEADER_MAX_FONT_SCALE\}/);
    expect(header).toContain('getHeaderFontScale(fontScale) * headerTextScale');
  });
});
