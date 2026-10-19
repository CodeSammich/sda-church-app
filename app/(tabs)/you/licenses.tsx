import { OPEN_SOURCE_NOTICES } from '@/constants/OpenSourceNotices';
import { useAppTheme } from '@/constants/Themes';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * ATTENTION: This file must ONLY ever use English, like the license texts it
 * reproduces.
 *
 * The legal disclaimer lives on the website (public/legal.html, #412), but
 * these notices stay in the app: SunCalc's BSD license asks that binary copies
 * reproduce its notice in materials provided with them. Keep the notices in
 * constants/OpenSourceNotices.ts and docs/LEGAL.md in step.
 */
export default function OpenSourceLicensesScreen() {
  const theme = useAppTheme();
  const NavigationStyles = useNavigationStyles();
  const { backTo } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const headerHeight = useGlobalHeaderHeight();

  return (
    <ScrollView
      style={[NavigationStyles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={[
        NavigationStyles.contentContainer,
        { paddingTop: headerHeight + 20, paddingBottom: insets.bottom + 80 },
      ]}
    >
      <Stack.Screen options={{ title: 'Open-Source Licenses', backTo } as any} />

      <Text
        variant="headlineSmall"
        style={[styles.title, { color: theme.colors.onBackground }]}
      >
        Open-Source Licenses
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.bodyText, { color: theme.colors.onSurface }]}
      >
        This application includes the following open-source software, whose licenses
        require these notices.
      </Text>
      {OPEN_SOURCE_NOTICES.map((notice) => (
        <Text
          key={notice.name}
          variant="bodySmall"
          style={[styles.notice, { color: theme.colors.onSurfaceVariant }]}
        >
          {`${notice.name} (${notice.url})\n${notice.usage}\n\n${notice.license}`}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: 'bold', marginBottom: 15 },
  bodyText: {},
  notice: { marginTop: 10 },
});
