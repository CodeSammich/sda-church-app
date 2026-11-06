import {
  DEFAULT_TEXT_SCALE,
  getBibleReaderUiTextScale,
  scaleTypographyMetric,
  type TextScale,
} from '@/constants/AppPreferences';
import { Platform, StyleSheet } from 'react-native';

const BULLETIN_VERSE_VIEWPORT_ANCHOR = 0.35;

/** Places a bulletin-linked verse slightly above the viewport midpoint. */
export const getBulletinVerseScrollOffset = (
  verseY: number,
  viewportHeight: number,
) => Math.max(0, verseY - viewportHeight * BULLETIN_VERSE_VIEWPORT_ANCHOR);

export type BibleDockLayout = Readonly<{
  audioDockHeight: number;
  chapterDockHeight: number;
  controlHeight: number;
  dockHeight: number;
  selectionBarHeight: number;
  stackControls: boolean;
}>;

export type BibleDockViewportLayout = Readonly<{
  hiddenHeight: number;
  hiddenNeedsScroll: boolean;
  maxVisibleHeight: number;
  visibleHeight: number;
  visibleNeedsScroll: boolean;
}>;

type BibleDockViewportLayoutOptions = Readonly<{
  bottomInset: number;
  bottomTabHeight: number;
  contentHeight: number;
  headerHeight: number;
  hiddenContentHeight?: number;
  viewportHeight: number;
}>;

const safeNonNegativeMetric = (value: number, fallback = 0) =>
  Number.isFinite(value) ? Math.max(0, value) : fallback;

/**
 * Keeps the fixed Bible controls below the global header. When their natural
 * height is larger than the remaining viewport, the caller can constrain the
 * dock to these heights and expose its contents through a vertical ScrollView.
 */
export const getBibleDockViewportLayout = ({
  bottomInset,
  bottomTabHeight,
  contentHeight,
  headerHeight,
  hiddenContentHeight,
  viewportHeight,
}: BibleDockViewportLayoutOptions): BibleDockViewportLayout => {
  const safeViewportHeight = Math.max(
    1,
    safeNonNegativeMetric(viewportHeight, 640),
  );
  const safeHeaderHeight = safeNonNegativeMetric(headerHeight);
  const safeContentHeight = safeNonNegativeMetric(contentHeight);
  const safeBottomInset = safeNonNegativeMetric(bottomInset);
  const safeBottomTabHeight = safeNonNegativeMetric(bottomTabHeight);
  const headerAndGutter = Math.min(
    safeViewportHeight - 1,
    safeHeaderHeight + 12,
  );
  const maxVisibleHeight = safeViewportHeight - headerAndGutter;
  const safeHiddenContentHeight = safeNonNegativeMetric(
    hiddenContentHeight ?? safeContentHeight,
    safeContentHeight,
  );
  const hiddenDockHeight = safeHiddenContentHeight + safeBottomInset;
  const visibleContentHeight = safeContentHeight + safeBottomInset + safeBottomTabHeight;

  return {
    hiddenHeight: Math.min(hiddenDockHeight, maxVisibleHeight),
    hiddenNeedsScroll: hiddenDockHeight > maxVisibleHeight,
    maxVisibleHeight,
    visibleHeight: Math.min(visibleContentHeight, maxVisibleHeight),
    visibleNeedsScroll: visibleContentHeight > maxVisibleHeight,
  };
};

/**
 * Computes enough space for the Bible's fixed controls at a text scale: the
 * app's, times the system's. The Bible screen caps the system's part at the
 * header's cap (`getHeaderFontScale`), as the controls' text does (#376).
 * Narrow or enlarged layouts stack selectors vertically so their labels can
 * wrap in full.
 */
