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

export const getMeasuredTextLineCount = (
  measuredHeight: number,
  lineHeight: number,
) => {
  if (
    !Number.isFinite(measuredHeight) ||
    !Number.isFinite(lineHeight) ||
    measuredHeight <= 0 ||
    lineHeight <= 0
  ) {
    return 1;
  }

  return Math.max(1, Math.round(measuredHeight / lineHeight));
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
  return safeScale > 1 && (windowWidth - 48) / 2 < 145 * safeScale;
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
