import { UpdateContext } from '@/app/_layout';
import { AppIcon, type MaterialCommunityIconName } from '@/components/AppIcon';
import { CapsuleTabBar } from '@/components/CapsuleTabBar';
import { TABLET_TAB_BAR_MIN_WIDTH } from '@/components/TabBarItems';
import { GlobalHeader, UIStateContext } from '@/components/GlobalHeader';
import { LanguageContext } from '@/constants/LanguageContext';
import { APP_ICONOGRAPHY } from '@/constants/Iconography';
import {
  getBottomTabIconTextScale,
  scaleTypographyMetric,
  type TextScale,
} from '@/constants/AppPreferences';
import { BottomTabHeightContext, TabBarClearanceContext } from '@/constants/BottomTabHeightContext';
import { DESIGN_TOKENS, getBottomTabContentHeight } from '@/constants/Layout';
import { getBottomTabTextScale, HEADER_MAX_FONT_SCALE } from '@/hooks/useGlobalHeaderHeight';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import { Tabs, router } from 'expo-router';
import React, { useContext, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Platform, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The house fills less of its square than the cross, compass and person, so
 * it's drawn a tenth larger to look the same size beside them.
 */
const TAB_ICON_OPTICAL_SCALE: Partial<Record<MaterialCommunityIconName, number>> = { home: 1.1 };

function TabBarIcon(props: {
  name: MaterialCommunityIconName;
  color: string;
  focused: boolean;
  textScale: TextScale;
  tablet?: boolean;
}) {
  let iconName = props.name;

  // Logic to switch between solid and outline variants
  if (!props.focused) {
    iconName = `${props.name}-outline` as any;
  }

  return (
    <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
      <AppIcon
        name={iconName}
        // A little larger in a tablet's capsule (CapsuleTabBar).
        size={(props.tablet ? 30 : DESIGN_TOKENS.ICON_SIZE_TAB) * (TAB_ICON_OPTICAL_SCALE[props.name] ?? 1)}
        textScale={getBottomTabIconTextScale(props.textScale)}
        color={props.color}
      />
    </View>
  );
}

// One line in every language and at every text size (#380): the label follows
// the app's and the phone's text size only up to the tab bar's caps, so the
// longest label fits its tab. Android's adjustsFontSizeToFit ignores
// minimumFontScale and shrank the labels to dots, so it isn't used.
function TabBarLabel(props: {
  color: string;
  label: string;
  textScale: TextScale;
  tablet?: boolean;
}) {
  const labelScale = getBottomTabIconTextScale(props.textScale);
  // 12 points in a tablet's capsule, where there's room; 10 on a phone.
  const fontSize = props.tablet ? 12 : DESIGN_TOKENS.BOTTOM_TAB_LABEL_FONT_SIZE;
  const lineHeight = props.tablet ? 18 : DESIGN_TOKENS.BOTTOM_TAB_LABEL_LINE_HEIGHT;
  return (
    <Text
      maxFontSizeMultiplier={HEADER_MAX_FONT_SCALE}
      numberOfLines={1}
      style={{
        color: props.color,
        flexShrink: 1,
        fontSize: scaleTypographyMetric(fontSize, labelScale),
        lineHeight: scaleTypographyMetric(lineHeight, labelScale),
        paddingBottom: DESIGN_TOKENS.BOTTOM_TAB_LABEL_BOTTOM_PADDING,
        textAlign: 'center',
        width: '100%',
      }}
    >
      {props.label}
    </Text>
  );
}

export default function TabLayout() {
  const theme = useAppTheme();
  const { textScale } = useTextSize();
  const { fontScale, width: windowWidth } = useWindowDimensions();
  const tabContentHeight = getBottomTabContentHeight(getBottomTabTextScale(textScale, fontScale));
  const { language } = useContext(LanguageContext);
  const { onPassiveCheck } = useContext(UpdateContext);
  const insets = useSafeAreaInsets();
  const isFullscreenWeb =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: fullscreen)').matches;
  const fullscreenEdgeInset = isFullscreenWeb ? 12 : 0;
  // The safe area's bottom inset; the capsule keeps its own gap from it
  // (getCapsuleBottomGap), wholly above Android's gesture bar or buttons.
  const bottomTabInset = Math.max(insets.bottom, fullscreenEdgeInset);
  const [tabBarHeight, setTabBarHeight] = useState(
    tabContentHeight + bottomTabInset,
  );

  // Reader Mode state shared with child screens
  const menuAnim = useRef(new Animated.Value(1)).current;
  const [bibleControlsStacked, setBibleControlsStacked] = useState(false);
  const isMenuVisible = useRef(true);

  const setMenuVisible = (visible: boolean) => {
    if (visible === isMenuVisible.current) return;
    isMenuVisible.current = visible;

    Animated.timing(menuAnim, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };



  const handleTabBarLayout = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    setTabBarHeight((currentHeight) =>
      currentHeight === nextHeight ? currentHeight : nextHeight,
    );
  };

  const allLabels = {
    en: {
      home: 'Home',
      bible: 'Bible',
      explore: 'Explore',
      you: 'You',
    },
    zh: {
      home: '首頁',
      bible: '聖經',
      explore: '探索',
      you: '您',
    },
    'zh-cn': {
      home: '首页',
      bible: '圣经',
      explore: '探索',
      you: '您',
    },
    es: {
      home: 'Inicio',
      bible: 'Biblia',
      explore: 'Explorar',
      you: 'Tú',
    },
  };

  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;
  // One floating tab bar on every system (#589): a capsule that pages run
  // under, with slightly larger tabs on a tablet.
  const tablet = windowWidth >= TABLET_TAB_BAR_MIN_WIDTH;
  // Far enough down to hide the bar, by its measured height.
  const tabBarTranslateY = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [tabBarHeight + 16, 0],
  });
  return (
    <BottomTabHeightContext.Provider value={tabBarHeight}>
      <TabBarClearanceContext.Provider value={tabBarHeight}>
      <UIStateContext.Provider
        value={{ menuAnim, setMenuVisible, bibleControlsStacked, setBibleControlsStacked }}
      >
        <Tabs
        screenListeners={{
          tabPress: () => {
            // A deliberate press on any main tab checks the small versioned
            // service worker source without waiting for the resume cooldown.
            void onPassiveCheck();
          },
        }}
        tabBar={(props) => (
          <Animated.View
            onLayout={handleTabBarLayout}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              transform: [{ translateY: tabBarTranslateY }],
            }}
          >
            <CapsuleTabBar
              {...props}
              bottomInset={bottomTabInset}
              theme={theme}
              windowWidth={windowWidth}
            />
          </Animated.View>
        )}
        screenOptions={{
          // The selected tab in blue, or gold in the dark theme, on its
          // selection pill (getSelectedTabTint, #589); the others in the
          // theme's muted ink, which reads on the dark theme's blue bar.
          tabBarActiveTintColor: theme.dark
            ? theme.colors.metallicGold.main
            : theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
          headerTransparent: true,
          header: (props) => <GlobalHeader {...props} />,
          // The animated tab bar is absolutely positioned, so React Navigation
          // doesn't reserve space for it: pages run under the floating capsule to
          // the bottom edge, and TabBarSpacer leaves room at their ends.
          sceneStyle: {
            paddingBottom: 0,
            backgroundColor: theme.colors.background,
          },
        }}
      >
        {/* 1. Main Home Screen */}
        <Tabs.Screen
          name="index"
          options={{
            title: labels.home,
            headerShown: true,
            tabBarLabel: ({ color }) => (
              <TabBarLabel
                color={String(color)}
                label={labels.home}
                textScale={textScale}
                tablet={tablet}
              />
            ),
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                name="home"
                color={String(color)}
                focused={focused}
                textScale={textScale}
                tablet={tablet}
              />
            ),
          }}
        />

        {/* 2. Hidden Home Sub-Pages Folder */}
        <Tabs.Screen
          name="home"
          options={{
            // Expo Router 58 redirects a focused `href: null` route to the
            // first visible tab. Keep this nested stack registered and hide
            // only its button so `/home/*` destinations remain navigable.
            headerShown: false,
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />

        <Tabs.Screen
          name="bible"
          options={{
            title: labels.bible,
            headerShown: false, // Internal Stack handles header for consistency
            tabBarLabel: ({ color }) => (
              <TabBarLabel
                color={String(color)}
                label={labels.bible}
                textScale={textScale}
                tablet={tablet}
              />
            ),
            // The Bible reader owns a coordinated bottom dock and already accounts
            // for the tab bar height while its controls animate in and out.
            sceneStyle: { paddingBottom: 0 },
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                name="cross"
                color={String(color)}
                focused={focused}
                textScale={textScale}
                tablet={tablet}
              />
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              router.navigate('/bible');
            },
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: labels.explore,
            headerShown: false, // Internal Stack handles header for consistency
            tabBarLabel: ({ color }) => (
              <TabBarLabel
                color={String(color)}
                label={labels.explore}
                textScale={textScale}
                tablet={tablet}
              />
            ),
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                name={APP_ICONOGRAPHY.tabs.explore.name}
                color={String(color)}
                focused={focused}
                textScale={textScale}
                tablet={tablet}
              />
            ),
          }}
          listeners={{
            tabPress: (event) => {
              event.preventDefault();
              router.navigate('/explore');
            },
          }}
        />
        <Tabs.Screen
          name="sabbath-school"
          options={{
            // This is a navigable screen outside the visible tab set. Using
            // `href: null` here triggers Expo Router 58's hidden-route
            // redirect back to Home before the screen can mount.
            headerShown: true,
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="you"
          options={
            {
              title: labels.you,
              headerShown: false, // Internal Stack handles header for consistency
              tabBarLabel: ({ color }: { color: string }) => (
                <TabBarLabel
                  color={color}
                  label={labels.you}
                  textScale={textScale}
                  tablet={tablet}
                />
              ),
              unmountOnBlur: true as any, // Ensures the stack resets when leaving the tab
              tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
                <TabBarIcon
                  name="account-circle"
                  color={color}
                  focused={focused}
                  textScale={textScale}
                  tablet={tablet}
                />
              ),
            } as any
          }
          listeners={{
            tabPress: (e) => {
              // Ensure the You stack resets to its root whenever the tab is pressed.
              // This solves the "stuck" state after navigating to sub-pages from Home.
              e.preventDefault();
              router.navigate('/you');
            },
          }}
        />
        </Tabs>
      </UIStateContext.Provider>
      </TabBarClearanceContext.Provider>
    </BottomTabHeightContext.Provider>
  );
}