export const getBibleDockLayout = (
  viewportWidth: number,
  effectiveTextScale: number,
): BibleDockLayout => {
  const safeWidth = Number.isFinite(viewportWidth)
    ? Math.max(240, viewportWidth)
    : 360;
  const safeScale = Number.isFinite(effectiveTextScale)
    ? Math.max(1, effectiveTextScale)
    : 1;
  const stackThreshold = safeWidth < 360 ? 1.2 : safeWidth < 480 ? 1.35 : 1.5;
  const stackControls = safeScale >= stackThreshold;
  const controlHeight = Math.ceil(44 + (safeScale - 1) * 28);
  const selectorHeight = Math.max(controlHeight, Math.ceil(40 * safeScale + 12));
  const navigationHeight = Math.max(52, controlHeight + 8);
  const dockHeight = stackControls
    ? selectorHeight * 3 + navigationHeight + 28
    : Math.max(60, controlHeight + 16);
  const selectionBarHeight = Math.max(64, Math.ceil(32 * safeScale + 28));
  // Audio controls remain a single compact row at enlarged text sizes. The
  // timestamp labels flank the scrubber, so reserving stacked-row height here
  // would create a misleading blank gap above the chapter selectors.
  const audioControlHeight = Math.max(52, controlHeight + 8);
  const audioTimelineHeight = Math.max(30, Math.ceil(16 * safeScale + 14));
  return {
    audioDockHeight: audioControlHeight + audioTimelineHeight + 8,
    chapterDockHeight: Math.max(60, controlHeight + 16),
    controlHeight,
    dockHeight,
    selectionBarHeight,
    stackControls,
  };
};

/**
 * How the chapter dock's book, chapter, and verse pills share their row's
 * spare room, as flex growth. On a phone, whose row is at most about 340
 * points, the book pill takes it all, so a long book name has room. On a row
 * at least WIDE_DOCK_PILLS_ROW wide, on a tablet or a wide window (#324), they
 * share it 2:1:1, so the book pill doesn't stretch across the column beside
 * two small ones.
 */
export const WIDE_DOCK_PILLS_ROW = 480;
export const getDockPillGrowth = (rowWidth: number) =>
  rowWidth >= WIDE_DOCK_PILLS_ROW ? { book: 2, chapter: 1, verse: 1 } : { book: 1, chapter: 0, verse: 0 };

/**
 * The side padding of the chapter dock's book, chapter, and verse pills. A
 * phone's pills sit in the floating card above the tab bar (#589), whose row
 * is only about 250 points on a 384-point Android phone, so at enlarged text
 * they keep 6 points a side, which still clears their rounded ends: "Psalms"
 * then fits whole beside "119" and "Vs." at 150% (#376). At the default size
 * it fits with the usual 10.
 */
export const NARROW_DOCK_CARD = 400;
export const getDockPillPaddingHorizontal = ({
  cardWidth,
  dockTextScale,
  textScale,
}: {
  cardWidth: number;
  dockTextScale: number;
  textScale: number;
}) => (cardWidth < NARROW_DOCK_CARD && dockTextScale > 1 ? 6 : textScale >= 1.75 ? 8 : 10);

/** A dock pill's chevron, 14 points, and the 4-point gap before it. */
export const DOCK_PILL_CHEVRON_WIDTH = 18;

/**
 * The narrowest a Bible card control gets: Apple's 44-point tap target. A
 * chapter pill without its chevron, such as "3", is otherwise about 36.
 */
export const MIN_TAP_TARGET = 44;

export type DockPillLabels = Readonly<{
  /** The verse pill says "Vs." rather than "Verse". */
  shortVerse: boolean;
  /** The pills keep their chevrons. */
  chevrons: boolean;
  /** The book pill shows the book's abbreviation, "Ps" for "Psalms". */
  shortBook: boolean;
}>;

/**
 * How the chapter dock's book, chapter, and verse pills fit their row. When
 * all three don't fit in full, the verse label shortens ("Vs.") first (#376),
 * then the pills drop their chevrons, and only then does the book pill show
 * the book's abbreviation, with the chevrons back if they fit beside it, so
 * the book is always named rather than cut to "…" (#681): an iPad's 320-point
 * Slide Over window, at its 150% text, left the book pill room for nothing
 * else. Widths are each pill's in full, with its
 * chevron, from hidden copies; they're 0 until measured, so the row starts in
 * full. Each step needs a few points to spare: the shown pills round their
 * widths, so on a row that fit by a point, "Juan" became "Ju…" beside
 * "Versículo" in a phone's floating card (#589).
 */
