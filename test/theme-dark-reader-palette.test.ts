import { customDarkTheme } from '@/constants/Themes';

const luminance = (hex: string) => {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrastRatio = (foreground: string, background: string) => {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

describe('dark reader palette', () => {
  it('uses the sampled black and metallic-gold range', () => {
    expect(customDarkTheme.colors.background).toBe('#080808');
    expect(customDarkTheme.colors.primary).toBe('#D2B258');
    expect(customDarkTheme.colors.metallicGold).toEqual({
      shadow: '#74612F',
      muted: '#947D3F',
      mid: '#B89C4D',
      main: '#D2B258',
      highlight: '#EBCD78',
    });
    expect(customDarkTheme.gradients.metallicGold).toEqual([
      '#74612F',
      '#D2B258',
      '#EBCD78',
      '#B89C4D',
    ]);
  });

  it('preserves category wayfinding outside the reader palette', () => {
    expect(new Set(Object.values(customDarkTheme.colors.cardBgColors)).size)
      .toBeGreaterThan(2);
    expect(new Set(Object.values(customDarkTheme.colors.iconColors)).size)
      .toBeGreaterThan(2);
    expect(customDarkTheme.colors.cardBgColors.discover).toBe('#25233B');
    expect(customDarkTheme.colors.iconColors.discover).toBe('#AFA8FF');
  });

  it.each([
    ['reading text', customDarkTheme.colors.onBackground, customDarkTheme.colors.background, 7],
    ['surface text', customDarkTheme.colors.onSurface, customDarkTheme.colors.surface, 7],
    ['muted text', customDarkTheme.colors.onSurfaceVariant, customDarkTheme.colors.surface, 4.5],
    ['gold action', customDarkTheme.colors.primary, customDarkTheme.colors.background, 4.5],
    ['action label', customDarkTheme.colors.onPrimary, customDarkTheme.colors.primary, 4.5],
    ['footnote', customDarkTheme.colors.readerColors.footnoteIndicator, customDarkTheme.colors.background, 4.5],
  ])('%s meets its contrast target', (_name, foreground, background, target) => {
    expect(contrastRatio(foreground as string, background as string)).toBeGreaterThanOrEqual(
      target as number,
    );
  });
});
