import { AppIcon } from '@/components/AppIcon';
import { useAppTheme } from '@/constants/Themes';
import { LinearGradient } from 'expo-linear-gradient';
import {
  type ComponentRef,
  forwardRef,
  useCallback,
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
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  View,
} from 'react-native';

/**
 * Hints that a popup has more to scroll (#521). In testing, members didn't
 * notice content below a popup's fold: iOS shows the scroll bar only while
 * scrolling, and a popup ends cleanly at its height limit. So while there's
 * more below, the bottom edge fades and a ⌄ in a circle sits above it; once the content
 * has scrolled, the top edge fades too; and the scroll bar flashes once when a
 * popup opens with more than fits. The hints are decorative: they don't take
 * taps or screen-reader focus.
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

  return { hints, scrollProps };
}

/** The fades and ⌄ over a popup's scrolling content, from usePopupScrollHints. */
export function PopupScrollHints({ hints }: Readonly<{ hints: ReturnType<typeof getScrollHints> }>) {
  const theme = useAppTheme();
  const background = theme.colors.background;
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
        <View
          testID="popup-scroll-hint-below"
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[styles.fade, styles.bottom]}
        >
          <LinearGradient colors={[clear, background]} style={StyleSheet.absoluteFill} />
          <View style={[styles.circle, { backgroundColor: theme.colors.primary }]}>
            <AppIcon
              name="chevron-down"
              size={CHEVRON_SIZE}
              scaleWithText={false}
              color={theme.colors.onPrimary}
              pointerEvents="none"
            />
          </View>
        </View>
      )}
    </>
  );
}

// Around a popup's ScrollView or FlatList and its hints: it shrinks to the
// popup's height limit as the list alone did, and minHeight 0 lets it shrink
// below its content on the web too.
const frameStyle = { flexShrink: 1, minHeight: 0 } as const;

/**
 * A popup's ScrollView, with the hints. Its style applies to the ScrollView, in
 * a frame that holds the hints.
 */
type ScrollViewRef = ComponentRef<typeof ScrollView>;

export const PopupScrollView = forwardRef<ScrollViewRef, ScrollViewProps>(function PopupScrollView(
  { onLayout, onContentSizeChange, onScroll, scrollEventThrottle, ...props },
  ref,
) {
  const scrollRef = useRef<ScrollViewRef>(null);
  useImperativeHandle(ref, () => scrollRef.current as ScrollViewRef);
  const flash = useCallback(() => scrollRef.current?.flashScrollIndicators(), []);
  const { hints, scrollProps } = usePopupScrollHints(
    { onLayout, onContentSizeChange, onScroll, scrollEventThrottle },
    flash,
  );

  return (
    <View style={frameStyle}>
      <ScrollView ref={scrollRef} {...props} {...scrollProps} />
      <PopupScrollHints hints={hints} />
    </View>
  );
});

/** A popup's FlatList, with the hints, as PopupScrollView is for a ScrollView. */
export function PopupFlatList<ItemT>({
  onLayout,
  onContentSizeChange,
  onScroll,
  scrollEventThrottle,
  ...props
}: FlatListProps<ItemT>) {
  const listRef = useRef<FlatList<ItemT>>(null);
  const flash = useCallback(() => listRef.current?.flashScrollIndicators(), []);
  const { hints, scrollProps } = usePopupScrollHints(
    { onLayout, onContentSizeChange, onScroll, scrollEventThrottle },
    flash,
  );

  return (
    <View style={frameStyle}>
      <FlatList ref={listRef} {...props} {...scrollProps} />
      <PopupScrollHints hints={hints} />
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
  bottom: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  circle: {
    alignItems: 'center',
    borderRadius: CIRCLE_SIZE / 2,
    height: CIRCLE_SIZE,
    justifyContent: 'center',
    width: CIRCLE_SIZE,
  },
});
