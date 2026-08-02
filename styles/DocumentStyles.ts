import {
  DEFAULT_TEXT_SCALE,
  scaleTypographyMetric,
  type TextScale,
} from '@/constants/AppPreferences';
import { DESIGN_TOKENS } from '@/constants/Layout';
import { useTextSize } from '@/constants/TextSizeContext';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

/**
 * Global styles for informational/reading pages (e.g., About, Beliefs, Privacy).
 * Ensures a consistent look and feel across the application's document-style content.
 */
export const createDocumentStyles = (textScale: TextScale) => StyleSheet.create({
  container: {
    flex: 1,
  },
  // Main title of a document or informational page
  docTitle: {
    padding: 16,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: scaleTypographyMetric(26, textScale),
    lineHeight: scaleTypographyMetric(34, textScale),
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
    fontSize: scaleTypographyMetric(20, textScale),
    lineHeight: scaleTypographyMetric(28, textScale),
  },
  description: {
    lineHeight: scaleTypographyMetric(22, textScale),
    fontSize: scaleTypographyMetric(16, textScale),
  },
  note: {
    marginVertical: 12,
    fontStyle: 'italic',
    opacity: 0.8,
    lineHeight: scaleTypographyMetric(20, textScale),
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
    width: scaleTypographyMetric(DESIGN_TOKENS.TIMELINE_CIRCLE_SIZE, textScale),
    height: scaleTypographyMetric(DESIGN_TOKENS.TIMELINE_CIRCLE_SIZE, textScale),
    borderRadius:
      scaleTypographyMetric(DESIGN_TOKENS.TIMELINE_CIRCLE_SIZE, textScale) / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  yearText: {
    fontWeight: 'bold',
    fontSize: scaleTypographyMetric(12, textScale),
  },
  connectorLine: {
    width: 2,
    height: 30,
  },
  milestoneEvent: {
    textAlign: 'center',
    marginTop: 4,
    fontSize: scaleTypographyMetric(10, textScale),
    paddingHorizontal: 2,
  },
  // Organizational/Affiliation Card styles
  orgCard: {
    backgroundColor: 'transparent',
  },
  orgName: {
    fontSize: scaleTypographyMetric(18, textScale),
    marginTop: 4,
  },
  orgDesc: {
    marginTop: 4,
  },
});

export const DocumentStyles = createDocumentStyles(DEFAULT_TEXT_SCALE);

export const useDocumentStyles = () => {
  const { textScale } = useTextSize();
  return useMemo(() => createDocumentStyles(textScale), [textScale]);
};
