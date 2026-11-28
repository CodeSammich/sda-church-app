/**
 * Where a bottom sheet rests (its detents), worked out from how tall its
 * content is (#867). Kept apart from AppSheet so the arithmetic can be tested
 * without a native sheet.
 *
 * A sheet sizes to its content up to about half the screen. Taller content
 * opens at half (medium) and expands to its own height, or to full height
 * (large), as Apple's and Google's guidance suggests: Apple's
 * [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)
 * ("consider supporting the medium detent to allow progressive disclosure").
 */

/** About half the screen: Apple's medium detent. */
export const SHEET_MEDIUM = 0.5;

/**
 * Content up to this much of the screen fits in one detent of its own height.
 * A little over half, so a sheet barely taller than half isn't given a second
 * detent only a few points higher.
 */
export const SHEET_FIT_LIMIT = 0.58;

/** A top detent this close to full height is full height. */
const FULL_HEIGHT_SNAP = 0.97;

export type SheetPlatform = 'ios' | 'android';

/**
 * The room a sheet has, measured from the sheet itself.
 * - largeHeight: the height of the sheet's React content at the large detent.
 * - windowHeight: Android's window height, which its detents are fractions
 *   of. On iOS, detents are fractions of the large detent itself.
 */
export type SheetFrame = Readonly<{
  platform: SheetPlatform;
  largeHeight: number;
  windowHeight: number;
}>;

/** One detent sized to the content, or fractions of the screen. */
export type SheetDetents = 'fitToContents' | readonly number[];

/** The detents before anything is measured: medium, expandable to large. */
export const DEFAULT_SHEET_DETENTS: readonly number[] = [SHEET_MEDIUM, 1];

/**
 * How much of the sheet's content shows at a detent.
 *
 * Android keeps the sheet's content at its large height and slides the sheet
 * down to rest lower (react-native-screens' FormSheetDimensionsCoordinator), so
 * less of it shows by the detent's share of the window. iOS resizes the
 * content to the detent.
 */
export const getVisibleSheetHeight = (frame: SheetFrame, fraction: number) =>
  frame.platform === 'android'
    ? Math.max(0, frame.largeHeight - (1 - fraction) * frame.windowHeight)
    : Math.max(0, fraction * frame.largeHeight);

/** The detent that shows `height` of the sheet's content. */
export const getSheetFraction = (frame: SheetFrame, height: number) =>
  frame.platform === 'android'
    ? 1 - (frame.largeHeight - height) / frame.windowHeight
    : height / frame.largeHeight;

/**
 * Works out the frame from the sheet's content as measured at a detent:
 * `measured` is the content's height at `fraction` on iOS, and on Android
 * the height it's given at the largest detent, `fraction`.
 */
export const getSheetLargeHeight = (
  platform: SheetPlatform,
  measured: number,
  fraction: number,
  windowHeight: number,
) => (platform === 'android' ? measured + (1 - fraction) * windowHeight : measured / fraction);

// Up to the next thousandth, so the content isn't cut by a rounding.
const roundUp = (fraction: number) => Math.ceil(fraction * 1000) / 1000;

type DetentOptions = Readonly<{
  /**
   * Numbers only, never `fitToContents`, which follows the content as it
   * changes. Text size keeps the height it opened at (#867).
   */
  fixed?: boolean;
  /** Open at the content's full height, up to large, as Share the App does for its code. */
  full?: boolean;
}>;

/**
 * The detents for content `contentHeight` points tall.
 * - Up to about half the screen: one detent, the content's height.
 * - Taller: medium, then the content's height, or large.
 */
export function getSheetDetents(
  contentHeight: number,
  frame: SheetFrame | null,
  { fixed = false, full = false }: DetentOptions = {},
): SheetDetents {
  if (!frame || !(contentHeight > 0) || !(frame.largeHeight > 0) || !(frame.windowHeight > 0)) {
    return DEFAULT_SHEET_DETENTS;
  }
  const fraction = roundUp(getSheetFraction(frame, contentHeight));
  const top = fraction >= FULL_HEIGHT_SNAP ? 1 : Math.max(0.05, fraction);
  if (full || contentHeight <= getVisibleSheetHeight(frame, SHEET_FIT_LIMIT)) {
    return fixed ? [Math.min(1, top)] : 'fitToContents';
  }
  return [SHEET_MEDIUM, Math.min(1, top)];
}

/** Whether two sets of detents are the same. */
export const sameSheetDetents = (a: SheetDetents, b: SheetDetents) =>
  a === b ||
  (Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((value, index) => Math.abs(value - b[index]) < 0.001));
