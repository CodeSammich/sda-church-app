import { DEFAULT_TEXT_SCALE } from '@/constants/AppPreferences';

/**
 * Centralized layout constants to ensure consistency across the "Digital Sanctuary".
 * Based on UI_UX.md standards.
 */

export const DESIGN_TOKENS = {
  // Material 3 Appbar height is 64dp (Small/Center-aligned variant).
  // Ref: https://m3.material.io/components/top-app-bar/specs
  // Note: While iOS HIG traditionally uses 44pt for navigation bars, react-native-paper
  // implements MD3 standards (64dp) across both platforms for layout consistency.
  HEADER_HEIGHT_BASE: 64,
  // Used for the "Glass Rule" 0.5px borders
  BORDER_WEIGHT: 0.5,
  // Standard gutter for containers and card spacing
  VIEW_PADDING: 16,
  /**
   * Icon sizes following Material Design 3 specifications.
   * Ref: https://m3.material.io/styles/icons/applying-icons#694df220-3129-4556-9e67-ed3f58a361f1
   */
  ICON_SIZE_STANDARD: 24,
  ICON_SIZE_FEATURED: 32,
  // Specific project standard for bottom tab bar visibility
  ICON_SIZE_TAB: 28,
  // Leaves enough vertical room for CJK glyph metrics below the tab icons.
  TAB_BAR_CONTENT_HEIGHT: 56,
  BOTTOM_TAB_LABEL_FONT_SIZE: 10,
  BOTTOM_TAB_LABEL_LINE_HEIGHT: 16,
  BOTTOM_TAB_LABEL_BOTTOM_PADDING: 2,
  // Dimension for timeline markers in the History section
  TIMELINE_CIRCLE_SIZE: 50,
};

/**
 * The widest a page's content grows on a wide screen, at the app's default
 * text size: an iPad, an Android tablet, an unfolded foldable, or a desktop
 * browser (#324). Wider, it stays this wide and centered, so lines of text
 * stay a comfortable length to read and a page's cards and buttons stay near
 * each other. Banner images, the header, and the tab bar still span the
 * screen. Phones are narrower than this, so it never changes their layout.
 */
export const CONTENT_MAX_WIDTH = 720;

/**
 * How wide the content column may grow at the app's text size:
 * CONTENT_MAX_WIDTH at the default 125% or smaller, and wider in proportion
 * above it, so a line holds about as many words at 200% as at 125%, rather
 * than wrapping a verse's every line on a screen with room to spare.
 */
export const getContentMaxWidth = (textScale: number = DEFAULT_TEXT_SCALE) =>
  Math.round(CONTENT_MAX_WIDTH * Math.max(1, (Number.isFinite(textScale) ? textScale : 1) / DEFAULT_TEXT_SCALE));

/** The centered content column, for a page's content below its banner. */
export const contentColumnStyle = (textScale: number = DEFAULT_TEXT_SCALE) => ({
  width: '100%' as const,
  maxWidth: getContentMaxWidth(textScale),
  alignSelf: 'center' as const,
});

/**
 * The content column inside a full-width box with this much padding on each
 * side, such as a banner's title, so it lines up with the column below.
 */
export const contentColumnWithin = (sidePadding: number, textScale: number = DEFAULT_TEXT_SCALE) => ({
  width: '100%' as const,
  maxWidth: getContentMaxWidth(textScale) - 2 * sidePadding,
  alignSelf: 'center' as const,
});

/** How wide a page's content is in a window this wide. */
export const getContentWidth = (windowWidth: number, textScale: number = DEFAULT_TEXT_SCALE) =>
  Math.min(windowWidth, getContentMaxWidth(textScale));

/**
 * The side padding that keeps a full-width row's contents, such as the tab
 * bar's buttons, within the content column.
 */
export const getContentSideInset = (windowWidth: number, textScale: number = DEFAULT_TEXT_SCALE) =>
  Math.max(0, (windowWidth - getContentMaxWidth(textScale)) / 2);

export const getBottomTabContentHeight = (
  effectiveTextScale: number,
  labelLineCount = 1,
) => {
  const safeScale = Number.isFinite(effectiveTextScale)
    ? Math.max(1, effectiveTextScale)
    : 1;
  const safeLineCount = Number.isFinite(labelLineCount)
    ? Math.max(1, Math.ceil(labelLineCount))
    : 1;
  const labelGrowth =
    DESIGN_TOKENS.BOTTOM_TAB_LABEL_LINE_HEIGHT * (safeScale - 1);
  const wrappedLabelLines =
    DESIGN_TOKENS.BOTTOM_TAB_LABEL_LINE_HEIGHT *
    safeScale *
    (safeLineCount - 1);
  return Math.ceil(
    DESIGN_TOKENS.TAB_BAR_CONTENT_HEIGHT + labelGrowth + wrappedLabelLines,
  );
};

export const getGlobalHeaderContentHeight = (effectiveTextScale: number) => {
  const safeScale = Number.isFinite(effectiveTextScale)
    ? Math.max(1, effectiveTextScale)
    : 1;
  const compactControlHeight = Math.ceil(44 + (safeScale - 1) * 24);
  const twoLineTitleHeight = Math.ceil(40 * safeScale + 8);

  return Math.max(
    DESIGN_TOKENS.HEADER_HEIGHT_BASE,
    compactControlHeight + 20,
    twoLineTitleHeight,
  );
};

export const shouldUseStackedHomeLayout = (
  windowWidth: number,
  effectiveTextScale: number,
) => {
  const safeScale = Math.max(1, effectiveTextScale);
  // Android can report a small platform font-scale adjustment at its default
  // density. Do not turn that normal device rendering into a single-column
  // layout; stack once text has actually been enlarged by the user.
  return safeScale > 1.15 && (windowWidth - 48) / 2 < 145 * safeScale;
};

export const shouldUseStackedPillarLayout = (
  windowWidth: number,
  effectiveTextScale: number,
) => {
  const safeScale = Math.max(1, effectiveTextScale);
  return safeScale > 1 && (windowWidth - 48) / 3 < 120 * safeScale;
};

export const shouldUseStackedTimelineLayout = (
  windowWidth: number,
  effectiveTextScale: number,
) => {
  const safeScale = Math.max(1, effectiveTextScale);
  return (
    safeScale > 1 &&
    (windowWidth - 32) / 4 <
      DESIGN_TOKENS.TIMELINE_CIRCLE_SIZE * safeScale
  );
};
