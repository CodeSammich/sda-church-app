import { useAppTheme } from "@/constants/Themes";
import { scaleTypographyMetric } from "@/constants/AppPreferences";
import { useTextSize } from "@/constants/TextSizeContext";
import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function NotFoundScreen() {
  const theme = useAppTheme();
  const { textScale } = useTextSize();
  const styles = createStyles(textScale);
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          This screen doesn't exist.
        </Text>

        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: theme.colors.primary }]}>
            Go to home screen!
          </Text>
        </Link>
      </View>
    </>
  );
}

const createStyles = (textScale: Parameters<typeof scaleTypographyMetric>[1]) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: scaleTypographyMetric(20, textScale),
    lineHeight: scaleTypographyMetric(28, textScale),
    fontWeight: "bold",
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: scaleTypographyMetric(14, textScale),
    lineHeight: scaleTypographyMetric(20, textScale),
  },
});
