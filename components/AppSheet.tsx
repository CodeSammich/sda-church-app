import { PopupHeader } from '@/components/PopupHeader';
import { SheetContext, type SheetContextValue } from '@/components/SheetContext';
import {
  DEFAULT_SHEET_DETENTS,
  getAndroidSheetFrame,
  getIosSheetFrame,
  getSheetDetents,
  getVisibleSheetHeight,
  sameSheetDetents,
  type SheetDetents,
} from '@/components/SheetDetents';
import type { TextScale } from '@/constants/AppPreferences';
import { useAppTheme } from '@/constants/Themes';
import { getPopupSurfaceStyle, usePopupMaxHeight, usePopupWidthStyle } from '@/styles/PopupStyles';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  type LayoutChangeEvent,
  Platform,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { Modal, Portal } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// The one place the app uses react-native-screens' experimental API (#867).
import { FormSheet } from 'react-native-screens/experimental';

/**
 * The app's popup: a native bottom sheet (#867), as Apple's and Google's
 * guidance asks for supplementary content such as settings, pickers and
 * details. Questions and alerts stay centred dialogs (`showAppAlert`).
 *
 * - **Native, through one wrapper.** iOS's sheet (UISheetPresentationController)
 *   and Android's Material bottom sheet (BottomSheetDialog), from
 *   react-native-screens' `FormSheet`. It is in that package's experimental
 *   API (`react-native-screens/experimental`), the only native sheet it has
 *   that isn't a route: the stable one, Expo Router's
 *   `presentation: 'formSheet'`, would make every popup a route, and draws no
 *   grabber on Android. This file is the only one that imports it
 *   (test/app-sheet.test.ts), so moving to the stable API later, or back to a
 *   centred popup, changes only this file.
 * - **Height** (`height`, and the rule in docs/UI_UX.md): `auto` is the
 *   content's height up to about half the screen, and taller content opens at
 *   half (medium) and expands to its own height or full height (large)
 *   (components/SheetDetents.ts); `content` is the content's whole height, up
 *   to large; `large` is full height only. Scrolling up a half-height sheet
 *   expands it first, each platform's default.
 * - **Closing:** the X in the title row (PopupHeader: leading on iOS, trailing
 *   on Android), a tap on the dim, a swipe down, Android's Back. The grabber
 *   (iOS's own, Android's Material drag handle) also expands the sheet on a
 *   tap, so dragging is never needed; on Android a double tap on it closes it.
 * - **Look:** the platform's own corners, and the colour of the app's floating
 *   bars (`floatingSurface`: white or the warm off-white in the light theme,
 *   night blue or near-black in the dark, by Contrast), so a sheet stands out
 *   from the dimmed page as the tab bar does (#593, #669).
 * - **iPad:** Apple's centred form sheet, which the system sizes. **The web:**
 *   no native sheets, so it keeps the centred popup.
 *
 * The content scrolls in a PopupScrollView or PopupFlatList, which reports its
 * height here through SheetContext, and gets the scroll hints (#521).
 */
export type AppSheetHeight = 'auto' | 'content' | 'large';

type AppSheetProps = Readonly<{
  visible: boolean;
  /** The X, a tap outside, a swipe down, or Back. */
  onDismiss: () => void;
  title: string;
  /** The X's screen-reader label, "Close" in the app's language. */
  closeLabel: string;
  /** The content, in a PopupScrollView or PopupFlatList. */
  children: ReactNode;
  /** Kept below the scrolling content, such as Text size's Reset. */
  footer?: ReactNode;
  /** Names the sheet, for tests and to open next time at the height it had. */
  testID?: string;
  /** How tall it opens (see above). */
  height?: AppSheetHeight;
  /**
   * Keeps the height it opened at while it's open, rather than following its
   * content: Text size, whose preview grows as the size changes (#867).
   */
  holdHeight?: boolean;
  /** Centres the title, with a space opposite the X (always on iOS). */
  centeredTitle?: boolean;
  headerStyle?: StyleProp<ViewStyle>;
  headerTextScale?: TextScale;
  headerVariant?: 'headlineSmall' | 'titleLarge';
}>;

export function AppSheet(props: AppSheetProps) {
  return Platform.OS === 'web' ? <CentredPopup {...props} /> : <NativeSheet {...props} />;
}

/** The title row every sheet and its web popup share. */
function SheetHeader({
  centeredTitle,
  closeLabel,
  headerStyle,
  headerTextScale,
  headerVariant = 'headlineSmall',
  onDismiss,
  title,
}: AppSheetProps) {
  return (
    <PopupHeader
      centered={centeredTitle}
      closeLabel={closeLabel}
      onClose={onDismiss}
      style={[styles.header, headerStyle]}
      textScale={headerTextScale}
      title={title}
      variant={headerVariant}
    />
  );
}

