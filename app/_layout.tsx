import { useColorScheme } from "@/components/useColorScheme";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavDefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { createContext, useEffect, useState } from "react";
import {
  MD3DarkTheme,
  MD3LightTheme,
  PaperProvider,
  adaptNavigationTheme,
} from "react-native-paper";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on `/language` keeps a back button present.
  initialRouteName: "(tabs)",
};

// Simple Language Context
export const LanguageContext = createContext({
  language: "en",
  setLanguage: (lang: string) => {},
});

// Adapt themes for React Navigation compatibility
const { LightTheme, DarkTheme } = adaptNavigationTheme({
  reactNavigationLight: NavDefaultTheme,
  reactNavigationDark: NavDarkTheme,
});

const customLightTheme = {
  ...MD3LightTheme,
  version: 3,
  isV3: true,
  colors: {
    ...MD3LightTheme.colors,
    ...LightTheme.colors,
  },
  roundness: 3,
};
const customDarkTheme = {
  ...MD3DarkTheme,
  version: 3,
  isV3: true,
  colors: {
    ...MD3DarkTheme.colors,
    ...DarkTheme.colors,
  },
  roundness: 3,
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [language, setLanguage] = useState("en");
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) {
      console.error("Font loading error:", error);
      // Even if fonts fail, we should eventually hide the splash screen
      SplashScreen.hideAsync();
    }
  }, [error]);

  useEffect(() => {
    if (loaded) {
      // Optional: Add a very small delay if the transition feels too abrupt
      const timeout = setTimeout(() => SplashScreen.hideAsync(), 200);
      return () => clearTimeout(timeout);
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      <RootLayoutNav />
    </LanguageContext.Provider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <PaperProvider
        theme={colorScheme === "dark" ? customDarkTheme : customLightTheme}
      >
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : LightTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="language" options={{ presentation: "modal" }} />
          </Stack>
        </ThemeProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
