export const TEXT_SCALE_STORAGE_KEY = 'user-text-scale';
export const TEXT_SCALE_MIN = 1;
export const TEXT_SCALE_MAX = 2;
export const TEXT_SCALE_STEP = 0.05;
export const TEXT_SCALE_OPTIONS = [1, 1.25, 1.5, 2] as const;

/**
 * Fixed Bible-reader controls share a small mobile viewport with the reading
 * area. Keep the app's additional control scaling compact while leaving
 * scripture text and operating-system/browser scaling uncapped.
 */
export const BIBLE_READER_UI_TEXT_SCALE_MAX = 1.3;
export const BOTTOM_TAB_ICON_TEXT_SCALE_MAX = 1.3;

export type TextScale =
  | 1
  | 1.05
  | 1.1
  | 1.15
  | 1.2
  | 1.25
  | 1.3
  | 1.35
  | 1.4
  | 1.45
  | 1.5
  | 1.55
  | 1.6
  | 1.65
  | 1.7
  | 1.75
  | 1.8
  | 1.85
  | 1.9
  | 1.95
  | 2;

export const DEFAULT_TEXT_SCALE: TextScale = 1;

export interface TypographyVariant {
  fontSize?: number;
  lineHeight?: number;
  [key: string]: unknown;
}

export interface TextScaleStorage {
  setItem: (key: string, value: string) => Promise<unknown>;
}

// Native gesture math can introduce small floating-point representation noise.
const TEXT_SCALE_EPSILON = 1e-6;

const snapTextScale = (value: unknown): TextScale | null => {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < TEXT_SCALE_MIN - TEXT_SCALE_EPSILON ||
    value > TEXT_SCALE_MAX + TEXT_SCALE_EPSILON
  ) {
    return null;
  }

  const stepIndex = Math.round((value - TEXT_SCALE_MIN) / TEXT_SCALE_STEP);
  const snapped = Number(
    (TEXT_SCALE_MIN + stepIndex * TEXT_SCALE_STEP).toFixed(2),
  );

  return Math.abs(value - snapped) <= TEXT_SCALE_EPSILON
    ? (snapped as TextScale)
    : null;
};

export const isTextScale = (value: unknown): value is TextScale =>
  snapTextScale(value) !== null;

export const normalizeTextScale = (value: unknown): TextScale =>
  snapTextScale(value) ?? DEFAULT_TEXT_SCALE;

export const parseStoredTextScale = (value: string | null): TextScale => {
  if (value === null || value.trim() === '') return DEFAULT_TEXT_SCALE;
  return normalizeTextScale(Number(value));
};

export const serializeTextScale = (value: unknown): string => {
  const normalized = snapTextScale(value);
  if (normalized === null) {
    throw new TypeError('Text scale must be between 100% and 200% in 5% steps.');
  }
  return String(normalized);
};

/**
 * Saves the preference before invoking the visible-state update. This keeps
 * the current screen and the next launch in agreement when storage fails.
 */
export const persistTextScalePreference = async (
  storage: TextScaleStorage,
  value: unknown,
  onPersisted: (scale: TextScale) => void | Promise<void>,
): Promise<TextScale> => {
  if (!isTextScale(value)) {
    throw new TypeError('Unsupported text scale.');
  }

  const normalized = normalizeTextScale(value);
  await storage.setItem(TEXT_SCALE_STORAGE_KEY, serializeTextScale(normalized));
  await onPersisted(normalized);
  return normalized;
};

export const scaleTypographyMetric = (value: number, scale: TextScale) =>
  Math.round(value * scale * 100) / 100;

export const getBibleReaderUiTextScale = (scale: TextScale): TextScale =>
  Math.min(scale, BIBLE_READER_UI_TEXT_SCALE_MAX) as TextScale;

export const getBottomTabIconTextScale = (scale: TextScale): TextScale =>
  Math.min(scale, BOTTOM_TAB_ICON_TEXT_SCALE_MAX) as TextScale;

export const scaleTypographyRecord = <T extends Record<string, TypographyVariant>>(
  variants: T,
  scale: TextScale,
): T =>
  Object.fromEntries(
    Object.entries(variants).map(([name, variant]) => [
      name,
      {
        ...variant,
        ...(typeof variant.fontSize === 'number'
          ? { fontSize: scaleTypographyMetric(variant.fontSize, scale) }
          : {}),
        ...(typeof variant.lineHeight === 'number'
          ? { lineHeight: scaleTypographyMetric(variant.lineHeight, scale) }
          : {}),
      },
    ]),
  ) as T;
