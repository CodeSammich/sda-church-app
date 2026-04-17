import React, { useContext } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { Divider, List } from "react-native-paper";
import { LanguageContext } from "../_layout";

export default function MoreScreen() {
  const { language } = useContext(LanguageContext);

  const labels =
    {
      en: {
        info: "Church Information",
        about: "About Us",
        notify: "Notifications",
        contact: "Contact Us",
        community: "Community",
        give: "Give",
        gallery: "Gallery",
        training: "Evangelism Training",
      },
      zh: {
        info: "教會資訊",
        about: "關於我們",
        notify: "通知設定",
        contact: "聯絡我們",
        community: "社區與事工",
        give: "捐獻",
        gallery: "活動花絮",
        training: "佈道訓練",
      },
      "zh-cn": {
        info: "教会信息",
        about: "关于我们",
        notify: "通知设置",
        contact: "联系我们",
        community: "社区与事工",
        give: "捐献",
        gallery: "活动花絮",
        training: "布道训练",
      },
      es: {
        info: "Información de la iglesia",
        about: "Sobre nosotros",
        notify: "Notificaciones",
        contact: "Contáctenos",
        community: "Comunidad",
        give: "Dar",
        gallery: "Galería",
        training: "Entrenamiento",
      },
    }[language as "en" | "zh" | "zh-cn" | "es"] || {};

  return (
    <ScrollView style={styles.container}>
      <List.Section>
        <List.Subheader>{labels.info}</List.Subheader>
        <List.Item
          title={labels.about}
          left={(p) => <List.Icon {...p} icon="information" />}
        />
        <List.Item
          title={labels.notify}
          left={(p) => <List.Icon {...p} icon="bell" />}
        />
        <List.Item
          title={labels.contact}
          left={(p) => <List.Icon {...p} icon="email" />}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>{labels.community}</List.Subheader>
        <List.Item
          title={labels.give}
          left={(p) => <List.Icon {...p} icon="gift" />}
        />
        <List.Item
          title={labels.gallery}
          left={(p) => <List.Icon {...p} icon="image" />}
        />
        <List.Item
          title={labels.training}
          left={(p) => <List.Icon {...p} icon="school" />}
        />
      </List.Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
