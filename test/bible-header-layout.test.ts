import { readFileSync } from 'node:fs';
import {
  getHeaderFontScale,
  HEADER_MAX_FONT_SCALE,
  shortestTranslationLabel,
  shouldStackBibleControls,
} from '@/hooks/useGlobalHeaderHeight';

// The Bible header's translation button shares a row with the icon buttons,
// cutting its translation names short with "…" when the row is tight (#376). It
// used to stack whenever the full names didn't fit, as with a back arrow at the
// app's 150% and 200% text sizes, leaving a wide, mostly empty button and a back
// arrow between the rows.
describe("the Bible header's controls", () => {
  const phone = { rowWidth: 380, iconButtonCount: 2, iconButtonSize: 56 };

  it('share one row when the shortest translation button fits beside the icon buttons', () => {
    // 212 + 2 × (56 + 8) + 12 = 352, within 380.
    expect(shouldStackBibleControls({ ...phone, translationButtonMinWidth: 212 })).toBe(false);
  });

  it("cut names short rather than stack when only the full names don't fit", () => {
    // The 200% shot with a back arrow: the full button needed about 210 of the
    // 202 left beside the icon buttons, but its shortest form needs far less.
    expect(shouldStackBibleControls({ ...phone, rowWidth: 332, translationButtonMinWidth: 150 })).toBe(false);
  });

  it('stack only when even the shortest translation button would overflow the row', () => {
    expect(shouldStackBibleControls({ ...phone, rowWidth: 330, translationButtonMinWidth: 200 })).toBe(true);
  });

  it('start on one row until both widths are measured', () => {
    expect(shouldStackBibleControls({ ...phone, translationButtonMinWidth: 0 })).toBe(false);
    expect(shouldStackBibleControls({ ...phone, rowWidth: 0, translationButtonMinWidth: 500 })).toBe(false);
  });

  it('measure the shortest form with each name cut to its first letter', () => {
    expect(shortestTranslationLabel('BSB')).toBe('B…');
    expect(shortestTranslationLabel('RVR09')).toBe('R…');
    expect(shortestTranslationLabel('和合本')).toBe('和…');
    expect(shortestTranslationLabel('K')).toBe('K');
    const header = readFileSync('components/GlobalHeader.tsx', 'utf8');
    expect(header).toContain('{renderTranslationChipContent(true)}');
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
