import { getGlobalHeaderContentHeight } from '@/constants/Layout';
import { getBibleReaderUiTextScale } from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';
import { UIStateContext } from '@/constants/UIStateContext';
import { useContext } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The most the header grows with the phone's system text size. Past the largest
 * standard size, the accessibility sizes enlarge the page's content but not its
 * bars, as Apple's own apps do; otherwise the Bible's translation button filled a
 * row of its own with oversized text. The app's own text size still applies.
 */
export const HEADER_MAX_FONT_SCALE = 1.35;

/** The system text size the header follows: the phone's, up to the cap. */
export const getHeaderFontScale = (fontScale: number) =>
  Math.min(Math.max(1, Number.isFinite(fontScale) ? fontScale : 1), HEADER_MAX_FONT_SCALE);

export const getGlobalHeaderHeightForScale = (
  effectiveTextScale: number,
  stackBibleControls = false,
  measuredContentHeight = 0,
) => {
  const safeScale = Number.isFinite(effectiveTextScale)
    ? Math.max(1, effectiveTextScale)
    : 1;
  const baseHeight = getGlobalHeaderContentHeight(safeScale);

  const compactControlHeight = Math.ceil(44 + (safeScale - 1) * 24);
  const wrappedControlHeight = Math.max(
    compactControlHeight,
    Math.ceil(40 * safeScale + 12),
  );
  const controlHeight = stackBibleControls
    ? wrappedControlHeight + compactControlHeight + 24
    : 0;
  const safeMeasuredContentHeight = Number.isFinite(measuredContentHeight)
    ? Math.max(0, measuredContentHeight)
    : 0;

  return Math.max(
    baseHeight,
    controlHeight,
    Math.ceil(
      safeMeasuredContentHeight + (safeMeasuredContentHeight > 0 ? 16 : 0),
    ),
  );
};

export type BibleControlsLayout = Readonly<{
  stack: boolean;
  hideTranslationIcon: boolean;
}>;

/**
 * How the Bible reader's header fits its controls (#376). The translation
 * button shares a row with the icon buttons, cutting its translation names short
 * with "…" when the row is tight. Only if even its shortest form, each name cut
 * to its first letter, can't fit does it drop its 文A icon, and only if it still
 * can't fit does it take a row of its own, with the icon. Measured widths are 0
 * until laid out, so the controls start on one row with the icon.
 */
export const getBibleControlsLayout = ({
  rowWidth,
  shortestButtonWidth,
  shortestButtonWidthWithoutIcon,
  iconButtonCount,
  iconButtonSize,
  gap = 8,
  trailingPadding = 12,
}: {
  rowWidth: number;
  shortestButtonWidth: number;
  shortestButtonWidthWithoutIcon: number;
  iconButtonCount: number;
  iconButtonSize: number;
  gap?: number;
  trailingPadding?: number;
}): BibleControlsLayout => {
  const oneRow = { stack: false, hideTranslationIcon: false };
  if (rowWidth <= 0 || shortestButtonWidth <= 0) return oneRow;
  const room = rowWidth - iconButtonCount * (iconButtonSize + gap) - trailingPadding;
  if (shortestButtonWidth <= room) return oneRow;
  if (shortestButtonWidthWithoutIcon > 0 && shortestButtonWidthWithoutIcon <= room) {
    return { stack: false, hideTranslationIcon: true };
  }
  return { stack: true, hideTranslationIcon: false };
};

/** A translation name cut to its first letter, the shortest the header shows it. */
export const shortestTranslationLabel = (label: string) =>
  label.length > 1 ? `${Array.from(label)[0]}…` : label;

/**
 * Whether a page's hero image is under the status bar, where the header leaves
 * it uncovered. A page can say so with `heroUnderStatusBar`. Otherwise, a page
 * that shows its title chip once the hero scrolls away, or a hymnal that
 * collapses its search then, has its hero in view until that happens.
 *
 * A page's options reach the header a moment after it first draws, so until
 * then `hasHero`, from the route, decides; otherwise the strip would flash
 * over every hero as its page opens. A page without a hero has only its
 * background or scrolled content under the status bar.
 */
export const isHeroUnderStatusBar = ({
  heroUnderStatusBar,
  showTitleChip,
  isHymnalPage,
  hymnalSearchCollapsed,
  hasHero,
}: {
  heroUnderStatusBar?: boolean;
  showTitleChip?: boolean;
  isHymnalPage: boolean;
  hymnalSearchCollapsed: boolean;
  hasHero: boolean;
}) =>
  heroUnderStatusBar ??
  (showTitleChip !== undefined
    ? !showTitleChip
    : isHymnalPage
      ? !hymnalSearchCollapsed
      : hasHero);

/**
 * The header's height, including the top safe area. The Bible reader passes
 * `bibleReader` to use its own text scale and the header's measured decision
 * on stacking its controls.
 */
export const useGlobalHeaderHeight = (bibleReader = false) => {
  const { textScale } = useTextSize();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { bibleControlsStacked } = useContext(UIStateContext);

  return (
    insets.top +
    getGlobalHeaderHeightForScale(
      getHeaderFontScale(fontScale) *
        (bibleReader ? getBibleReaderUiTextScale(textScale) : textScale),
      bibleReader && bibleControlsStacked,
    )
  );
};