export const getDockPillLabels = ({
  rowWidth,
  bookPillWidth,
  shortBookPillWidth,
  chapterPillWidth,
  versePillWidth,
  shortVersePillWidth,
  gap = 8,
  slack = 4,
}: {
  rowWidth: number;
  bookPillWidth: number;
  shortBookPillWidth: number;
  chapterPillWidth: number;
  versePillWidth: number;
  shortVersePillWidth: number;
  gap?: number;
  slack?: number;
}): DockPillLabels => {
  const full = { shortVerse: false, chevrons: true, shortBook: false };
  if (!(rowWidth > 0 && bookPillWidth > 0 && chapterPillWidth > 0 && versePillWidth > 0)) return full;
  // Without its chevron, a pill is never narrower than a tap target.
  const pill = (width: number, chevrons: boolean) =>
    chevrons ? width : Math.max(MIN_TAP_TARGET, width - DOCK_PILL_CHEVRON_WIDTH);
  const fits = (book: number, verse: number, chevrons: boolean) =>
    pill(book, chevrons) + pill(chapterPillWidth, chevrons) + pill(verse, chevrons) + 2 * gap + slack <= rowWidth;
  if (fits(bookPillWidth, versePillWidth, true)) return full;
  const verse = shortVersePillWidth > 0 ? shortVersePillWidth : versePillWidth;
  if (fits(bookPillWidth, verse, true)) return { shortVerse: true, chevrons: true, shortBook: false };
  if (fits(bookPillWidth, verse, false)) return { shortVerse: true, chevrons: false, shortBook: false };
  if (!(shortBookPillWidth > 0 && shortBookPillWidth < bookPillWidth)) {
    return { shortVerse: true, chevrons: false, shortBook: false };
  }
  return { shortVerse: true, chevrons: fits(shortBookPillWidth, verse, true), shortBook: true };
};

/**
 * The Bible card's audio row: the narrator and sleep-timer buttons at its
 * ends, and back 10, play, and forward 30 between them, each of the three an
 * icon in Paper's 8-point padding a side, play with 2 more. With 8 points
 * between them, at the dock's largest text they need about 290 points. An
 * iPad's 320-point Slide Over window leaves the card's row about 262, so the
 * sleep timer ran past the card's edge (#681). When they don't fit, the gaps
 * narrow first, to 2 points, and then all five buttons shrink together, never
 * below MIN_TAP_TARGET across. A row that's 0, not yet known, keeps them in
 * full.
 */
export const getAudioControlRowLayout = ({
  rowWidth,
  sideButtonSize,
  iconSize,
}: {
  rowWidth: number;
  sideButtonSize: number;
  iconSize: number;
}) => {
  const padding = 3 * 2 * 8 + 2 * 2;
  const gaps = 4;
  const width = (gap: number, side: number, icon: number) => 2 * side + 3 * icon + padding + gaps * gap;
  if (!(rowWidth > 0) || width(8, sideButtonSize, iconSize) <= rowWidth) {
    return { gap: 8, sideButtonSize, iconSize };
  }
  const gap = Math.floor((rowWidth - width(0, sideButtonSize, iconSize)) / gaps);
  if (gap >= 2) return { gap, sideButtonSize, iconSize };
  const scale = (rowWidth - padding - gaps * 2) / (2 * sideButtonSize + 3 * iconSize);
  return {
    gap: 2,
    sideButtonSize: Math.max(MIN_TAP_TARGET, Math.floor(sideButtonSize * scale)),
    iconSize: Math.max(MIN_TAP_TARGET - 16, Math.floor(iconSize * scale * 10) / 10),
  };
};

/**
 * Shared styles for the Bible Reader and other immersive reading components.
 */
/**
 * The verse-number column's width: wide enough for `longestVerse` (at least
 * two digits) at the app's text size times the system's, which iOS applies to
 * the digits on top of the app's. Never narrower than the original fixed width.
 */
export const getVerseNumberColumnWidth = (
  longestVerse: number,
  textScale: TextScale,
  systemFontScale: number,
) => {
  const digits = Math.max(2, String(Math.max(1, Math.floor(longestVerse))).length);
  const digitWidth = scaleTypographyMetric(14, textScale) * systemFontScale * 0.66;
  return Math.max(
    scaleTypographyMetric(29, textScale),
    Math.ceil(digits * digitWidth + scaleTypographyMetric(6, textScale) + 2),
  );
};

