import { GlobalHeader, UIStateContext } from '@/components/GlobalHeader';
import { AppIcon, type MaterialCommunityIconName } from '@/components/AppIcon';
import { LanguageContext } from '@/constants/LanguageContext';
import { APP_ICONOGRAPHY } from '@/constants/Iconography';
import {
  getBottomTabIconTextScale,
  scaleTypographyMetric,
  type TextScale,
} from '@/constants/AppPreferences';
import { BottomTabHeightContext } from '@/constants/BottomTabHeightContext';
import {
  DESIGN_TOKENS,
  getBottomTabContentHeight,
  getMeasuredTextLineCount,
} from '@/constants/Layout';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { Tabs, router } from 'expo-router';
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
    <AppIcon
      name={iconName}
      size={DESIGN_TOKENS.ICON_SIZE_TAB}
      textScale={getBottomTabIconTextScale(props.textScale)}
      style={{ marginBottom: -3 }}
      color={props.color}
    />
  );
}

function TabBarLabel(props: {
  color: string;
  fontScale: number;
  label: string;
  onLineCountChange: (lineCount: number) => void;
  textScale: TextScale;
}) {
  const lineHeight = scaleTypographyMetric(
    DESIGN_TOKENS.BOTTOM_TAB_LABEL_LINE_HEIGHT,
    props.textScale,
  );
  const measuredLineHeight = lineHeight * Math.max(1, props.fontScale);
  return (
    <Text
      onLayout={(event) =>
        props.onLineCountChange(
          getMeasuredTextLineCount(
            event.nativeEvent.layout.height,
            measuredLineHeight,
          ),
        )
      }
      style={{
        color: props.color,
        flexShrink: 1,
        fontSize: scaleTypographyMetric(
          DESIGN_TOKENS.BOTTOM_TAB_LABEL_FONT_SIZE,
          props.textScale,
        ),
        lineHeight,
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
  const { fontScale } = useWindowDimensions();
  const [tabLabelLineCounts, setTabLabelLineCounts] = useState<
    Record<string, number>
  >({});
  const maxTabLabelLines = Math.max(
    1,
    ...Object.values(tabLabelLineCounts),
  );
  const tabContentHeight = getBottomTabContentHeight(
    Math.max(1, fontScale * textScale),
    maxTabLabelLines,
  );
  const { language } = useContext(LanguageContext);
  const insets = useSafeAreaInsets();
  const isFullscreenWeb =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: fullscreen)').matches;
  const fullscreenEdgeInset = isFullscreenWeb ? 12 : 0;
  const bottomTabInset = Math.max(insets.bottom, fullscreenEdgeInset);
  const [tabBarHeight, setTabBarHeight] = useState(
    tabContentHeight + bottomTabInset,
  );

  // Reader Mode state shared with child screens
  const menuAnim = useRef(new Animated.Value(1)).current;
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

  const reportTabLabelLines = (tabName: string, lineCount: number) => {
    setTabLabelLineCounts((currentCounts) =>
      currentCounts[tabName] === lineCount
        ? currentCounts
        : { ...currentCounts, [tabName]: lineCount },
    );
  };

  const allLabels = {
    en: {
      home: 'Home',
      bible: 'Bible',
      resources: 'Explore',
      you: 'You',
    },
    zh: {
      home: '首頁',
      bible: '聖經',
      resources: '探索',
      you: '您',
    },
    'zh-cn': {
      home: '首页',
      bible: '圣经',
      resources: '探索',
      you: '您',
    },
    es: {
      home: 'Inicio',
      bible: 'Biblia',
      resources: 'Explorar',
      you: 'Tú',
    },
  };

  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;

  return (
    <BottomTabHeightContext.Provider value={tabBarHeight}>
      <UIStateContext.Provider value={{ menuAnim, setMenuVisible }}>
        <Tabs
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
            <BottomTabBar {...props} />
          </Animated.View>
        )}
        screenOptions={{
          tabBarActiveTintColor: theme.colors.onBackground,
          tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
          headerTransparent: true,
          header: (props) => <GlobalHeader {...props} />,
          tabBarStyle: {
            height: tabContentHeight + bottomTabInset,
            paddingBottom: bottomTabInset,
            paddingHorizontal: fullscreenEdgeInset,
            elevation: 0,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
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
          sceneStyle: { paddingBottom: tabBarHeight },
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
                color={color}
                fontScale={fontScale}
                label={labels.home}
                onLineCountChange={(lineCount) =>
                  reportTabLabelLines('home', lineCount)
                }
                textScale={textScale}
              />
            ),
            tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
              <TabBarIcon
                name="home"
                color={color}
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
            href: null, // This hides it from the bottom bar completely!
            headerShown: false,
          }}
        />

        <Tabs.Screen
          name="bible"
          options={{
            title: labels.bible,
            headerShown: false, // Internal Stack handles header for consistency
            tabBarLabel: ({ color }) => (
              <TabBarLabel
                color={color}
                fontScale={fontScale}
                label={labels.bible}
                onLineCountChange={(lineCount) =>
                  reportTabLabelLines('bible', lineCount)
                }
                textScale={textScale}
              />
            ),
            // The Bible reader owns a coordinated bottom dock and already accounts
            // for the tab bar height while its controls animate in and out.
            sceneStyle: { paddingBottom: 0 },
            tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
              <TabBarIcon
                name="cross"
                color={color}
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
          name="resources"
          options={{
            title: labels.resources,
            headerShown: false, // Internal Stack handles header for consistency
            tabBarLabel: ({ color }) => (
              <TabBarLabel
                color={color}
                fontScale={fontScale}
                label={labels.resources}
                onLineCountChange={(lineCount) =>
                  reportTabLabelLines('resources', lineCount)
                }
                textScale={textScale}
              />
            ),
            tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
              <TabBarIcon
                name={APP_ICONOGRAPHY.tabs.explore.name}
                color={color}
                focused={focused}
                textScale={textScale}
              />
            ),
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
                  fontScale={fontScale}
                  label={labels.you}
                  onLineCountChange={(lineCount) =>
                    reportTabLabelLines('you', lineCount)
                  }
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
