import { router } from "expo-router";
import React, { useContext } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { Appbar, Button, Card, List, Text, useTheme } from "react-native-paper";
import { LanguageContext } from "../_layout";

export default function TabOneScreen() {
  const theme = useTheme();
  const { language } = useContext(LanguageContext);

  const content =
    {
      en: {
        header: "SDA Church",
        streamTitle: "Sabbath Livestream",
        streamDesc: "Join us live every Saturday at 11:00 AM",
        watch: "Watch Now",
        bulletin: "Weekly Bulletin",
        date: "Saturday, Oct 26",
        bulletinDesc:
          'Join us for our divine service this Sabbath. Our guest speaker will be sharing a message on "Faith in Action".',
        view: "View Program",
        resources: "Resources",
        giving: "Online Giving",
        prayer: "Prayer Request",
      },
      zh: {
        header: "基督復臨安息日會",
        streamTitle: "安息日崇拜直播",
        streamDesc: "請於每週六上午 11:00 參加我們的直播",
        watch: "現在收看",
        bulletin: "每週週報",
        date: "10月26日 星期六",
        bulletinDesc:
          "誠邀您在本安息日參加我們的崇拜聚會。我們的客座講員將分享題目為「信心與行動」的信息。",
        view: "查看程序表",
        resources: "資源",
        giving: "網上捐款",
        prayer: "代禱請求",
      },
      "zh-cn": {
        header: "基督复临安息日会",
        streamTitle: "安息日崇拜直播",
        streamDesc: "请于每周六上午 11:00 参加我们的直播",
        watch: "现在收看",
        bulletin: "每周周报",
        date: "10月26日 星期六",
        bulletinDesc:
          "诚邀您在本安息日参加我们的崇拜聚会。我们的客座讲员将分享题目为「信心与行动」的信息。",
        view: "查看程序表",
        resources: "资源",
        giving: "网上捐款",
        prayer: "代祷请求",
      },
      es: {
        header: "Iglesia ASD",
        streamTitle: "Transmisión en vivo",
        streamDesc: "Únete a nosotros todos los sábados a las 11:00 AM",
        watch: "Ver ahora",
        bulletin: "Boletín semanal",
        date: "Sábado, 26 de oct",
        bulletinDesc:
          'Únete a nosotros para el culto de este sábado. Nuestro orador invitado compartirá un mensaje sobre "Fe en acción".',
        view: "Ver programa",
        resources: "Recursos",
        giving: "Donaciones en línea",
        prayer: "Petición de oración",
      },
    }[language as "en" | "zh" | "zh-cn" | "es"] || {};

  return (
    <>
      <Appbar.Header elevated>
        <Appbar.Content title={content.header} />
        <Appbar.Action
          icon="translate"
          onPress={() => router.push("/language")}
        />
      </Appbar.Header>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Livestream Priority Section */}
        <Card
          style={[
            styles.card,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
          mode="contained"
        >
          <Card.Content>
            <Text
              variant="titleMedium"
              style={{
                color: theme.colors.onPrimaryContainer,
                fontWeight: "bold",
              }}
            >
              {content.streamTitle}
            </Text>
            <Text
              variant="bodySmall"
              style={{
                color: theme.colors.onPrimaryContainer,
                marginBottom: 12,
              }}
            >
              {content.streamDesc}
            </Text>
            <Button
              mode="contained"
              icon="video"
              onPress={() => {
                /* Link to livestream */
              }}
              style={{ backgroundColor: theme.colors.primary }}
            >
              {content.watch}
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.card} mode="elevated">
          <Card.Cover source={{ uri: "https://picsum.photos/700" }} />
          <Card.Title title={content.bulletin} subtitle={content.date} />
          <Card.Content>
            <Text variant="bodyMedium">{content.bulletinDesc}</Text>
          </Card.Content>
          <Card.Actions>
            <Button mode="contained-tonal">{content.view}</Button>
          </Card.Actions>
        </Card>

        <Text variant="titleMedium" style={styles.sectionTitle}>
          {content.resources}
        </Text>
        <List.Item
          title={content.giving}
          left={(props) => <List.Icon {...props} icon="heart" />}
          onPress={() => {}}
        />
        <List.Item
          title={content.prayer}
          left={(props) => <List.Icon {...props} icon="hands-pray" />}
          onPress={() => {}}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  card: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginVertical: 8,
    fontWeight: "bold",
  },
});