export const createReaderStyles = (textScale: TextScale) => {
  const uiTextScale = getBibleReaderUiTextScale(textScale);
  const enlargedReadingLayout = textScale >= 1.75;
  const scriptureLineHeight = (fontSize: number, defaultLineHeight: number) =>
    scaleTypographyMetric(
      enlargedReadingLayout ? fontSize * 1.28 : defaultLineHeight,
      textScale,
    );

  return StyleSheet.create({
  readerContainer: { flex: 1 },
  readerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    zIndex: 10,
    height: 56,
  },
  bottomSelectorBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 0.5,
    zIndex: 100,
  },
  backButton: { padding: 15 },
  selectorRow: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'flex-start',
    gap: 8,
    paddingRight: 15,
  },
  selector: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  selectorText: {
    fontWeight: '700',
    fontSize: scaleTypographyMetric(13, uiTextScale),
    lineHeight: scaleTypographyMetric(18, uiTextScale),
  },
  bibleScroll: { flex: 1 },
  bibleContent: { padding: 20, paddingBottom: 80 },
  verseText: {
    fontSize: scaleTypographyMetric(19, textScale),
    lineHeight: scriptureLineHeight(19, 30),
    marginBottom: 14,
    fontFamily: 'Georgia, "Times New Roman", serif',
  },
  verseNumber: {
    fontSize: scaleTypographyMetric(14, textScale),
    fontVariant: ['tabular-nums'],
    lineHeight: scriptureLineHeight(18, 28),
    fontWeight: '600',
    textAlign: 'right',
  },
  verseRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    width: '100%',
  },
  // Beside the number of the verse being read aloud (#561). It overlays the
  // row, so the text doesn't move when it comes and goes.
  verseBeingReadMark: {
    borderRadius: 1.5,
    bottom: scaleTypographyMetric(4, textScale),
    left: 0,
    position: 'absolute',
    top: scaleTypographyMetric(4, textScale),
    width: 3,
  },
  verseNumberColumn: {
    alignItems: 'flex-end',
    flexShrink: 0,
    paddingRight: scaleTypographyMetric(6, textScale),
    width: scaleTypographyMetric(29, textScale),
  },
  pinyinVerseNumberColumn: {
    paddingTop: scaleTypographyMetric(12, textScale),
  },
  verseBody: {
    flex: 1,
    minWidth: 0,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Selection Overlays / Modals
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 0.5,
  },
  modalTitle: {
    paddingHorizontal: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  controlDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    overflow: 'hidden',
  },
  dockInner: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  pillsContainer: {
    flexDirection: 'row',
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 0,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: enlargedReadingLayout ? 8 : 16,
    paddingVertical: 6,
    borderRadius: 22,
    gap: 4,
    minHeight: 48,
    minWidth: 0,
    flexShrink: 1,
    flexGrow: 1,
  },
  sideSlot: {
    width: 48,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPlaceholder: { width: 44 },
  navIcon: { margin: 0, minHeight: 48, width: 48 },
  pillText: {
    flexShrink: 1,
    fontSize: scaleTypographyMetric(15, uiTextScale),
    lineHeight: scaleTypographyMetric(20, uiTextScale),
    fontWeight: '600',
    textAlign: 'center',
  },
  audioControlText: {
    fontSize: scaleTypographyMetric(14, uiTextScale),
    lineHeight: scaleTypographyMetric(20, uiTextScale),
    fontWeight: '700',
  },
  audioTimeText: {
    fontSize: scaleTypographyMetric(11, uiTextScale),
    lineHeight: scaleTypographyMetric(16, uiTextScale),
  },
  audioElapsedTimeText: {
    marginRight: 4,
  },
  audioDock: {
    minHeight: 84,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  audioControlRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  audioTransportControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  audioAction: { margin: 0 },
  audioPlayButton: { marginHorizontal: 2, marginVertical: 0 },
  audioSideControl: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  controlDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  audioTimelineRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioScrubberTouchTarget: { height: 28, flex: 1, justifyContent: 'center' },
  audioTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128, 128, 128, 0.18)',
    position: 'relative',
  },
  audioPlayedTrack: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
  },
  audioThumb: {
    position: 'absolute',
    top: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
  },
  // The Bible screen puts this in the content column on a wide screen (#324).
  scrollContent: {
    paddingLeft: 4,
    paddingRight: enlargedReadingLayout ? 8 : 20,
  },
  loader: { marginTop: 50 },
  heading: {
    fontSize: scaleTypographyMetric(20, textScale),
    fontWeight: '800',
    marginTop: 32,
    marginBottom: 8,
  },
  headingGroup: {
    marginLeft: enlargedReadingLayout ? 4 : 16,
    marginTop: 32,
    marginBottom: 8,
  },
  groupedHeading: {
    marginTop: 0,
    marginBottom: 3,
  },
  supportingHeading: {
    fontSize: scaleTypographyMetric(17, textScale),
    lineHeight: scriptureLineHeight(17, 26),
    fontWeight: '700',
    marginTop: 3,
  },
  verseContainer: {
    fontSize: scaleTypographyMetric(18, textScale),
    lineHeight: scriptureLineHeight(18, 28),
  },
  hangingVerseLine: {
    width: '100%',
    ...Platform.select({
      web: {
        paddingLeft: scaleTypographyMetric(8, textScale),
        textIndent: -scaleTypographyMetric(8, textScale),
      } as any,
      default: {},
    }),
  },
  primaryVerseBlock: {
    marginBottom: 12,
    width: '100%',
  },
  primaryVerseContainer: {
    marginBottom: 3,
  },
  supportingVerseContainer: {
    marginBottom: 14,
  },
  supportingVerseText: {
    fontSize: scaleTypographyMetric(16, textScale),
    lineHeight: scriptureLineHeight(16, 25),
  },
  supportingSelahMarker: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: scaleTypographyMetric(16, textScale),
    fontStyle: 'italic',
    lineHeight: scriptureLineHeight(16, 25),
    marginBottom: 2,
    marginTop: 4,
    textAlign: 'right',
  },
  selahMarker: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: scaleTypographyMetric(18, textScale),
    fontStyle: 'italic',
    lineHeight: scriptureLineHeight(18, 28),
    marginBottom: 2,
    marginTop: 4,
    opacity: 0.7,
    textAlign: 'right',
  },
  hebrewSubtitle: {
    fontSize: scaleTypographyMetric(16, textScale),
    marginBottom: 16,
    opacity: 0.8,
  },
  subtitleGroup: {
    marginLeft: enlargedReadingLayout ? 4 : 16,
    marginBottom: 16,
  },
  groupedSubtitle: {
    marginBottom: 3,
    opacity: 1,
  },
  supportingSubtitle: {
    fontSize: scaleTypographyMetric(15, textScale),
    lineHeight: scriptureLineHeight(15, 23),
    marginTop: 3,
  },
  inlineHeading: {
    fontWeight: '700',
    fontSize: scaleTypographyMetric(14, textScale),
    lineHeight: scriptureLineHeight(14, 24),
  },
  footnoteMarker: {
    fontSize: scaleTypographyMetric(12, textScale),
    fontWeight: 'bold',
    position: 'relative',
    top: -6,
    paddingHorizontal: 2,
  },
  lineBreak: { height: 16 },
  poemText: {},
  modalScroll: { padding: 16, flexShrink: 1 },
  detailSection: { marginBottom: 20 },
  detailText: {
    fontSize: scaleTypographyMetric(16, textScale),
    lineHeight: scaleTypographyMetric(24, textScale),
  },
  supportingDetailSection: {
    marginTop: scaleTypographyMetric(12, textScale),
  },
  supportingDetailText: {
    fontSize: scaleTypographyMetric(15, textScale),
    lineHeight: scaleTypographyMetric(22, textScale),
  },
  // Give these a height limit with usePopupMaxHeight, not a percentage.
  modalContent: { margin: 20, overflow: 'hidden' },
  modalInner: { paddingVertical: 16, flexShrink: 1 },
  title: {
    fontSize: scaleTypographyMetric(20, textScale),
    fontWeight: '800',
    lineHeight: scaleTypographyMetric(28, textScale),
  }, // Alias to prevent 'undefined' errors
  modalItem: {
    padding: 18,
    borderBottomWidth: 0.5,
  },
  modalItemText: {
    fontSize: scaleTypographyMetric(16, uiTextScale),
    lineHeight: scaleTypographyMetric(22, uiTextScale),
  },
  });
};

export const ReaderStyles = createReaderStyles(DEFAULT_TEXT_SCALE);
