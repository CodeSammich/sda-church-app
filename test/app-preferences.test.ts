import {
  getBottomTabIconTextScale,
  BIBLE_READER_UI_TEXT_SCALE_MAX,
  DEFAULT_TEXT_SCALE,
  getBibleReaderUiTextScale,
  isTextScale,
  normalizeTextScale,
  parseStoredTextScale,
  scaleTypographyMetric,
  scaleTypographyRecord,
  serializeTextScale,
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  TEXT_SCALE_STEP,
} from '@/constants/AppPreferences';

describe('text scale preferences', () => {
  it('defaults app text to 125%', () => {
    expect(DEFAULT_TEXT_SCALE).toBe(1.25);
  });

  it('caps only the Bible reader chrome at 130%', () => {
    expect(getBibleReaderUiTextScale(1.2)).toBe(1.2);
    expect(getBibleReaderUiTextScale(2)).toBe(
      BIBLE_READER_UI_TEXT_SCALE_MAX,
    );
  });

  it('caps bottom-tab icons while labels keep their full text scale', () => {
    expect(getBottomTabIconTextScale(1.2)).toBe(1.2);
    expect(getBottomTabIconTextScale(2)).toBe(1.3);
  });

  it('accepts every 100%-200% value in exact 5% steps', () => {
    for (let index = 0; index <= 20; index += 1) {
      const value = Number(
        (TEXT_SCALE_MIN + index * TEXT_SCALE_STEP).toFixed(2),
      );
      expect(isTextScale(value)).toBe(true);
      expect(Number(serializeTextScale(value))).toBe(value);
    }
    expect(TEXT_SCALE_MAX).toBe(2);
  });

  it('normalizes native floating-point representation noise', () => {
    expect(normalizeTextScale(1.0499999523162842)).toBe(1.05);
    expect(normalizeTextScale(1.9500000476837158)).toBe(1.95);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0.95, 2.05, 1.01])(
    'rejects invalid scale %p',
    (value) => {
      expect(isTextScale(value)).toBe(false);
      expect(() => serializeTextScale(value)).toThrow(/100% and 200%/);
    },
  );

  it('fails safely to 125% for missing or corrupt stored values', () => {
    expect(parseStoredTextScale(null)).toBe(DEFAULT_TEXT_SCALE);
    expect(parseStoredTextScale('')).toBe(DEFAULT_TEXT_SCALE);
    expect(parseStoredTextScale('not-a-number')).toBe(DEFAULT_TEXT_SCALE);
    expect(parseStoredTextScale('1.75')).toBe(1.75);
  });

  it('scales font metrics without mutating the original typography', () => {
    const variants = {
      body: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 16,
        lineHeight: 24,
      },
    };
    const scaled = scaleTypographyRecord(variants, 1.5);

    expect(scaled.body).toEqual({
      fontFamily: 'PlusJakartaSans-Regular',
      fontSize: 24,
      lineHeight: 36,
    });
    expect(variants.body.fontSize).toBe(16);
    expect(scaleTypographyMetric(13, 1.25)).toBe(16.25);
  });
});
