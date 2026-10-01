import { UpdateContext } from '@/app/_layout';
import { AppIcon, type MaterialCommunityIconName } from '@/components/AppIcon';
import { GlobalHeader, UIStateContext } from '@/components/GlobalHeader';
import { LanguageContext } from '@/constants/LanguageContext';
import { APP_ICONOGRAPHY } from '@/constants/Iconography';
import {
  getBottomTabIconTextScale,
  scaleTypographyMetric,
  type TextScale,
} from '@/constants/AppPreferences';
import { BottomTabHeightContext } from '@/constants/BottomTabHeightContext';
import { DESIGN_TOKENS, getBottomTabContentHeight } from '@/constants/Layout';
import { getBottomTabTextScale, HEADER_MAX_FONT_SCALE } from '@/hooks/useGlobalHeaderHeight';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import { BottomTabBar } from 'expo-router/js-tabs';
import { Tabs, router, usePathname } from 'expo-router';
import React, { useContext, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function TabBarIcon(props: {
  name: MaterialCommunityIconName;
  color: string;
  focused: boolean;
  textScale: TextScale;
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
        size={DESIGN_TOKENS.ICON_SIZE_TAB}
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
}) {
  const labelScale = getBottomTabIconTextScale(props.textScale);
  return (
    <Text
      maxFontSizeMultiplier={HEADER_MAX_FONT_SCALE}
      numberOfLines={1}
      style={{
        color: props.color,
        flexShrink: 1,
        fontSize: scaleTypographyMetric(DESIGN_TOKENS.BOTTOM_TAB_LABEL_FONT_SIZE, labelScale),
        lineHeight: scaleTypographyMetric(DESIGN_TOKENS.BOTTOM_TAB_LABEL_LINE_HEIGHT, labelScale),
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
  const pathname = usePathname();
  const { textScale } = useTextSize();
  const { fontScale } = useWindowDimensions();
  const tabContentHeight = getBottomTabContentHeight(getBottomTabTextScale(textScale, fontScale));
  const { language } = useContext(LanguageContext);
  const { onPassiveCheck } = useContext(UpdateContext);
  const insets = useSafeAreaInsets();
  const isFullscreenWeb =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: fullscreen)').matches;
  const fullscreenEdgeInset = isFullscreenWeb ? 12 : 0;
  // Android's rounded/gesture edge can sit just beyond the reported inset at
  // enlarged text sizes. Keep the tab row visibly above that physical edge.
  const bottomTabInset =
    Math.max(insets.bottom, fullscreenEdgeInset) + (Platform.OS === 'android' ? 8 : 0);
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

  const tabBarTranslateY = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [tabContentHeight + bottomTabInset + 16, 0],
  });

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
  // The Bible's fixed reader dock owns the upper boundary on this tab. Keep
  // this broad enough for native/router variants that expose `/bible/index`.
  const isBibleRoute = pathname === '/bible' || pathname.startsWith('/bible/');

  return (
    <BottomTabHeightContext.Provider value={tabBarHeight}>
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
            <BottomTabBar {...(props as any)} />
          </Animated.View>
        )}
        screenOptions={{
          tabBarActiveTintColor: theme.dark
            ? theme.colors.metallicGold.main
            : theme.colors.onBackground,
          tabBarInactiveTintColor: theme.dark
            ? theme.colors.metallicGold.muted
            : theme.colors.onSurfaceVariant,
          headerTransparent: true,
          header: (props) => <GlobalHeader {...props} />,
          tabBarStyle: {
            height: tabContentHeight + bottomTabInset + 4,
            paddingTop: 4,
            paddingBottom: bottomTabInset,
            paddingHorizontal: fullscreenEdgeInset,
            elevation: 0,
            backgroundColor: 'transparent',
            borderTopColor: isBibleRoute
              ? 'transparent'
              : theme.colors.outlineVariant,
            borderTopWidth: isBibleRoute ? 0 : StyleSheet.hairlineWidth,
          },
          tabBarItemStyle: {
            flex: 1,
            minWidth: 0,
            overflow: 'visible',
          },
          tabBarBackground: () => (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: theme.colors.background },
              ]}
            />
          ),
          // The animated tab bar is absolutely positioned, so React Navigation cannot
          // reserve space for it. Keep every regular tab screen above the overlay.
          sceneStyle: {
            paddingBottom: tabBarHeight,
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
              />
            ),
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                name="home"
                color={String(color)}
                focused={focused}
                textScale={textScale}
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
              />
            ),
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                name={APP_ICONOGRAPHY.tabs.explore.name}
                color={String(color)}
                focused={focused}
                textScale={textScale}
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
                />
              ),
              unmountOnBlur: true as any, // Ensures the stack resets when leaving the tab
              tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
                <TabBarIcon
                  name="account-circle"
                  color={color}
                  focused={focused}
                  textScale={textScale}
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
    </BottomTabHeightContext.Provider>
  );
}
