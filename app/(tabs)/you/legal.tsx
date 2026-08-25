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
        Last Updated: August 2026
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
        This app links to HymnsForWorship.org and zgaxr.com for hymn resources and to EGW
        Writings (egwwritings.org) for externally hosted religious books. Some linked
        material may be copyrighted. When you follow these links, you are subject to the
        destination provider’s terms and conditions. Please respect copyright laws and do
        not attempt to bypass access requirements. For easier reading in the EGW Writings
        text reader, use its own font and theme controls. Open its three-dot menu to choose
        “Larger font” or “Smaller font.” The reader remembers these choices in your browser.
        Because it is operated externally, this app does not transfer its text-size or
        theme settings to EGW Writings.
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
        This application provides searchable hymn metadata and a curated index of book
        titles and language editions to facilitate navigation. For Chinese app languages,
        it also displays current cover thumbnails served by the Chinese Union Mission;
        bundled original artwork remains the fallback. We do not host or reproduce the
        externally linked EGW book text, protected musical notation, or lyrics. External
        content is accessed through links to third-party
        providers; a link does
        not represent that this project independently verified every provider&apos;s copyright
        permissions.
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
        (e.g., YouTube, Spotify, HymnsForWorship.org, zgaxr.com, and EGW Writings at
        egwwritings.org) to assist users in locating books, musical performances,
        recordings, or sheet music. These are external platforms, and use of them is
        subject to their respective terms and conditions. We do not host, curate, or
        endorse the specific content or search results returned by these services. Users
        are responsible for ensuring their use complies with applicable copyright and
        performance licensing requirements; linking does not constitute legal
        authorization for public performance or reuse.
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
