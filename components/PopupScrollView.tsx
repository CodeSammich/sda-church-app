import { AppIcon } from '@/components/AppIcon';
import { SheetContext } from '@/components/SheetContext';
import { useAppTheme } from '@/constants/Themes';
import { MIN_TAP_TARGET } from '@/styles/ReaderStyles';
import { LinearGradient } from 'expo-linear-gradient';
import {
  type ComponentRef,
  createContext,
  type ReactNode,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  type FlatListProps,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

/**
 * Hints that a popup has more to scroll (#521). In testing, members didn't
 * notice content below a popup's fold: iOS shows the scroll bar only while
 * scrolling, and a popup ends cleanly at its height limit. So while there's
 * more below, the bottom edge fades and a ⌄ in a circle sits above it; once the content
 * has scrolled, the top edge fades too; and the scroll bar flashes once when a
 * popup opens with more than fits. The fades are decorative and let taps
 * through. The ⌄ looks like a button, so it is one: a tap on it scrolls down
 * most of a page, and never reaches the row under it, which once opened
 * 1 Samuel from the Bible's book list (#794). Its tap target is at least 44
 * points square. Screen readers scroll a list themselves, so it's hidden from
 * them, as the fades are.
 */

// Within this many points of an edge counts as at it, so rounding doesn't
// leave a hint showing at the end.
const EDGE = 4;
const FADE_HEIGHT = 32;
const CHEVRON_SIZE = 20;
// The ⌄ sits in a circle of the theme's main colour, blue or gold, so it stands
// out from the text it fades over.
const CIRCLE_SIZE = 28;

export type ScrollMetrics = Readonly<{ offset: number; viewport: number; content: number }>;

export const getScrollHints = ({ offset, viewport, content }: ScrollMetrics) => ({
  above: viewport > 0 && offset > EDGE,
  below: viewport > 0 && offset + viewport < content - EDGE,
});

/**
 * Where a tap on the ⌄ scrolls to: down a page, less the two fades, so what
 * showed faded at the bottom ends up just below the top fade. A short popup
 * still moves at least half its height, and it stops at the end.
 */
export const getScrollDownOffset = ({ offset, viewport, content }: ScrollMetrics) => {
  const step = Math.max(viewport - 2 * FADE_HEIGHT, viewport / 2);
  return Math.max(0, Math.min(offset + step, content - viewport));
};

// `color` with alpha 0, so a fade into it doesn't pass through grey.
const transparent = (color: string) =>
  /^#[0-9a-f]{6}$/i.test(color) ? `${color}00` : 'transparent';

type ScrollHandlers = Pick<
  ScrollViewProps,
  'onLayout' | 'onContentSizeChange' | 'onScroll' | 'scrollEventThrottle'
>;

/**
 * The scroll handlers a popup's ScrollView or FlatList needs for its hints,
 * and the hints to show. `flash` is called once, the first time there's more
 * below, to flash the scroll bar.
 */
export function usePopupScrollHints(handlers: ScrollHandlers = {}, flash?: () => void) {
  const [metrics, setMetrics] = useState<ScrollMetrics>({ offset: 0, viewport: 0, content: 0 });
  const hints = getScrollHints(metrics);
  const flashed = useRef(false);
  const { onLayout, onContentSizeChange, onScroll } = handlers;
  // A sheet sizes itself to its content (#867).
  const { reportScroll } = useContext(SheetContext);
  useEffect(() => {
    if (metrics.viewport > 0 || metrics.content > 0) reportScroll?.(metrics.viewport, metrics.content);
  }, [metrics.content, metrics.viewport, reportScroll]);

  useEffect(() => {
    if (hints.below && !flashed.current) {
      flashed.current = true;
      flash?.();
    }
  }, [flash, hints.below]);

  const scrollProps: ScrollHandlers = {
    onLayout: useCallback(
      (event: LayoutChangeEvent) => {
        const viewport = event.nativeEvent.layout.height;
        setMetrics((current) => (current.viewport === viewport ? current : { ...current, viewport }));
        onLayout?.(event);
      },
      [onLayout],
    ),
    onContentSizeChange: useCallback(
      (width: number, height: number) => {
        setMetrics((current) => (current.content === height ? current : { ...current, content: height }));
        onContentSizeChange?.(width, height);
      },
      [onContentSizeChange],
    ),
    onScroll: useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        setMetrics({
          offset: contentOffset.y,
          viewport: layoutMeasurement.height,
          content: contentSize.height,
        });
        onScroll?.(event);
      },
      [onScroll],
    ),
    scrollEventThrottle: handlers.scrollEventThrottle ?? 16,
  };

  return { hints, metrics, scrollProps };
}

