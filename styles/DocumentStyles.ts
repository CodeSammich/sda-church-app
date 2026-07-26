import { DESIGN_TOKENS } from '@/constants/Layout';
import { StyleSheet } from 'react-native';

/**
 * Global styles for informational/reading pages (e.g., About, Beliefs, Privacy).
 * Ensures a consistent look and feel across the application's document-style content.
 */
export const DocumentStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Main title of a document or informational page
  docTitle: {
    padding: 16,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 26,
    lineHeight: 34,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  // The "Bar" header logic for content separation
  sectionTitle: {
    marginBottom: 12,
    fontWeight: 'bold',
    borderBottomWidth: 2,
    paddingBottom: 4,
    fontSize: 20,
    lineHeight: 28,
  },
  description: {
    lineHeight: 22,
    fontSize: 16,
  },
  note: {
    marginVertical: 12,
    fontStyle: 'italic',
    opacity: 0.8,
    lineHeight: 20,
  },
  card: {
    marginBottom: 12,
  },
  button: {
    marginTop: 8,
  },
  // Shared Header styles (used for banner images)
  header: {
    marginBottom: 16,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 240,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  // Timeline styles (History sections)
  timelineContainer: {
    flexDirection: 'row',
    marginTop: 24,
  },
  timelineColumn: {
    flex: 1,
    alignItems: 'center',
  },
  yearCircle: {
    width: DESIGN_TOKENS.TIMELINE_CIRCLE_SIZE,
    height: DESIGN_TOKENS.TIMELINE_CIRCLE_SIZE,
    borderRadius: DESIGN_TOKENS.TIMELINE_CIRCLE_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  yearText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  connectorLine: {
    width: 2,
    height: 30,
  },
  milestoneEvent: {
    textAlign: 'center',
    marginTop: 4,
    fontSize: 10,
    paddingHorizontal: 2,
  },
  // Organizational/Affiliation Card styles
  orgCard: {
    backgroundColor: 'transparent',
  },
  orgName: {
    fontSize: 18,
    marginTop: 4,
  },
  orgDesc: {
    marginTop: 4,
  },
});