// What each `auto` sheet last measured, so it opens at that height next time,
// and the large detent's height iOS reported, by window size.
const lastDetents = new Map<string, SheetDetents>();
const lastIosLargeHeights = new Map<string, number>();

// How long a closing sheet's content stays, if the sheet never says it's gone.
const UNMOUNT_FALLBACK_MS = 1000;
// How long a sheet's layout must stay still before it's measured.
const SETTLE_MS = 80;
// Until iOS reports it, its large detent is taken to start this far below the
// status bar; a sheet's content past it scrolls.
const IOS_LARGE_DETENT_TOP_GAP = 16;
const NOTHING_MEASURED = { root: 0, body: 0, inner: 0, viewport: 0, content: 0 };
const LARGE_ONLY: readonly number[] = [1];

function NativeSheet(props: AppSheetProps) {
  const { children, footer, height = 'auto', holdHeight, onDismiss, testID, visible } = props;
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const android = Platform.OS === 'android';
  // Android's sheet is in a window of its own, edge to edge: the screen.
  const screenHeight = Dimensions.get('screen').height;
  // An iPad at a regular width shows Apple's centred form sheet, which the
  // system sizes: the detents apply only at a narrow width (Slide Over).
  const formSheet = Platform.OS === 'ios' && Platform.isPad && windowWidth >= 600;
  const sizeKey = `${Math.round(windowWidth)}x${Math.round(windowHeight)}`;
  const detentKey = `${testID ?? props.title}:${sizeKey}`;

  const [iosLargeHeight, setIosLargeHeight] = useState(() => lastIosLargeHeights.get(sizeKey));
  const frame = useMemo(
    () =>
      android
        ? getAndroidSheetFrame(screenHeight, insets)
        : getIosSheetFrame(iosLargeHeight ?? Math.max(0, windowHeight - insets.top - IOS_LARGE_DETENT_TOP_GAP)),
    [android, insets, iosLargeHeight, screenHeight, windowHeight],
  );

  const initialDetents = (): SheetDetents =>
    formSheet || height === 'large'
      ? LARGE_ONLY
      : height === 'content'
        ? 'fitToContents'
        : (lastDetents.get(detentKey) ?? DEFAULT_SHEET_DETENTS);

  const [mounted, setMounted] = useState(visible);
  const [detents, setDetents] = useState<SheetDetents>(initialDetents);
  const [detentIndex, setDetentIndex] = useState(0);
  const [heldHeight, setHeldHeight] = useState<number | null>(null);
  const measured = useRef({ ...NOTHING_MEASURED });
  const [measureTick, setMeasureTick] = useState(0);

  // Opening: the content mounts, at the height it had last time.
  useEffect(() => {
    if (!visible) return;
    setMounted(true);
    setDetentIndex(0);
    setHeldHeight(null);
    measured.current = { ...NOTHING_MEASURED };
    setDetents(initialDetents());
    // Only on opening, or at a new size: initialDetents reads these.
  }, [detentKey, formSheet, height, visible]);

  // Closing: the content stays until the sheet has gone.
  useEffect(() => {
    if (visible || !mounted) return;
    const timer = setTimeout(() => setMounted(false), UNMOUNT_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [mounted, visible]);

  const fitted = detents === 'fitToContents';
  const fractions = fitted ? null : (detents as readonly number[]);

  // iOS: the large detent's height, from the sheet's height at a detent. A
  // layout from before the sheet has its height, or from between two
  // detents, gives one out of range, which is left out.
  const onContainerLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (android || !fractions || formSheet) return;
      const layoutHeight = event.nativeEvent.layout.height;
      const largeHeight = layoutHeight / fractions[Math.min(detentIndex, fractions.length - 1)];
      const most = windowHeight - insets.top;
      if (!(layoutHeight > 0) || largeHeight < 0.6 * most || largeHeight > most + 1) return;
      if (iosLargeHeight !== undefined && Math.abs(iosLargeHeight - largeHeight) < 2) return;
      lastIosLargeHeights.set(sizeKey, largeHeight);
      setIosLargeHeight(largeHeight);
    },
    [android, detentIndex, formSheet, fractions, insets.top, iosLargeHeight, sizeKey, windowHeight],
  );

  const measure = useCallback(
    (part: 'root' | 'body' | 'inner') => (event: LayoutChangeEvent) => {
      const partHeight = event.nativeEvent.layout.height;
      if (measured.current[part] === partHeight) return;
      measured.current = { ...measured.current, [part]: partHeight };
      setMeasureTick((tick) => tick + 1);
    },
    [],
  );

  const reportScroll = useCallback((viewport: number, content: number) => {
    const current = measured.current;
    if (current.viewport === viewport && current.content === content) return;
    measured.current = { ...current, viewport, content };
    setMeasureTick((tick) => tick + 1);
  }, []);

  // The content's own height, once a layout has settled (the parts' heights
  // arrive one by one): the title row and footer, around the body; and in
  // the body, what doesn't scroll, plus all of what does. The body may be
  // taller than what's in it, so what's in it is measured on its own.
  useEffect(() => {
    if (!visible || formSheet) return;
    if (height !== 'auto' && !(holdHeight && heldHeight === null)) return;
    const timer = setTimeout(() => {
      const { root, body, inner, viewport, content } = measured.current;
      if (!(root > 0) || !(inner > 0) || !(content > 0)) return;
      const contentHeight = root - body + (inner - viewport + content);
      if (holdHeight) setHeldHeight(Math.min(contentHeight, frame.largeHeight));
      if (height !== 'auto') return;
      const next = getSheetDetents(contentHeight, frame);
      lastDetents.set(detentKey, next);
      setDetents((current) => (sameSheetDetents(current, next) ? current : next));
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [detentKey, formSheet, frame, height, heldHeight, holdHeight, measureTick, visible]);

  const sheetContext = useMemo<SheetContextValue>(
    () => ({
      nestedScrollEnabled: android,
      reportScroll,
      surfaceColor: theme.colors.floatingSurface,
    }),
    [android, reportScroll, theme.colors.floatingSurface],
  );

  if (!mounted) return null;

  // Android keeps a sheet's content at its large height and slides the sheet
  // down to rest, so at half height its foot would be off the screen: the
  // content takes the height that shows. iOS sizes it to the detent.
  const restingHeight =
    android && fractions && fractions.length > 1
      ? getVisibleSheetHeight(frame, fractions[Math.min(detentIndex, fractions.length - 1)])
      : undefined;

  const content = (
    <View
      testID={testID}
      onLayout={measure('root')}
      style={[
        styles.root,
        fitted
          ? heldHeight !== null
            ? { height: heldHeight }
            : { maxHeight: frame.largeHeight }
          : restingHeight !== undefined
            ? { height: restingHeight }
            : styles.fill,
        // iOS's sheet runs under the home indicator; Android's stops above
        // the navigation bar.
        !android && { paddingBottom: insets.bottom },
      ]}
    >
      <SheetHeader {...props} />
      <View onLayout={measure('body')} style={fitted ? styles.bodyFitted : styles.body}>
        <View onLayout={measure('inner')} style={styles.bodyFitted}>
          {children}
        </View>
      </View>
      {footer}
    </View>
  );

  return (
    <FormSheet
      isOpen={visible}
      detents={fitted ? 'fitToContents' : [...(fractions ?? DEFAULT_SHEET_DETENTS)]}
      prefersGrabberVisible
      preferredCornerRadius="systemDefault"
      nativeContainerStyle={{ backgroundColor: theme.colors.floatingSurface }}
      onNativeDismiss={onDismiss}
      onDetentChanged={(event) => setDetentIndex(Math.max(0, event.nativeEvent.index))}
      onDidDisappear={() => {
        if (!visible) setMounted(false);
      }}
    >
      <SheetContext.Provider value={sheetContext}>
        {fitted ? (
          content
        ) : (
          <View onLayout={onContainerLayout} style={styles.fill}>
            {content}
          </View>
        )}
      </SheetContext.Provider>
    </FormSheet>
  );
}

/**
 * The web has no native sheets, so a sheet there is the centred popup the
 * app had before #867: the canvas, the shared corners, and the height limit.
 */
function CentredPopup(props: AppSheetProps) {
  const { children, footer, onDismiss, testID, visible } = props;
  const theme = useAppTheme();
  const popupMaxHeight = usePopupMaxHeight();
  const popupWidthStyle = usePopupWidthStyle();
  return (
    <Portal>
      <Modal
        testID={testID}
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[popupWidthStyle, { maxHeight: popupMaxHeight }, getPopupSurfaceStyle(theme)]}
      >
        <View style={styles.webRoot}>
          <SheetHeader {...props} />
          <View style={styles.bodyFitted}>{children}</View>
          {footer}
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, minHeight: 0 },
  bodyFitted: { flexShrink: 1, minHeight: 0 },
  fill: { flex: 1 },
  // The title row: iOS's grabber sits over the sheet's top edge, so the row
  // starts below it; Android's drag handle has a row of its own above.
  header: {
    marginBottom: 8,
    marginTop: Platform.OS === 'ios' ? 16 : 0,
    paddingLeft: Platform.OS === 'ios' ? 12 : 24,
    paddingRight: 12,
  },
  root: { flexDirection: 'column' },
  webRoot: { flexShrink: 1, minHeight: 0, paddingTop: 16 },
});
