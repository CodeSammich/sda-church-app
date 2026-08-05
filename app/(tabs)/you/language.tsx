import { MenuCard } from "@/components/MenuCard";
import { LanguageContext } from "@/constants/LanguageContext";
import { useAppTheme } from "@/constants/Themes";
import { useGlobalHeaderHeight } from "@/hooks/useGlobalHeaderHeight";
import { useNavigationStyles } from "@/styles/NavigationStyles";
import { Stack, useLocalSearchParams } from "expo-router";
import { useContext } from "react";
import { ScrollView } from "react-native";
import { List } from "react-native-paper";

export default function LanguageScreen() {
  const { language, setLanguage } = useContext(LanguageContext);
  const { backTo } = useLocalSearchParams();
  const theme = useAppTheme();
  const NavigationStyles = useNavigationStyles();
  const headerHeight = useGlobalHeaderHeight();

  const allLabels = {
    en: { title: "Language" },
    zh: { title: "語言" },
    "zh-cn": { title: "语言" },
    es: { title: "Idioma" },
  };

  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;

  return (
    <>
      <Stack.Screen options={{ title: labels.title, backTo } as any} />
      <ScrollView
        style={NavigationStyles.container}
        contentContainerStyle={[
          NavigationStyles.contentContainer,
          { paddingTop: headerHeight },
        ]}
      >
        <List.Section>
          <MenuCard
            title="English"
            icon="translate"
            onPress={() => setLanguage("en")}
            rightIcon={language === "en" ? "radiobox-marked" : "radiobox-blank"}
          />
          <MenuCard
            title="繁體中文 (Traditional Chinese)"
            icon="translate"
            onPress={() => setLanguage("zh")}
            rightIcon={language === "zh" ? "radiobox-marked" : "radiobox-blank"}
          />
          <MenuCard
            title="简体中文 (Simplified Chinese)"
            icon="translate"
            onPress={() => setLanguage("zh-cn")}
            rightIcon={
              language === "zh-cn" ? "radiobox-marked" : "radiobox-blank"
            }
          />
          <MenuCard
            title="Español (Spanish)"
            icon="translate"
            onPress={() => setLanguage("es")}
            rightIcon={language === "es" ? "radiobox-marked" : "radiobox-blank"}
          />
        </List.Section>
      </ScrollView>
    </>
  );
}
