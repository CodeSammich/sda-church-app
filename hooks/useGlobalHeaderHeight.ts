import { getGlobalHeaderContentHeight } from '@/constants/Layout';
import {
  getBibleReaderUiTextScale,
  getBottomTabIconTextScale,
  type TextScale,
} from '@/constants/AppPreferences';
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
/**
 * The tab bar's text scale: the app's text size up to the cap its icons use,
 * times the phone's up to the header's cap. The tab bar grows a little with
 * larger text but never takes over the screen, and its labels stay on one line
 * (#380). Everything that sizes around the tab bar uses this.
 */
export const getBottomTabTextScale = (textScale: number, fontScale: number) =>
  Math.max(
    1,
    getBottomTabIconTextScale((Number.isFinite(textScale) ? textScale : 1) as TextScale) *
      getHeaderFontScale(fontScale),
  );

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
  hideTranslationNames: boolean;
}>;

/**
 * How the Bible reader's header fits its controls (#376). The translation
 * button shares a row with the icon buttons. When the row is tight, it gives
 * things up in this order: first its 文A icon, then its translation names, cut
 * short with "…" down to one letter and then dropped, "…" and all, and last its
 * language badges (EN, 繁): only if even the badges alone can't fit does it take
 * a row of its own, with everything. Measured widths are 0 until laid out, so
 * the controls start on one row with everything.
 */
export const getBibleControlsLayout = ({
  rowWidth,
  fullButtonWidth,
  shortestButtonWidth,
  badgesOnlyButtonWidth,
  iconButtonCount,
  iconButtonSize,
  gap = 8,
  trailingPadding = 12,
}: {
  rowWidth: number;
  /** The icon, the badges, and the full names. */
  fullButtonWidth: number;
  /** No icon; the badges, and each name cut to its first letter. */
  shortestButtonWidth: number;
  /** No icon or names; just the badges. */
  badgesOnlyButtonWidth: number;
  iconButtonCount: number;
  iconButtonSize: number;
  gap?: number;
  trailingPadding?: number;
}): BibleControlsLayout => {
  const everything = { stack: false, hideTranslationIcon: false, hideTranslationNames: false };
  if (rowWidth <= 0 || fullButtonWidth <= 0) return everything;
  const room = rowWidth - iconButtonCount * (iconButtonSize + gap) - trailingPadding;
  if (fullButtonWidth <= room) return everything;
  const fits = (width: number) => width > 0 && width <= room;
  // Without the icon, the names show in full if they fit, or as much as fits.
  if (fits(shortestButtonWidth)) {
    return { stack: false, hideTranslationIcon: true, hideTranslationNames: false };
  }
  if (fits(badgesOnlyButtonWidth)) {
    return { stack: false, hideTranslationIcon: true, hideTranslationNames: true };
  }
  return { ...everything, stack: true };
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
