import { getGlobalHeaderContentHeight } from '@/constants/Layout';
import { getBibleReaderUiTextScale } from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';
import { UIStateContext } from '@/constants/UIStateContext';
import { useContext } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

/**
 * Whether the Bible reader's translation button needs a header row of its own:
 * only when it can't sit beside the icon buttons, or would have to cut off a
 * translation name to fit its maximum width. Measured widths are 0 until laid
 * out, so the controls start on one row.
 */
export const shouldStackBibleControls = ({
  rowWidth,
  translationButtonWidth,
  iconButtonCount,
  iconButtonSize,
  gap = 8,
  trailingPadding = 12,
  translationButtonMaxWidth = 240,
}: {
  rowWidth: number;
  translationButtonWidth: number;
  iconButtonCount: number;
  iconButtonSize: number;
  gap?: number;
  trailingPadding?: number;
  translationButtonMaxWidth?: number;
}) =>
  rowWidth > 0 &&
  translationButtonWidth > 0 &&
  (translationButtonWidth > translationButtonMaxWidth ||
    translationButtonWidth + iconButtonCount * (iconButtonSize + gap) + trailingPadding >
      rowWidth);

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
      fontScale * (bibleReader ? getBibleReaderUiTextScale(textScale) : textScale),
      bibleReader && bibleControlsStacked,
    )
  );
};
