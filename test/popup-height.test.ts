import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { getPopupMaxHeight, POPUP_MAX_HEIGHT_FRACTION } from '@/styles/PopupStyles';

describe('popup height limits', () => {
  it('are a fraction of the space between the safe areas, in points', () => {
    expect(getPopupMaxHeight(844, { top: 47, bottom: 34 }, 0.9)).toBe(686);
    // An iPhone in landscape: short, with no top or bottom safe area.
    expect(getPopupMaxHeight(390, { top: 0, bottom: 21 }, 0.9)).toBe(332);
    expect(getPopupMaxHeight(100, { top: 60, bottom: 60 }, 0.9)).toBe(0);
  });

  it('are the same for every popup a tap outside closes, at any text size', () => {
    // A fixed share of the screen, so a larger text size scrolls a popup's
    // content instead of growing the popup over the room a thumb needs.
    expect(POPUP_MAX_HEIGHT_FRACTION).toBeLessThanOrEqual(0.7);
    const files = execFileSync('git', ['ls-files', 'app', 'components', 'features'], { encoding: 'utf8' })
      .split('\n')
      .filter((file) => /\.tsx?$/.test(file));
    const ownLimits = files.filter((file) => /usePopupMaxHeight\([^)]/.test(readFileSync(file, 'utf8')));
    // Only the first-launch setup, which can't be closed, sets its own.
    expect(ownLimits).toEqual(['components/InitialSetup.tsx']);
  });

  it('are never percentages, which iOS measures against the popup instead of the screen', () => {
    // Paper's Surface puts maxHeight on an inner view on iOS; use usePopupMaxHeight.
    const files = execFileSync('git', ['ls-files', 'app', 'components', 'styles', 'features'], {
      encoding: 'utf8',
    })
      .split('\n')
      .filter((file) => /\.tsx?$/.test(file));
    for (const file of files) {
      expect(`${file}: ${readFileSync(file, 'utf8').match(/maxHeight: ['"]\d+%['"]/)?.[0] ?? ''}`).toBe(
        `${file}: `,
      );
    }
  });
});
