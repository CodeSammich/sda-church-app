import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { getPopupMaxHeight } from '@/styles/PopupStyles';

describe('popup height limits', () => {
  it('are a fraction of the space between the safe areas, in points', () => {
    expect(getPopupMaxHeight(844, { top: 47, bottom: 34 }, 0.9)).toBe(686);
    // An iPhone in landscape: short, with no top or bottom safe area.
    expect(getPopupMaxHeight(390, { top: 0, bottom: 21 }, 0.9)).toBe(332);
    expect(getPopupMaxHeight(100, { top: 60, bottom: 60 }, 0.9)).toBe(0);
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