/**
 * The fades and ⌄ over a popup's scrolling content, from usePopupScrollHints.
 * onScrollDown scrolls the content when the ⌄ is tapped.
 */
export function PopupScrollHints({
  hints,
  onScrollDown,
}: Readonly<{ hints: ReturnType<typeof getScrollHints>; onScrollDown: () => void }>) {
  const theme = useAppTheme();
  // A sheet's own colour, or the canvas in a centred dialog.
  const background = useContext(SheetContext).surfaceColor ?? theme.colors.background;
  const clear = transparent(background);

  return (
    <>
      {hints.above && (
        <LinearGradient
          testID="popup-scroll-hint-above"
          pointerEvents="none"
          colors={[background, clear]}
          style={[styles.fade, styles.top]}
        />
      )}
      {hints.below && (
        // box-none: only the ⌄'s button takes taps; beside it, they reach the row.
        <View
          testID="popup-scroll-hint-below"
          pointerEvents="box-none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={styles.below}
        >
          <LinearGradient
            pointerEvents="none"
            colors={[clear, background]}
            style={[styles.fade, styles.bottom]}
          />
          <Pressable
            testID="popup-scroll-more"
            onPress={onScrollDown}
            style={({ pressed }) => [styles.more, pressed && styles.morePressed]}
          >
            <View style={[styles.circle, { backgroundColor: theme.colors.primary }]}>
              <AppIcon
                name="chevron-down"
                size={CHEVRON_SIZE}
                scaleWithText={false}
                color={theme.colors.onPrimary}
                pointerEvents="none"
              />
            </View>
          </Pressable>
        </View>
      )}
    </>
  );
}

/**
 * Where to scroll so a popup's current choice shows when it opens (#867):
 * nowhere if it already shows from the top; otherwise with it in the middle,
 * as far as the content goes.
 */
export const getRevealOffset = ({
  top,
  height,
  viewport,
  content,
}: Readonly<{ top: number; height: number; viewport: number; content: number }>) => {
  if (top + height <= viewport) return 0;
  return Math.max(0, Math.min(top - (viewport - height) / 2, content - viewport));
};

// How long a popup's layout must stay still before its current choice is
// scrolled into view: a sheet settles at its height after it opens.
const REVEAL_SETTLE_MS = 150;

type HostView = ComponentRef<typeof View>;

/** A popup's ScrollView takes its current choice's view, to scroll it into view. */
const PopupRevealContext = createContext<((view: HostView | null) => void) | null>(null);

/**
 * For a choice in a popup's list: when it's the current one, the popup
 * scrolls it into view as it opens, so the current choice always shows
 * (#867). Spread on the choice's own view.
 */
export function useRevealWhenSelected(selected: boolean) {
  const reveal = useContext(PopupRevealContext);
  const ref = useRef<HostView>(null);
  const onLayout = useCallback(() => {
    if (selected) reveal?.(ref.current);
  }, [reveal, selected]);
  return { ref, onLayout };
}

/** A row of a popup's list, scrolled into view as the popup opens when it's the current choice. */
export function RevealIfSelected({ children, selected }: Readonly<{ children: ReactNode; selected: boolean }>) {
  const { ref, onLayout } = useRevealWhenSelected(selected);
  return (
    <View ref={ref} onLayout={onLayout} collapsable={false}>
      {children}
    </View>
  );
}

// Around a popup's ScrollView or FlatList and its hints: it shrinks to the
// popup's height limit as the list alone did, and minHeight 0 lets it shrink
// below its content on the web too.
const popupFrameStyle = { flexShrink: 1, minHeight: 0 } as const;

/**
 * A popup's ScrollView, with the hints. Its style applies to the ScrollView, in
 * a frame that holds the hints. frameStyle adds to the frame's, such as
 * first-launch setup's, which fills the screen above its buttons (#681).
 */
type ScrollViewRef = ComponentRef<typeof ScrollView>;

