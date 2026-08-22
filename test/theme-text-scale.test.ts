import { DEFAULT_TEXT_SCALE } from '@/constants/AppPreferences';
import { getAppTheme } from '@/constants/Themes';

describe('theme text scaling', () => {
  it.each(['headlineMedium', 'titleMedium'] as const)(
    'applies the 125%% default to the %s variant used by the home hero',
    (variant) => {
      const baseline = getAppTheme(false, false, 1).fonts[variant];
      const defaultTheme = getAppTheme(
        false,
        false,
        DEFAULT_TEXT_SCALE,
      ).fonts[variant];

      expect(defaultTheme.fontSize).toBe(
        (baseline.fontSize as number) * DEFAULT_TEXT_SCALE,
      );
      expect(defaultTheme.lineHeight).toBe(
        (baseline.lineHeight as number) * DEFAULT_TEXT_SCALE,
      );
    },
  );

  it('applies the default scale to system fonts used for Chinese', () => {
    const baseline = getAppTheme(false, true, 1).fonts.titleMedium;
    const defaultTheme = getAppTheme(
      false,
      true,
      DEFAULT_TEXT_SCALE,
    ).fonts.titleMedium;

    expect(defaultTheme.fontSize).toBe(
      (baseline.fontSize as number) * DEFAULT_TEXT_SCALE,
    );
    expect(defaultTheme.lineHeight).toBe(
      (baseline.lineHeight as number) * DEFAULT_TEXT_SCALE,
    );
  });
});
