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
 * The room a sheet has, in points.
 * - largeHeight: the most of its content a sheet shows, at the large detent.
 * - windowHeight: the height its detents are fractions of.
 * - chrome: the part of a detent's height that isn't content.
 *
 * iOS: detents are fractions of the large detent, and the content fills the
 * sheet (windowHeight = largeHeight, chrome 0). Android: detents are fractions
 * of the sheet's window, the whole screen, and a detent's height includes the
 * drag handle's row and the navigation bar (react-native-screens'
 * FormSheetDetents and FormSheetContainer).
 */
export type SheetFrame = Readonly<{
  largeHeight: number;
  windowHeight: number;
  chrome: number;
}>;

/** Fractions of the screen, ascending. */
export type SheetDetents = readonly number[];

/** The detents before anything is measured: medium, expandable to large. */
export const DEFAULT_SHEET_DETENTS: readonly number[] = [SHEET_MEDIUM, 1];

/** Material's drag handle: a 48-dp row above the content. */
export const ANDROID_DRAG_HANDLE_HEIGHT = 48;

/** An iOS sheet's room, from its large detent's height. */
export const getIosSheetFrame = (largeHeight: number): SheetFrame => ({
  largeHeight,
  windowHeight: largeHeight,
  chrome: 0,
});

/**
 * An Android sheet's room: its window is the screen, the large detent stops
 * at the status bar, and the drag handle and navigation bar take their rows.
 */
export const getAndroidSheetFrame = (
  screenHeight: number,
  insets: Readonly<{ top: number; bottom: number }>,
): SheetFrame => {
  const chrome = ANDROID_DRAG_HANDLE_HEIGHT + insets.bottom;
  return { largeHeight: screenHeight - insets.top - chrome, windowHeight: screenHeight, chrome };
};

/** How much of the sheet's content shows at a detent. */
export const getVisibleSheetHeight = (frame: SheetFrame, fraction: number) =>
  Math.max(0, Math.min(frame.largeHeight, fraction * frame.windowHeight - frame.chrome));

/** The detent that shows `height` of the sheet's content. */
export const getSheetFraction = (frame: SheetFrame, height: number) =>
  (height + frame.chrome) / frame.windowHeight;

// Up to the next thousandth, so the content isn't cut by a rounding.
const roundUp = (fraction: number) => Math.ceil(fraction * 1000) / 1000;

/**
 * A sheet that rests at its content's height has a second detent a hair
 * above it, so it takes the same path as a sheet that opens at half and
 * expands. The native `fitToContents` left Android's sheet shorter than its
 * content when the content grew after opening (Share the App's code, Text
 * size's held height), cutting off the buttons at its foot.
 */
export const SHORT_SHEET_SECOND_DETENT = 0.002;

/**
 * The detents for content `contentHeight` points tall.
 * - Up to about half the screen, or always with `full` (Share the App, Text
 *   size, the narrators, Other Sponsors): the content's height, up to large.
 * - Taller: medium, then the content's height, or large.
 */
export function getSheetDetents(
  contentHeight: number,
  frame: SheetFrame | null,
  { full = false }: Readonly<{ full?: boolean }> = {},
): SheetDetents {
  if (!frame || !(contentHeight > 0) || !(frame.largeHeight > 0) || !(frame.windowHeight > 0)) {
    return DEFAULT_SHEET_DETENTS;
  }
  const fraction = Math.min(1, roundUp(getSheetFraction(frame, Math.min(contentHeight, frame.largeHeight))));
  const top = fraction >= FULL_HEIGHT_SNAP ? 1 : fraction;
  if (full || contentHeight <= getVisibleSheetHeight(frame, SHEET_FIT_LIMIT)) {
    return top >= 1 ? [1] : [top, roundUp(top + SHORT_SHEET_SECOND_DETENT)];
  }
  return [SHEET_MEDIUM, top];
}

/** Whether two sets of detents are the same. */
export const sameSheetDetents = (a: SheetDetents, b: SheetDetents) =>
  a === b || (a.length === b.length && a.every((value, index) => Math.abs(value - b[index]) < 0.0005));
