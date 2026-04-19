import { StatusBar } from "expo-status-bar";
import React, { useContext } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Divider, List, RadioButton, Text } from "react-native-paper";
import { LanguageContext } from "./_layout";

export default function LanguageScreen() {
  const { language, setLanguage } = useContext(LanguageContext);

  const labels = {
    en: { title: "Settings", subheader: "Language" },
    zh: { title: "設定", subheader: "語言" },
    "zh-cn": { title: "设置", subheader: "语言" },
    es: { title: "Ajustes", subheader: "Idioma" },
  }[language as "en" | "zh" | "zh-cn" | "es"] || {
    title: "Settings",
    subheader: "Language",
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        {labels.title}
      </Text>

      <List.Section>
        <List.Subheader>{labels.subheader}</List.Subheader>
        <List.Item
          title="English"
          onPress={() => setLanguage("en")}
          right={() => (
            <RadioButton
              value="en"
              status={language === "en" ? "checked" : "unchecked"}
              onPress={() => setLanguage("en")}
            />
          )}
        />
        <Divider />
        <List.Item
          title="繁體中文 (Traditional Chinese)"
          onPress={() => setLanguage("zh")}
          right={() => (
            <RadioButton
              value="zh"
              status={language === "zh" ? "checked" : "unchecked"}
              onPress={() => setLanguage("zh")}
            />
          )}
        />
        <Divider />
        <List.Item
          title="简体中文 (Simplified Chinese)"
          onPress={() => setLanguage("zh-cn")}
          right={() => (
            <RadioButton
              value="zh-cn"
              status={language === "zh-cn" ? "checked" : "unchecked"}
              onPress={() => setLanguage("zh-cn")}
            />
          )}
        />
        <Divider />
        <List.Item
          title="Español (Spanish)"
          onPress={() => setLanguage("es")}
          right={() => (
            <RadioButton
              value="es"
              status={language === "es" ? "checked" : "unchecked"}
              onPress={() => setLanguage("es")}
            />
          )}
        />
      </List.Section>

      {/* Use a light status bar on iOS to account for the black space above the modal */}
      <StatusBar style={Platform.OS === "ios" ? "light" : "auto"} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
  },
  title: {
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
});
