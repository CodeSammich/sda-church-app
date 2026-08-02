import { useAppTheme } from '@/constants/Themes';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * ATTENTION: This file must ONLY ever use English.
 *
 * To maintain legal consistency and avoid ambiguity across different
 * jurisdictions or languages, Legal Information is intentionally kept in
 * English-only. This aligns with Project Tenet 2 (Liability-Free).
 *
 * Please make sure the content syncs with README.md
 */
export default function LegalScreen() {
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
      <Stack.Screen options={{ title: 'Legal Disclaimer', backTo } as any} />

      <Text
        variant="headlineSmall"
        style={[styles.title, { color: theme.colors.onBackground }]}
      >
        Legal Disclaimer
      </Text>
      <Text
        variant="labelSmall"
        style={[styles.lastUpdated, { color: theme.colors.onSurfaceVariant }]}
      >
        Last Updated: May 2026
      </Text>

      <Text
        variant="titleMedium"
        style={[styles.sectionHeader, { color: theme.colors.onBackground }]}
      >
        1. Usage of External Resources
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.bodyText, { color: theme.colors.onSurface }]}
      >
        This app links to HymnsForWorship.org for hymn resources. Please be aware that
        some hymns are copyrighted. When you follow these links, you are subject to
        HymnsForWorship.org’s terms and conditions. You may be prompted to accept their
        terms before viewing certain content. Please respect copyright laws and do not
        attempt to bypass these requirements.
      </Text>

      <Text
        variant="titleMedium"
        style={[styles.sectionHeader, { color: theme.colors.onBackground }]}
      >
        2. Data Attribution
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.bodyText, { color: theme.colors.onSurface }]}
      >
        This application provides access to non-copyrightable metadata (hymn titles and
        index numbers) to facilitate navigation. We do not host or reproduce protected
        musical notation or lyrics. All external content is accessed through direct links
        to authorized third-party providers.
      </Text>

      <Text
        variant="titleMedium"
        style={[styles.sectionHeader, { color: theme.colors.onBackground }]}
      >
        3. External Platforms & Services
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.bodyText, { color: theme.colors.onSurface }]}
      >
        This application provides links to external platforms and third-party services
        (e.g., YouTube, Spotify, and HymnsForWorship.org) to assist users in locating
        musical performances, recordings, or sheet music. Please note that these are
        external platforms, and your use of them is subject to their respective terms and
        conditions. We do not host, curate, or endorse the specific content or search
        results returned by these services. Users are responsible for ensuring that their
        playback or usage of such content complies with their local copyright and
        performance licensing requirements; linking to these services does not constitute
        legal authorization for public performance.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: 'bold', marginBottom: 5 },
  lastUpdated: { marginBottom: 20 },
  sectionHeader: { fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
  bodyText: {},
});
