import { readFileSync } from 'node:fs';
import { labelsFitSideBySide, labelWordsFit } from '@/components/WrappingActionButton';
import { getContentWidth } from '@/constants/Layout';

// Home's verse card: 24 points each side, the buttons' row 16 more, and 12
// between the two buttons.
const heroRow = (windowWidth: number, scale: number) => getContentWidth(windowWidth, scale) - 2 * 24 - 2 * 16;

describe("the verse card's buttons (#385, #324)", () => {
  it('fit a label only where its longest word fits on one line of the button', () => {
    // Measured in the web build: "Share" is 58 points wide at 150%, and a
    // 114-point button leaves 50 for its label.
    expect(labelWordsFit('Share Verse', 114, 1.5)).toBe(false);
    expect(labelWordsFit('Share Verse', 142, 1.5)).toBe(true);
    // "Compartir" is 84 points at 125%, more than a 142-point button's 78.
    expect(labelWordsFit('Compartir', 142, 1.25)).toBe(false);
    expect(labelWordsFit('Compartir', 174, 1.25)).toBe(true);
    // Chinese can break between any two characters.
    expect(labelWordsFit('分享經文', 114, 2)).toBe(true);
  });

  it.each([
    ['English at 150% in a 320-point iPad window', ['Share Verse', 'Read Verse'], 320, 1.5, false],
    ['English at 150% on a 375-point iPhone', ['Share Verse', 'Read Verse'], 375, 1.5, true],
    ['English at 175% on a 375-point iPhone', ['Share Verse', 'Read Verse'], 375, 1.75, true],
    ['Spanish at 125% on a 375-point iPhone', ['Compartir', 'Leer Versículo'], 375, 1.25, false],
    ['Spanish at 125% on a 440-point iPhone', ['Compartir', 'Leer Versículo'], 440, 1.25, true],
    ['Spanish at 150% on a 402-point iPhone', ['Compartir', 'Leer Versículo'], 402, 1.5, false],
    ['Chinese at 150% in a 320-point iPad window', ['分享經文', '查閱經文'], 320, 1.5, true],
    ['English at 150% on the 13-inch iPad, in the content column', ['Share Verse', 'Read Verse'], 1032, 1.5, true],
  ])('sit side by side for %s: %p', (_case, labels, width, scale, sideBySide) => {
    expect(labelsFitSideBySide(labels as string[], heroRow(width as number, scale as number), 12, scale as number)).toBe(
      sideBySide,
    );
  });

  it('stack on Home wherever they would not fit side by side, as well as at 2× text', () => {
    const home = readFileSync('app/(tabs)/index.tsx', 'utf8');
    expect(home).toMatch(/stackHeroActions =\s*effectiveTextScale >= 2 \|\|\s*!labelsFitSideBySide\(/);
    expect(home).toMatch(/HERO_SIDE_PADDING = 24;\s*const HERO_ACTIONS_PADDING = 16;\s*const HERO_ACTIONS_GAP = 12;/);
  });
});

describe("the Sabbath countdown's card (#593)", () => {
  const home = readFileSync('app/(tabs)/index.tsx', 'utf8');

  it('shows three lines, what it counts to, the timer, and the place, with no date', () => {
    const card = home.slice(home.indexOf('{/* Sabbath Countdown Widget */}'), home.indexOf('<View style={styles.grid}>'));
    expect(card.indexOf('labels.sabbathEnds : labels.sabbathStarts')).toBeLessThan(card.indexOf("countdown || '--:--:--'"));
    expect(card.indexOf("countdown || '--:--:--'")).toBeLessThan(card.indexOf('labels.locationDefault'));
    // The timer always has its own line, so nothing measures whether it fits
    // beside the words, and the date is gone: the timer already says when.
    expect(home).not.toMatch(/countdownFitsBeside|formatDisplayDate|timerRow|isSabbath:/);
  });

  it('says during the Sabbath that it counts to its end, in every language', () => {
    for (const label of ["sabbathEnds: 'Sabbath ends in'", "sabbathEnds: '距離安息日結束還有'", "sabbathEnds: '距离安息日结束还有'", "sabbathEnds: 'El Sábado termina en'"]) {
      expect(home).toContain(label);
    }
  });
});
