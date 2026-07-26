import { GlobalHeader, UIStateContext } from '@/components/GlobalHeader';
import { LanguageContext } from '@/constants/LanguageContext';
import { DESIGN_TOKENS } from '@/constants/Layout';
import { useAppTheme } from '@/constants/Themes';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { Tabs, router } from 'expo-router';
import React, { useContext, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  color: string;
  focused: boolean;
}) {
  let iconName = props.name;

  // Logic to switch between solid and outline variants
  if (!props.focused) {
    iconName = `${props.name}-outline` as any;
  }

  return (
    <MaterialCommunityIcons
      name={iconName}
      size={DESIGN_TOKENS.ICON_SIZE_TAB}
      style={{ marginBottom: -3 }}
      color={props.color}
    />
  );
}

export default function TabLayout() {
  const theme = useAppTheme();
  const { language } = useContext(LanguageContext);
  const insets = useSafeAreaInsets();
  const [tabBarHeight, setTabBarHeight] = useState(49 + insets.bottom);

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
    outputRange: [120, 0],
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
      resources: 'Resources',
      you: 'You',
    },
    zh: {
      home: '首頁',
      bible: '聖經',
      resources: '資源庫',
      you: '您',
    },
    'zh-cn': {
      home: '首页',
      bible: '圣经',
      resources: '资源库',
      you: '您',
    },
    es: {
      home: 'Inicio',
      bible: 'Biblia',
      resources: 'Recursos',
      you: 'Tú',
    },
  };

  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;

  return (
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
            tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
              <TabBarIcon name="home" color={color} focused={focused} />
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
            // The Bible reader owns a coordinated bottom dock and already accounts
            // for the tab bar height while its controls animate in and out.
            sceneStyle: { paddingBottom: 0 },
            tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
              <TabBarIcon name="cross" color={color} focused={focused} />
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
            tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
              <TabBarIcon name="bookmark-multiple" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="you"
          options={
            {
              title: labels.you,
              headerShown: false, // Internal Stack handles header for consistency
              unmountOnBlur: true as any, // Ensures the stack resets when leaving the tab
              tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
                <TabBarIcon name="account-circle" color={color} focused={focused} />
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
  );
}