export const PopupScrollView = forwardRef<ScrollViewRef, ScrollViewProps & { frameStyle?: StyleProp<ViewStyle> }>(function PopupScrollView(
  { frameStyle, onLayout, onContentSizeChange, onScroll, scrollEventThrottle, ...props },
  ref,
) {
  const scrollRef = useRef<ScrollViewRef>(null);
  useImperativeHandle(ref, () => scrollRef.current as ScrollViewRef);
  const flash = useCallback(() => scrollRef.current?.flashScrollIndicators(), []);
  const { hints, metrics, scrollProps } = usePopupScrollHints(
    { onLayout, onContentSizeChange, onScroll, scrollEventThrottle },
    flash,
  );
  const scrollDown = () => scrollRef.current?.scrollTo({ y: getScrollDownOffset(metrics), animated: true });
  const { nestedScrollEnabled } = useContext(SheetContext);

  // The current choice, once the layout has settled, scrolled into view.
  const selected = useRef<HostView | null>(null);
  const revealed = useRef(false);
  const [selectedTick, setSelectedTick] = useState(0);
  const reveal = useCallback((view: HostView | null) => {
    if (revealed.current || !view) return;
    selected.current = view;
    setSelectedTick((tick) => tick + 1);
  }, []);
  useEffect(() => {
    const view = selected.current;
    const inner = scrollRef.current?.getInnerViewRef?.();
    if (revealed.current || !view || !inner || !(metrics.viewport > 0) || !(metrics.content > 0)) return;
    const { viewport, content } = metrics;
    const timer = setTimeout(() => {
      view.measureLayout(
        inner as unknown as HostView,
        (_x, top, _width, height) => {
          revealed.current = true;
          const y = getRevealOffset({ top, height, viewport, content });
          if (y > 0) scrollRef.current?.scrollTo({ y, animated: false });
        },
        () => undefined,
      );
    }, REVEAL_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [metrics, selectedTick]);

  return (
    <PopupRevealContext.Provider value={reveal}>
      <View style={[popupFrameStyle, frameStyle]}>
        <ScrollView ref={scrollRef} nestedScrollEnabled={nestedScrollEnabled} {...props} {...scrollProps} />
        <PopupScrollHints hints={hints} onScrollDown={scrollDown} />
      </View>
    </PopupRevealContext.Provider>
  );
});

/**
 * A popup's FlatList, with the hints, as PopupScrollView is for a ScrollView.
 * selectedIndex is the current choice's row, scrolled into view as the popup
 * opens (#867).
 */
export function PopupFlatList<ItemT>({
  onLayout,
  onContentSizeChange,
  onScroll,
  scrollEventThrottle,
  selectedIndex,
  ...props
}: FlatListProps<ItemT> & { selectedIndex?: number }) {
  const listRef = useRef<FlatList<ItemT>>(null);
  const flash = useCallback(() => listRef.current?.flashScrollIndicators(), []);
  const { hints, metrics, scrollProps } = usePopupScrollHints(
    { onLayout, onContentSizeChange, onScroll, scrollEventThrottle },
    flash,
  );
  const scrollDown = () =>
    listRef.current?.scrollToOffset({ offset: getScrollDownOffset(metrics), animated: true });
  const { nestedScrollEnabled } = useContext(SheetContext);

  // The current choice, once the layout has settled, in the middle of the list.
  const revealed = useRef(false);
  useEffect(() => {
    if (revealed.current || selectedIndex === undefined || selectedIndex < 1) return;
    if (!(metrics.viewport > 0) || !(metrics.content > 0)) return;
    const timer = setTimeout(() => {
      revealed.current = true;
      listRef.current?.scrollToIndex({ animated: false, index: selectedIndex, viewPosition: 0.5 });
    }, REVEAL_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [metrics.content, metrics.viewport, selectedIndex]);
  // A row not drawn yet: scroll near it, by the rows' average height, then to it.
  const onScrollToIndexFailed = useCallback(
    ({ averageItemLength, index }: { averageItemLength: number; index: number }) => {
      listRef.current?.scrollToOffset({ animated: false, offset: averageItemLength * index });
      setTimeout(
        () => listRef.current?.scrollToIndex({ animated: false, index, viewPosition: 0.5 }),
        REVEAL_SETTLE_MS,
      );
    },
    [],
  );

  return (
    <View style={popupFrameStyle}>
      <FlatList
        ref={listRef}
        nestedScrollEnabled={nestedScrollEnabled}
        onScrollToIndexFailed={onScrollToIndexFailed}
        {...props}
        {...scrollProps}
      />
      <PopupScrollHints hints={hints} onScrollDown={scrollDown} />
    </View>
  );
}

const styles = StyleSheet.create({
  fade: {
    height: FADE_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  top: { top: 0 },
  bottom: { bottom: 0 },
  // The fade at the bottom, and above it the ⌄'s button, which is taller.
  below: {
    alignItems: 'center',
    bottom: 0,
    height: Math.max(FADE_HEIGHT, MIN_TAP_TARGET),
    left: 0,
    position: 'absolute',
    right: 0,
  },
  // The ⌄ sits 4 points above the bottom edge, as it did before it took taps.
  more: {
    alignItems: 'center',
    height: MIN_TAP_TARGET,
    justifyContent: 'flex-end',
    paddingBottom: 4,
    width: MIN_TAP_TARGET,
  },
  morePressed: { opacity: 0.7 },
  circle: {
    alignItems: 'center',
    borderRadius: CIRCLE_SIZE / 2,
    height: CIRCLE_SIZE,
    justifyContent: 'center',
    width: CIRCLE_SIZE,
  },
});
