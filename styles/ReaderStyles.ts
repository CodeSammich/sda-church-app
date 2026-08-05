import {
  DEFAULT_TEXT_SCALE,
  getBibleReaderUiTextScale,
  scaleTypographyMetric,
  type TextScale,
} from '@/constants/AppPreferences';
import { StyleSheet } from 'react-native';

export type BibleDockLayout = Readonly<{
  audioDockHeight: number;
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
 * Computes enough space for the Bible's fixed controls without capping either
 * the app preference or the operating-system font scale. Narrow or enlarged
 * layouts stack selectors vertically so their labels can wrap in full.
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
  const selectionBarHeight = stackControls
    ? controlHeight * 3 + 40
    : Math.max(56, Math.ceil(44 * safeScale + 16));
  const audioControlsNeedTwoRows =
    stackControls && safeWidth < controlHeight * 2 + 156;
  const audioControlHeight = audioControlsNeedTwoRows
    ? controlHeight * 2 + 16
    : Math.max(52, controlHeight + 8);
  const audioTimelineHeight = stackControls
    ? Math.ceil(32 * safeScale + 52)
    : Math.max(30, Math.ceil(16 * safeScale + 14));

  return {
    audioDockHeight: audioControlHeight + audioTimelineHeight + 8,
    controlHeight,
    dockHeight,
    selectionBarHeight,
    stackControls,
  };
};

/**
 * Shared styles for the Bible Reader and other immersive reading components.
 */
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
    lineHeight: scaleTypographyMetric(28, textScale),
    fontWeight: '600',
    paddingRight: 6,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Selection Overlays / Modals
  overlay: {
    ...StyleSheet.absoluteFillObject,
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
  timerBadge: {
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
  audioBufferedTrack: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
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
  scrollContent: { paddingHorizontal: enlargedReadingLayout ? 8 : 20 },
  loader: { marginTop: 50 },
  heading: {
    fontSize: scaleTypographyMetric(20, textScale),
    fontWeight: '800',
    marginTop: 32,
    marginBottom: 8,
  },
  verseContainer: {
    fontSize: scaleTypographyMetric(18, textScale),
    lineHeight: scriptureLineHeight(18, 28),
    marginBottom: 12,
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
  modalContent: { margin: 20, borderRadius: 12, maxHeight: '80%', overflow: 'hidden' },
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
