import { readFileSync } from 'node:fs';
import { countdownFitsBeside, labelsFitSideBySide, labelWordsFit } from '@/components/WrappingActionButton';
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

describe("the Sabbath countdown's card (#324)", () => {
  const spanish = ['El Sábado comienza en', 'viernes, 6 de noviembre', 'New York, NY'];
  const english = ['Sabbath starts in', 'Friday, November 6th', 'New York, NY'];
  const chinese = ['距離安息日還有', '11月6日 星期五', '紐約'];

  it.each([
    // The user: keep the timer on the right, as before #593, with the label
    // wrapping between words beside it.
    ['Spanish at 125% on a 375-point iPhone', spanish, 375, 1.25, true],
    ['English at 125% on a 375-point iPhone', english, 375, 1.25, true],
    ['Spanish at 150% on the 384-point Android phone', spanish, 384, 1.5, true],
    ['Spanish at 170% on a 375-point iPhone', spanish, 375, 1.7, true],
    ['English at 200% on a 440-point iPhone', english, 440, 2, true],
    ['Chinese at 150% on a 375-point iPhone', chinese, 375, 1.5, true],
    ['Spanish at 150% on the 13-inch iPad', spanish, 1032, 1.5, true],
    // Only where a word couldn't fit whole beside it does the timer go below.
    ['Spanish at 200% on a 375-point iPhone', spanish, 375, 2, false],
    ['English at 200% on a 375-point iPhone', english, 375, 2, false],
    ['Chinese at 200% on a 375-point iPhone, four characters wide', chinese, 375, 2, false],
    ['English at 150% in a 320-point iPad window', english, 320, 1.5, false],
    ["the iPhone's largest text, 3.2×, on a 440-point iPhone", english, 440, 3.2, false],
  ])('keeps the timer beside its words for %s: %p', (_case, texts, width, scale, beside) => {
    expect(
      countdownFitsBeside(texts as string[], getContentWidth(width as number, scale as number), scale as number),
    ).toBe(beside);
  });

  it("stacks on its own rule, not the verse buttons'", () => {
    const home = readFileSync('app/(tabs)/index.tsx', 'utf8');
    expect(home).toMatch(/const stackCountdown = !countdownFitsBeside\(/);
    for (const style of ['timerRowStacked', 'labelColumnStacked', 'timerValueStacked']) {
      expect(home).toContain(`stackCountdown && styles.${style}`);
      expect(home).not.toContain(`stackHeroActions && styles.${style}`);
    }
    // Home's 20-point page margins, as countdownFitsBeside counts them.
    expect(home).toMatch(/content: \{\s*\.\.\.contentColumnStyle\(effectiveTextScale\),\s*padding: 20,/);
  });
});
