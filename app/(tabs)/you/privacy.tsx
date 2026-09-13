import { useAppTheme } from '@/constants/Themes';
import { openInSystemBrowser, PRIVACY_POLICY_URL } from '@/constants/ExternalLinks';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * ATTENTION: This file must ONLY ever use English.
 *
 * To maintain legal consistency and avoid ambiguity across different
 * jurisdictions or languages, the Privacy Policy is intentionally kept in
 * English-only. This aligns with Project Tenet 2 (Liability-Free).
 *
 * Please make sure the content syncs with README.md
 */
export default function PrivacyPolicyScreen() {
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
      <Stack.Screen options={{ title: 'Privacy Policy', backTo } as any} />

      <Text
        variant="headlineSmall"
        style={[styles.title, { color: theme.colors.onBackground }]}
      >
        Privacy Policy
      </Text>
      <Text
        variant="labelSmall"
        style={[styles.lastUpdated, { color: theme.colors.onSurfaceVariant }]}
      >
        Last Updated: September 2026
      </Text>
      <Button
        mode="outlined"
        icon="open-in-new"
        onPress={() =>
          void openInSystemBrowser(
            PRIVACY_POLICY_URL,
            'Could not open privacy policy',
            'Please try again later.',
          )
        }
        style={styles.onlineButton}
      >
        View online privacy policy
      </Button>

      <Text
        variant="titleMedium"
        style={[styles.sectionHeader, { color: theme.colors.onBackground }]}
      >
        1. Introduction
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.bodyText, { color: theme.colors.onSurface }]}
      >
        This application values privacy and uses data minimization. The app does not
        require a user account for ordinary use, does not include advertising or
        analytics, and does not provide public user profiles, chat, or user-generated
        posting. Authorized church contributors may submit bulletin information through
        linked Google Forms outside the app. Church administrative systems and service
        providers still process limited
        information needed to operate the app, as described below. For privacy questions
        or requests, please contact pastor@nyccsda.org.
      </Text>

      <Text
        variant="titleMedium"
        style={[styles.sectionHeader, { color: theme.colors.onBackground }]}
      >
        2. Worship Schedule Information (Google Workspace)
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.bodyText, { color: theme.colors.onSurface }]}
      >
        Authorized church schedule managers enter participant names and worship
        assignments into a restricted, church-managed Google Sheet. Authorized form
        submitters provide weekly worship-program details through Google Forms; the
        restricted response Sheet may record a submitter&apos;s email address.{`\n\n`}A
        Google Apps Script web app reads the requested Sabbath schedule and form response
        and returns only an allowlisted bulletin response. Before the response becomes
        public, the script shortens Latin-script full names to a first name and last
        initial. A single-word Latin-script name may appear as entered, while unsupported
        non-Latin names are replaced with a privacy placeholder. Full names, form
        submitter email addresses, and other non-allowlisted spreadsheet fields are not
        included in the public API response. The shortened names may still identify people
        within the church community and are therefore treated as personal information
        rather than anonymous data.{`\n\n`}
        This information is used to communicate worship assignments and weekly program
        details. Access to the source Sheets is controlled by the church through Google
        Workspace, and source-data retention is governed by the church&apos;s
        administrative practices.
      </Text>

      <Text
        variant="titleMedium"
        style={[styles.sectionHeader, { color: theme.colors.onBackground }]}
      >
        3. Temporary Caching and Device Storage
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.bodyText, { color: theme.colors.onSurface }]}
      >
        Google Apps Script temporarily caches privacy-filtered bulletin responses to
        reduce Sheet reads. The app may store settings, saved verse references, cached
        Bible selections, and the same filtered bulletin data in device-local storage.
        This data is not synced to a church account. On the web, users can remove it by
        clearing this site&apos;s browser data. On iOS or Android, users can remove it by
        uninstalling the app or clearing its storage using the operating system&apos;s app
        settings.
      </Text>

      <Text
        variant="titleMedium"
        style={[styles.sectionHeader, { color: theme.colors.onBackground }]}
      >
        4. Hosting and Traffic Services
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.bodyText, { color: theme.colors.onSurface }]}
      >
        This app requests Bible text, Bible-audio metadata or files, sunset times, cover
        images, and privacy-filtered bulletin data from external services over HTTPS.
        GitHub Pages, Cloudflare, Google Workspace/Apps Script, HelloAO, fetch(bible),
        Audio Power, Adventist Connect, the Chinese Union Mission services, and the
        sunrise-sunset service may process ordinary connection metadata such as an IP
        address, user agent, request path, and request time for delivery, security, or
        service operations. The app does not receive or store those providers&apos; server
        logs. Each provider handles information under its own applicable terms and
        privacy policy.
      </Text>

      <Text
        variant="titleMedium"
        style={[styles.sectionHeader, { color: theme.colors.onBackground }]}
      >
        5. External Links
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.bodyText, { color: theme.colors.onSurface }]}
      >
        This application links to external platforms such as AdventistGiving, YouTube,
        Spotify, Zoom, HymnsForWorship.org, zgaxr.com, EGW Writings (egwwritings.org),
        and Sabbath School services. The donation button opens AdventistGiving outside
        the app; payment details and any donation receipts are handled by that service
        and the receiving organization, not by this app. Library screens request current
        book-cover thumbnails from EGW Writings and, for Chinese languages, the Chinese
        Union Mission&apos;s cover catalog and image service. When you follow an external link
        or when those images load, the provider may receive ordinary connection
        information such as your IP address. Use of these services is subject to their
        privacy policies. The church does not receive or store information those external
        platforms independently collect from you. When you choose to share a Bible verse,
        the selected text is passed to the operating system share sheet and the app you
        choose; this app does not receive the recipient&apos;s information.
      </Text>

      <Text
        variant="titleMedium"
        style={[styles.sectionHeader, { color: theme.colors.onBackground }]}
      >
        6. Device Permissions and Data Requests
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.bodyText, { color: theme.colors.onSurface }]}
      >
        The native app uses audio playback, including background playback, and may read
        the device light sensor to adjust its theme locally. It does not request device
        location, camera, microphone, contacts, photos, or notifications. Because the app
        does not create user accounts or maintain a personal server profile, there is no
        account to delete. A user may request correction or removal of church-managed
        bulletin information by contacting pastor@nyccsda.org. The church will handle
        requests according to applicable law and its administrative retention practices.
      </Text>

      <Text
        variant="titleMedium"
        style={[styles.sectionHeader, { color: theme.colors.onBackground }]}
      >
        7. Privacy Frameworks and Questions
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.bodyText, { color: theme.colors.onSurface }]}
      >
        The project&apos;s minimization measures are informed by privacy principles found
        in laws such as the CCPA and GDPR, but they do not by themselves guarantee legal
        compliance. Which laws apply depends on the deploying organization, its users, and
        its data practices. This policy may be updated when the app&apos;s data practices
        change.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: 'bold', marginBottom: 5 },
  lastUpdated: { marginBottom: 20 },
  onlineButton: { alignSelf: 'flex-start', marginBottom: 8 },
  sectionHeader: { fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
  bodyText: {},
});
