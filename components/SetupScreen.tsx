import { PopupScrollView } from '@/components/PopupScrollView';
import { TABLET_MIN_SCREEN_SIDE } from '@/constants/AppPreferences';
import { LanguageContext, type SupportedLanguage } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The words on setup's buttons and its step dots, in each language. First-
 * launch setup ends on Get Started; the contrast question after an update
 * (#708) ends on Done, since members who see it have already started.
 */
const SETUP_WORDS: Record<
  SupportedLanguage,
  { back: string; done: string; next: string; start: string; step: (step: number, steps: number) => string }
> = {
  en: {
    back: 'Back',
    done: 'Done',
    next: 'Next',
    start: 'Get Started',
    step: (step, steps) => `Step ${step} of ${steps}`,
  },
  zh: {
    back: '上一步',
    done: '完成',
    next: '下一步',
    start: '開始使用',
    step: (step, steps) => `第 ${step} 步，共 ${steps} 步`,
  },
  'zh-cn': {
    back: '上一步',
    done: '完成',
    next: '下一步',
    start: '开始使用',
    step: (step, steps) => `第 ${step} 步，共 ${steps} 步`,
  },
  es: {
    back: 'Atrás',
    done: 'Listo',
    next: 'Siguiente',
    start: 'Comenzar',
    step: (step, steps) => `Paso ${step} de ${steps}`,
  },
};

export const getSetupWords = (language: string) => SETUP_WORDS[language as SupportedLanguage] ?? SETUP_WORDS.en;

// A tablet's or a landscape phone's steps sit in a centred column, at most
// this wide, inside 24 points a side.
const SETUP_COLUMN_MAX_WIDTH = 560;
// The scrolling part's top and bottom padding, styles.content's.
const CONTENT_PADDING = 32 + 16;

/**
 * The height a step has above the footer without scrolling, or null outside
 * a setup screen, so a step can pick a layout that fits, as ContrastStep does.
 */
export const SetupRoomContext = createContext<number | null>(null);

/**
 * The whole screen (#681), in the page's colour, one step at a time, with the
 * step dots and the buttons at the bottom, where a thumb finds them. First-
 * launch setup's steps and the contrast question after an update (#708) use
 * it, so both look and go on alike. The buttons go on; a tap on a choice only
 * chooses it. It can't be dismissed: Back on Android does nothing.
 */
export function SetupScreen({
  actions,
  children,
  scrollKey,
  step,
  steps,
}: Readonly<{
  /** The buttons along the bottom, SetupActions placed to fill the row. */
  actions: ReactNode;
  children: ReactNode;
  /** Changes with each step, so each opens at its top. */
  scrollKey: string;
  step: number;
  steps: number;
}>) {
  const { language } = useContext(LanguageContext);
  const words = getSetupWords(language);
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const [room, setRoom] = useState(0);
  // On a tablet, a step sits in the middle of the space above Back and Next,
  // rather than at the top of a tall, mostly empty screen. On a phone it stays
  // at the top, so each step's title is where the last one's was.
  const tablet = Math.min(viewportWidth, viewportHeight) >= TABLET_MIN_SCREEN_SIDE;
  // The progress dots' colour: the theme's blue, or gold in the dark theme,
  // like the selected tab.
  const accent = theme.dark ? theme.colors.metallicGold.main : theme.colors.primary;
  const column = {
    alignSelf: 'center' as const,
    width: Math.max(0, Math.min(SETUP_COLUMN_MAX_WIDTH, viewportWidth - insets.left - insets.right - 48)),
  };

  return (
    // Every orientation, or iOS would turn an iPad held sideways to portrait.
    <Modal
      visible
      animationType="fade"
      onRequestClose={() => undefined}
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <View
        style={[
          styles.screen,
          {
            backgroundColor: theme.colors.background,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
            paddingTop: insets.top,
          },
        ]}
      >
        {/* Keyed by step, so each step opens at its top. It fills the screen
            above the footer, so the buttons stay at the bottom on every step. */}
        <PopupScrollView
          key={scrollKey}
          frameStyle={styles.scroll}
          contentContainerStyle={[styles.content, tablet && styles.centredContent]}
          onLayout={(event) => setRoom(Math.max(0, event.nativeEvent.layout.height - CONTENT_PADDING))}
        >
          <SetupRoomContext.Provider value={room}>
            <View style={column}>{children}</View>
          </SetupRoomContext.Provider>
        </PopupScrollView>

        {/* Outside the scrolling part, so the way on is always in view. */}
        <View style={[styles.footer, column]}>
          <View accessible accessibilityLabel={words.step(step + 1, steps)} style={styles.dots}>
            {Array.from({ length: steps }, (_, index) => (
              // Each step's dot is outlined in the accent, so the ones ahead
              // show plainly; the current one is filled and wider (#681).
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    backgroundColor: index === step ? accent : 'transparent',
                    borderColor: accent,
                    width: index === step ? 32 : 14,
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.actions}>{actions}</View>
        </View>
      </View>
    </Modal>
  );
}

/** A step's large title, and the line under it. */
export function SetupHeading({ subtitle, title }: Readonly<{ subtitle: string; title: string }>) {
  return (
    <>
      <Text variant="headlineLarge" style={styles.title}>
        {title}
      </Text>
      <Text variant="bodyLarge" style={styles.subtitle}>
        {subtitle}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingTop: 32,
    paddingBottom: 16,
  },
  centredContent: {
    justifyContent: 'center',
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: 24,
    opacity: 0.75,
    textAlign: 'center',
  },
  footer: {
    gap: 16,
    paddingBottom: 16,
    paddingTop: 8,
  },
  dots: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    borderRadius: 7,
    borderWidth: 2,
    height: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
});
