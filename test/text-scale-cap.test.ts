import { readFileSync } from 'node:fs';
import {
  getEffectiveTextScale,
  MAX_COMBINED_TEXT_SCALE,
  TEXT_SCALE_MIN,
} from '@/constants/AppPreferences';

// The app's text size and the phone's multiply. The app at 200% with the
// iPhone's largest text was about 6×: page titles broke mid-word ("Expl").
describe('the combined text size cap', () => {
  it('is just above the iPhone\'s own largest text', () => {
    expect(MAX_COMBINED_TEXT_SCALE).toBe(3.2);
  });

  it('never reduces either setting used on its own', () => {
    // The app's 200% on a phone at its normal size.
    expect(getEffectiveTextScale(2, 1)).toBe(2);
    // The phone's largest text (about 3.1× on an iPhone) with the app at 100%.
    expect(getEffectiveTextScale(1, 3.12)).toBe(TEXT_SCALE_MIN);
    // Even past the cap, the app's part never drops below 100%.
    expect(getEffectiveTextScale(1, 5)).toBe(TEXT_SCALE_MIN);
  });

  it('reduces only the app\'s part when both are large, in 5% steps', () => {
    // Android's largest font (2×): 200% becomes 160%, 3.2× in all.
    expect(getEffectiveTextScale(2, 2)).toBe(1.6);
    // The iPhone's largest (3.12×): 200% becomes 100%.
    expect(getEffectiveTextScale(2, 3.12)).toBe(1);
    // The iPhone's accessibility-large (2×) with 125%: unchanged, 2.5× in all.
    expect(getEffectiveTextScale(1.25, 2)).toBe(1.25);
    // A bad phone value counts as its normal size.
    expect(getEffectiveTextScale(2, Number.NaN)).toBe(2);
  });

  it('draws every screen with the capped size, and shows the chosen one in the settings', () => {
    const root = readFileSync('app/_layout.tsx', 'utf8');
    expect(root).toContain('const effectiveTextScale = getEffectiveTextScale(textScale, systemFontScale);');
    expect(root).toContain('textScale: effectiveTextScale,');
    expect(root).toContain('preferredTextScale: textScale,');
    for (const file of ['components/TextSizeDialog.tsx', 'app/(tabs)/you/index.tsx', 'components/InitialSetup.tsx']) {
      expect(readFileSync(file, 'utf8')).toContain('const textScale = preferredTextScale ?? drawnTextScale;');
    }
  });
});
