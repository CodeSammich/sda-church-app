import { PopupHeader } from '@/components/PopupHeader';
import { SheetContext, type SheetContextValue } from '@/components/SheetContext';
import {
  DEFAULT_SHEET_DETENTS,
  getSheetDetents,
  getSheetLargeHeight,
  getVisibleSheetHeight,
  sameSheetDetents,
  type SheetDetents,
  type SheetFrame,
  type SheetPlatform,
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
 * - **Size:** up to about half the screen, a sheet is its content's height;
 *   taller content opens at half (medium) and expands to its own height or
 *   full height (large) (components/SheetDetents.ts).
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
  /**
   * Keeps the height it opened at while it's open, rather than following its
   * content: Text size, whose preview grows as the size changes (#867).
   */
  holdHeight?: boolean;
  /** Opens at its content's full height, up to large: Share the App, so the whole code shows. */
  openFull?: boolean;
  /** Centres the title, with a space opposite the X (always on iOS). */
  centeredTitle?: boolean;
  headerStyle?: StyleProp<ViewStyle>;
  headerTextScale?: TextScale;
  headerVariant?: 'headlineSmall' | 'titleLarge';
  /** Around the header, content and footer, such as the Bible's own padding. */
  contentStyle?: StyleProp<ViewStyle>;
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

// What each sheet last measured, so it opens at that height next time, and
// the room sheets have on this screen, by window size.
const lastDetents = new Map<string, SheetDetents>();
const lastFrames = new Map<string, SheetFrame>();

// How long a closing sheet's content stays, if the sheet never says it's gone.
const UNMOUNT_FALLBACK_MS = 1000;

function NativeSheet(props: AppSheetProps) {
  const { children, contentStyle, footer, holdHeight, onDismiss, openFull, testID, visible } = props;
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const platform: SheetPlatform = Platform.OS === 'android' ? 'android' : 'ios';
  // Android's sheet is in a window of its own, edge to edge: the screen's height.
  const sheetWindowHeight = platform === 'android' ? Dimensions.get('screen').height : windowHeight;
  // An iPad at a regular width shows Apple's centred form sheet, which the
  // system sizes: the detents apply only at a narrow width (Slide Over).
  const formSheet = Platform.OS === 'ios' && Platform.isPad && windowWidth >= 600;
  const frameKey = `${platform}:${Math.round(windowWidth)}x${Math.round(sheetWindowHeight)}`;
  const detentKey = `${testID ?? props.title}:${frameKey}`;

  const [mounted, setMounted] = useState(visible);
  const [detents, setDetents] = useState<SheetDetents>(
    () => lastDetents.get(detentKey) ?? DEFAULT_SHEET_DETENTS,
  );
  const [detentIndex, setDetentIndex] = useState(0);
  const [frame, setFrame] = useState<SheetFrame | null>(() => lastFrames.get(frameKey) ?? null);
  const held = useRef(false);
  const measured = useRef({ root: 0, viewport: 0, content: 0 });
  const [measureTick, setMeasureTick] = useState(0);

  // Opening: the content mounts, at the height it had last time.
  useEffect(() => {
    if (!visible) return;
    setMounted(true);
    setDetentIndex(0);
    held.current = false;
    measured.current = { root: 0, viewport: 0, content: 0 };
    setDetents(lastDetents.get(detentKey) ?? DEFAULT_SHEET_DETENTS);
    setFrame(lastFrames.get(frameKey) ?? null);
  }, [detentKey, frameKey, visible]);

  // Closing: the content stays until the sheet has gone.
  useEffect(() => {
    if (visible || !mounted) return;
    const timer = setTimeout(() => setMounted(false), UNMOUNT_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [mounted, visible]);

  const fitted = detents === 'fitToContents';
  const fractions = fitted ? null : (detents as readonly number[]);

  // The room the sheet has, from its container at a fraction's height, once
  // an opening: while it moves between detents the two can disagree.
  const onContainerLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!fractions || formSheet || frame) return;
      const height = event.nativeEvent.layout.height;
      if (!(height > 0)) return;
      const fraction =
        platform === 'android' ? fractions[fractions.length - 1] : fractions[Math.min(detentIndex, fractions.length - 1)];
      const largeHeight = getSheetLargeHeight(platform, height, fraction, sheetWindowHeight);
      const next = { platform, largeHeight, windowHeight: sheetWindowHeight };
      lastFrames.set(frameKey, next);
      setFrame(next);
    },
    [detentIndex, formSheet, fractions, frame, frameKey, platform, sheetWindowHeight],
  );

  const onRootLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    if (measured.current.root === height) return;
    measured.current.root = height;
    setMeasureTick((tick) => tick + 1);
  }, []);

  const reportScroll = useCallback((viewport: number, content: number) => {
    const current = measured.current;
    if (current.viewport === viewport && current.content === content) return;
    measured.current = { ...current, viewport, content };
    setMeasureTick((tick) => tick + 1);
  }, []);

  // The content's own height: everything around the scrolling part, plus all
  // of what scrolls.
  useEffect(() => {
    if (!visible || formSheet || held.current) return;
    const { root, viewport, content } = measured.current;
    if (!(root > 0) || !(content > 0) || !frame) return;
    const contentHeight = root - viewport + content;
    const next = getSheetDetents(contentHeight, frame, { fixed: holdHeight, full: openFull });
    if (holdHeight) held.current = true;
    lastDetents.set(detentKey, next);
    setDetents((current) => (sameSheetDetents(current, next) ? current : next));
  }, [detentKey, formSheet, frame, holdHeight, measureTick, openFull, visible]);

  const sheetContext = useMemo<SheetContextValue>(
    () => ({
      nestedScrollEnabled: platform === 'android',
      reportScroll,
      surfaceColor: theme.colors.floatingSurface,
    }),
    [platform, reportScroll, theme.colors.floatingSurface],
  );

  if (!mounted) return null;

  // On Android the sheet's content keeps its large height and the sheet
  // slides down to rest, so its foot would be off the screen at half height:
  // the content takes the height that shows.
  const restingHeight =
    platform === 'android' && fractions && frame
      ? getVisibleSheetHeight(frame, fractions[Math.min(detentIndex, fractions.length - 1)])
      : undefined;

  const content = (
    <View
      testID={testID}
      onLayout={onRootLayout}
      style={[
        styles.root,
        fitted ? { maxHeight: frame?.largeHeight } : restingHeight ? { height: restingHeight } : styles.fill,
        // iOS's sheet runs under the home indicator; Android's stops above
        // the navigation bar.
        platform === 'ios' && { paddingBottom: insets.bottom },
        contentStyle,
      ]}
    >
      <SheetHeader {...props} />
      <View style={fitted ? styles.bodyFitted : styles.body}>{children}</View>
      {footer}
    </View>
  );

  return (
    <FormSheet
      isOpen={visible}
      detents={formSheet ? [1] : fitted ? 'fitToContents' : [...(fractions ?? DEFAULT_SHEET_DETENTS)]}
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
  const { children, contentStyle, footer, onDismiss, testID, visible } = props;
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
        <View style={[styles.webRoot, contentStyle]}>
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
