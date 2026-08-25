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
        Last Updated: August 2026
      </Text>

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
        This application values privacy and uses data minimization to limit what the
        public app receives. The PWA does not require a user account for ordinary use.
        Church administrative systems and service providers still process limited
        information needed to operate the app, as described below.
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
        restricted response Sheet may record a submitter&apos;s email address.{`\n\n`}
        A Google Apps Script web app reads the requested Sabbath schedule and form response
        and returns only an allowlisted bulletin response. Before the response becomes
        public, the script shortens Latin-script full names to a first name and last
        initial. A single-word Latin-script name may appear as entered, while unsupported
        non-Latin names are replaced with a privacy placeholder. Full names, form submitter
        email addresses, and other non-allowlisted spreadsheet fields are not included in
        the public API response. The shortened names may still identify people within the
        church community and are therefore treated as personal information rather than
        anonymous data.{`\n\n`}
        This information is used to communicate worship assignments and weekly program
        details. Access to the source Sheets is controlled by the church through Google
        Workspace, and source-data retention is governed by the church&apos;s administrative
        practices.
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
        Google Apps Script temporarily caches privacy-filtered bulletin responses to reduce
        Sheet reads. The PWA may store the same filtered bulletin data and refresh timing
        in browser local storage so ordinary visits do not repeatedly call the API and the
        bulletin can refresh around Sabbath boundaries. Users can remove the device copy
        by clearing this site&apos;s browser data.
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
        This web application is deployed using GitHub Pages. GitHub may collect basic
        server logs and IP addresses for security, debugging, and operational maintenance.
        We use Cloudflare to manage domain traffic and protect the application from common
        web threats. Cloudflare may process basic connection data, such as IP addresses,
        to identify malicious traffic and optimize performance. Google processes the
        restricted source data and API requests through Google Workspace, Google Sheets,
        Google Forms, and Google Apps Script. Each provider handles information under its
        own applicable terms and privacy policies.
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
        This application links to external platforms such as YouTube, Spotify,
        HymnsForWorship.org, zgaxr.com, and EGW Writings (egwwritings.org).
        Chinese-language library screens also request the Chinese Union Mission&apos;s current
        book-cover catalog and images. When you follow an external link or when those
        images load, the provider may receive ordinary connection information such as
        your IP address. Use of these services is subject to each provider&apos;s privacy
        policy. The church does not receive or store information those external platforms
        independently collect from you.
      </Text>

      <Text
        variant="titleMedium"
        style={[styles.sectionHeader, { color: theme.colors.onBackground }]}
      >
        6. Privacy Frameworks and Questions
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.bodyText, { color: theme.colors.onSurface }]}
      >
        The project&apos;s minimization measures are informed by privacy principles found
        in laws such as the CCPA and GDPR, but they do not by themselves guarantee legal
        compliance. Which laws apply depends on the deploying organization, its users, and
        its data practices. Questions or requests concerning church-managed schedule
        information may be sent to pastor@nyccsda.org.
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
