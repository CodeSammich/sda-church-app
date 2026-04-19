import React, { useContext } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { Appbar, Divider, List, Text, useTheme } from "react-native-paper";
import { LanguageContext } from "../_layout";

export default function CalendarScreen() {
  const theme = useTheme();
  const { language } = useContext(LanguageContext);

  const labels = {
    en: {
      header: "Calendar",
      schedule: "Weekly Schedule",
      days: ["Saturday", "Wednesday"],
      events: [
        "Sabbath School",
        "Divine Service",
        "Mid-week Prayer Meeting",
        "Youth AYS",
      ],
    },
    zh: {
      header: "教會日曆",
      schedule: "每週聚會時間",
      days: ["星期六", "星期三"],
      events: ["安息日學", "崇拜聚會", "週中禱告會", "青年聚會 (AYS)"],
    },
    "zh-cn": {
      header: "教会日历",
      schedule: "每周聚会时间",
      days: ["星期六", "星期三"],
      events: ["安息日学", "崇拜聚会", "周中祷告会", "青年聚会 (AYS)"],
    },
    es: {
      header: "Calendario",
      schedule: "Horario Semanal",
      days: ["Sábado", "Miércoles"],
      events: [
        "Escuela Sabática",
        "Culto Divino",
        "Reunión de Oración",
        "Sociedad de Jóvenes (AYS)",
      ],
    },
  }[language as "en" | "zh" | "zh-cn" | "es"] || {
    header: "Calendar",
    schedule: "Schedule",
    days: [],
    events: [],
  };

  const events = [
    {
      id: "1",
      title: labels.events[0],
      time: `${labels.days[0]}, 9:30 AM`,
      icon: "book-open-variant",
    },
    {
      id: "2",
      title: labels.events[1],
      time: `${labels.days[0]}, 11:00 AM`,
      icon: "church",
    },
    {
      id: "3",
      title: labels.events[2],
      time: `${labels.days[1]}, 7:00 PM`,
      icon: "hands-pray",
    },
    {
      id: "4",
      title: labels.events[3],
      time: `${labels.days[0]}, 5:00 PM`,
      icon: "account-group",
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
        <Text variant="titleMedium" style={styles.sectionTitle}>
          {labels.schedule}
        </Text>
        {events.map((event, index) => (
          <React.Fragment key={event.id}>
            <List.Item
              title={event.title}
              description={event.time}
              left={(props) => <List.Icon {...props} icon={event.icon} />}
              onPress={() => {}}
            />
            {index < events.length - 1 && <Divider />}
          </React.Fragment>
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
  sectionTitle: {
    marginBottom: 8,
    fontWeight: "bold",
  },
});
