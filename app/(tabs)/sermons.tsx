import React, { useContext } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { Appbar, Button, Card, useTheme } from "react-native-paper";
import { LanguageContext } from "../_layout";

export default function SermonsScreen() {
  const theme = useTheme();
  const { language } = useContext(LanguageContext);

  const labels = {
    en: {
      header: "Sermons",
      watch: "Watch",
      audio: "Audio",
      speakers: ["Pastor John Doe", "Elder Sarah Smith", "Pastor Mark Wilson"],
      titles: [
        "Faith in Action",
        "The Power of Prayer",
        "Walking by the Spirit",
      ],
    },
    zh: {
      header: "講道回顧",
      watch: "觀看",
      audio: "音頻",
      speakers: ["約翰·多牧師", "莎拉·史密斯長老", "馬克·威爾遜牧師"],
      titles: ["信心與行動", "禱告的力量", "隨聖靈行事"],
    },
    "zh-cn": {
      header: "讲道回顾",
      watch: "观看",
      audio: "音频",
      speakers: ["约翰·多牧师", "莎拉·史密斯长老", "马克·威尔逊牧师"],
      titles: ["信心与行动", "祷告的力量", "随圣灵行事"],
    },
    es: {
      header: "Sermones",
      watch: "Ver",
      audio: "Audio",
      speakers: [
        "Pastor Juan Doe",
        "Anciana Sarah Smith",
        "Pastor Mark Wilson",
      ],
      titles: [
        "Fe en Acción",
        "El Poder de la Oración",
        "Caminando por el Espíritu",
      ],
    },
  }[language as "en" | "zh" | "zh-cn" | "es"] || {
    header: "Sermons",
    watch: "Watch",
    audio: "Audio",
    speakers: [],
    titles: [],
  };

  const sermons = [
    {
      id: "1",
      title: labels.titles[0],
      speaker: labels.speakers[0],
      date: "Oct 26, 2024",
      image: "https://picsum.photos/id/10/700",
    },
    {
      id: "2",
      title: labels.titles[1],
      speaker: labels.speakers[1],
      date: "Oct 19, 2024",
      image: "https://picsum.photos/id/20/700",
    },
    {
      id: "3",
      title: labels.titles[2],
      speaker: labels.speakers[2],
      date: "Oct 12, 2024",
      image: "https://picsum.photos/id/30/700",
    },
  ];

  return (
    <>
      <Appbar.Header elevated>
        <Appbar.Content title={labels.header} />
      </Appbar.Header>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        {sermons.map((sermon) => (
          <Card key={sermon.id} style={styles.card} mode="elevated">
            <Card.Cover source={{ uri: sermon.image }} />
            <Card.Title
              title={sermon.title}
              subtitle={`${sermon.speaker} • ${sermon.date}`}
            />
            <Card.Actions>
              <Button icon="play" mode="contained-tonal">
                {labels.watch}
              </Button>
              <Button icon="download">{labels.audio}</Button>
            </Card.Actions>
          </Card>
        ))}
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
});
