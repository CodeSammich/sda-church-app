import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs } from "expo-router";
import React, { useContext } from "react";

import { useClientOnlyValue } from "@/components/useClientOnlyValue";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { LanguageContext } from "../_layout";

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { language } = useContext(LanguageContext);

  const labels = {
    en: {
      home: "Home",
      sermons: "Sermons",
      calendar: "Calendar",
      more: "More",
    },
    zh: {
      home: "主頁",
      sermons: "講道回顧",
      calendar: "教會日曆",
      more: "更多",
    },
    "zh-cn": {
      home: "首页",
      sermons: "讲道回顾",
      calendar: "教会日历",
      more: "更多",
    },
    es: {
      home: "Inicio",
      sermons: "Sermones",
      calendar: "Calendario",
      more: "Más",
    },
  }[language as "en" | "zh" | "zh-cn" | "es"] || {
    home: "Home",
    sermons: "Sermons",
    calendar: "Calendar",
    more: "More",
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: labels.home,
          headerShown: false,
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="sermons"
        options={{
          title: labels.sermons,
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="play-circle" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: labels.calendar,
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="calendar" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: labels.more,
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="ellipsis-h" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
