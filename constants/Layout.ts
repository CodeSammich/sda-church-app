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
  // Dimension for timeline markers in the History section
  TIMELINE_CIRCLE_SIZE: 50,
};
