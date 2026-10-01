import { readFileSync } from 'node:fs';
import {
  getBibleControlsLayout,
  getHeaderFontScale,
  HEADER_MAX_FONT_SCALE,
  shortestTranslationLabel,
} from '@/hooks/useGlobalHeaderHeight';

// The Bible header's translation button shares a row with the icon buttons
// (#376). When the row is tight it gives up its 文A icon first, then the length
// of its names, cut short with "…", and last its language badges, and stacks
// only as a last resort. It used to stack whenever the full button didn't fit,
// as with a back arrow at the app's 150% and 200% text sizes, leaving a wide,
// mostly empty button and a back arrow between the rows.
describe("the Bible header's controls", () => {
  // Room for the translation button: 380 − 2 × (56 + 8) − 12 = 240.
  const phone = { rowWidth: 380, iconButtonCount: 2, iconButtonSize: 56 };
  // The iPhone shot with a back arrow at 200%: the full button needs about 210
  // where about 202 is left; without the icon the full names need about 183.
  const widths = { fullButtonWidth: 210, shortestButtonWithBadgesWidth: 160, shortestButtonWidth: 110 };
  const everything = { stack: false, hideTranslationIcon: false, hideLanguageBadges: false };

  it('show everything when the full button fits', () => {
    expect(getBibleControlsLayout({ ...phone, ...widths })).toEqual(everything);
  });

  it('give up the icon first, keeping the badges and as much of the names as fits', () => {
    expect(getBibleControlsLayout({ ...phone, ...widths, rowWidth: 342 })).toEqual({
      stack: false,
      hideTranslationIcon: true,
      hideLanguageBadges: false,
    });
  });

  it('give up the badges last, once the names are as short as they go', () => {
    // 150 left: too little for the badges with first-letter names (160).
    expect(getBibleControlsLayout({ ...phone, ...widths, rowWidth: 290 })).toEqual({
      stack: false,
      hideTranslationIcon: true,
      hideLanguageBadges: true,
    });
  });

  it('stack, with everything, only when even the names alone overflow', () => {
    expect(getBibleControlsLayout({ ...phone, ...widths, rowWidth: 240 })).toEqual({ ...everything, stack: true });
  });

  it('start on one row, with everything, until the widths are measured', () => {
    expect(getBibleControlsLayout({ ...phone, fullButtonWidth: 0, shortestButtonWithBadgesWidth: 0, shortestButtonWidth: 0 })).toEqual(everything);
    expect(getBibleControlsLayout({ ...phone, ...widths, rowWidth: 0 })).toEqual(everything);
  });

  it('measure the shortest form with each name cut to its first letter', () => {
    expect(shortestTranslationLabel('BSB')).toBe('B…');
    expect(shortestTranslationLabel('RVR09')).toBe('R…');
    expect(shortestTranslationLabel('和合本')).toBe('和…');
    expect(shortestTranslationLabel('K')).toBe('K');
    const header = readFileSync('components/GlobalHeader.tsx', 'utf8');
    expect(header).toContain('{renderTranslationChipContent({})}');
    expect(header).toContain('{renderTranslationChipContent({ shortest: true, withIcon: false })}');
    expect(header).toContain(
      '{renderTranslationChipContent({ shortest: true, withIcon: false, withBadges: false })}',
    );
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
