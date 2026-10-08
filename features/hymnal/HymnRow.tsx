import { AppIcon } from '@/components/AppIcon';
import { ExternalBrandIcon } from '@/components/ExternalBrandIcon';
import { scaleTypographyMetric } from '@/constants/AppPreferences';
import {
  EXTERNAL_BRAND_ASSETS,
  EXTERNAL_BRAND_ICON_CONTENT_SCALE,
} from '@/constants/ExternalBrandAssets';
import { openURL } from '@/constants/ExternalLinks';
import { DESIGN_TOKENS } from '@/constants/Layout';
import { useAppTheme } from '@/constants/Themes';
import { memo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Divider, Text, TouchableRipple } from 'react-native-paper';
import { getHymnScriptureReference } from './HymnScripture';
import type { HymnalBookId } from './HymnalLabels';
import type { HymnNumber } from './HymnalNumberMappings';
import {
  getHymnCrossReferences,
  HYMNALS,
  type HymnalHymn,
} from './Hymnals';

export type HymnRowLabels = Readonly<{
  /** The recording's label, which tells it apart from a piano accompaniment. */
  withSinging: string;
  pianoOnly: string;
  youtubeHint: string;
  scriptureHint: string;
  /** How a hymn's verse reads on its chip: see formatHymnScriptureReference. */
  scriptureReference: (hymnalId: HymnalBookId, reference: string) => string;
  /** The cross-reference chip's text, such as "505 · 23". */
  crossReference: (hymnalId: HymnalBookId, hymnNumber: HymnNumber) => string;
  /** What a screen reader says for the chip, such as "Chinese Hymnal — 505 Edition, hymn 23". */
  crossReferenceLabel: (hymnalId: HymnalBookId, hymnNumber: HymnNumber) => string;
  crossReferenceHint: string;
}>;

type HymnRowProps = Readonly<{
  hymnalId: HymnalBookId;
  hymn: HymnalHymn;
  /** The hymn a link or a cross-reference opened. */
  highlighted: boolean;
  labels: HymnRowLabels;
  styles: HymnRowStyles;
  onOpenScripture: (hymnalId: HymnalBookId, reference: string) => void;
  onOpenCrossReference: (hymnalId: HymnalBookId, hymnNumber: HymnNumber) => void;
}>;

/**
 * One hymn: its number and title open the sheet music. Chips under the title
 * open its verse (an English hymn's, or a 505 hymn's 1985 equivalent's; see
 * HymnScripture.ts) and show the same hymn in another hymnal
 * (from the cross-reference tables). Below are its recording and, in a
 * hymnal that has them, its piano accompaniment.
 */
export const HymnRow = memo(function HymnRow({
  hymnalId,
  hymn,
  highlighted,
  labels,
  styles,
  onOpenScripture,
  onOpenCrossReference,
}: HymnRowProps) {
  const theme = useAppTheme();
  const hymnal = HYMNALS[hymnalId];
  const crossReferences = getHymnCrossReferences(hymnalId, hymn.number);
  const scriptureReference = getHymnScriptureReference(hymnalId, hymn.number);
  const accompanimentUrl = hymnal.getAccompanimentUrl?.(hymn);
  const chipStyle = [styles.chip, { borderColor: theme.colors.outline }];
  const pressableChipStyle = ({ pressed }: { pressed: boolean }) => [
    chipStyle,
    { opacity: pressed ? 0.7 : 1 },
    Platform.OS === 'web' ? styles.webPressable : null,
  ];

  return (
    <View style={styles.listItem}>
      <View
        style={[
          styles.hymnCardContainer,
          highlighted
            ? {
                backgroundColor: theme.colors.primaryContainer,
                borderColor: theme.colors.primary,
                borderWidth: 2,
              }
            : {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outlineVariant,
              },
        ]}
      >
        {/* Top Section: Link to the Sheet Music Website */}
        <TouchableRipple
          accessibilityState={highlighted ? { selected: true } : undefined}
          onPress={() => hymnal.openHymn(hymn.number)}
          style={styles.topSection}
        >
          <View style={styles.cardContent}>
            <AppIcon
              name="music-clef-treble"
              size={DESIGN_TOKENS.ICON_SIZE_FEATURED}
              color={theme.colors.tertiary}
              style={styles.leadingIcon}
            />
            <View style={styles.textContainer}>
              <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                {hymn.number}. {hymn.title}
              </Text>
            </View>
            <AppIcon
              name="open-in-new"
              size={DESIGN_TOKENS.ICON_SIZE_STANDARD}
              color={theme.colors.onSurfaceVariant}
            />
          </View>
        </TouchableRipple>

        {/* Outside the link above, so a screen reader reaches each chip. */}
        {(scriptureReference || crossReferences.length > 0) && (
          <View style={styles.chips}>
            {scriptureReference && (
              <Pressable
                accessibilityHint={labels.scriptureHint}
                accessibilityRole="button"
                hitSlop={6}
                onPress={() => onOpenScripture(hymnalId, scriptureReference)}
                style={pressableChipStyle}
              >
                <AppIcon name="book-cross" size={16} color={theme.colors.primary} />
                <Text style={[styles.chipText, { color: theme.colors.primary }]}>
                  {labels.scriptureReference(hymnalId, scriptureReference)}
                </Text>
              </Pressable>
            )}
            {crossReferences.map((reference) => {
              const content = (
                <>
                  <AppIcon
                    name="translate"
                    size={16}
                    color={theme.colors.primary}
                  />
                  <Text style={[styles.chipText, { color: theme.colors.primary }]}>
                    {labels.crossReference(reference.hymnalId, reference.number)}
                  </Text>
                </>
              );
              // A hymn missing from the other hymnal's online catalog keeps
              // its number for a printed copy, but has nothing to open.
              return reference.available ? (
                <Pressable
                  key={`${reference.hymnalId}:${reference.number}`}
                  accessibilityHint={labels.crossReferenceHint}
                  accessibilityLabel={labels.crossReferenceLabel(
                    reference.hymnalId,
                    reference.number,
                  )}
                  accessibilityRole="button"
                  hitSlop={6}
                  onPress={() => onOpenCrossReference(reference.hymnalId, reference.number)}
                  style={pressableChipStyle}
                >
                  {content}
                </Pressable>
              ) : (
                <View
                  key={`${reference.hymnalId}:${reference.number}`}
                  accessibilityLabel={labels.crossReferenceLabel(
                    reference.hymnalId,
                    reference.number,
                  )}
                  accessible
                  style={chipStyle}
                >
                  {content}
                </View>
              );
            })}
          </View>
        )}

        <Divider />

        {/* Bottom Action Section */}
        <View style={styles.bottomSection}>
          <TouchableRipple
            accessibilityHint={labels.youtubeHint}
            onPress={() => hymnal.openRecording(hymn)}
            style={styles.flexButton}
          >
            <View style={styles.buttonContent}>
              <ExternalBrandIcon
                source={EXTERNAL_BRAND_ASSETS.youtubeIcon.light}
                darkSource={EXTERNAL_BRAND_ASSETS.youtubeIcon.dark}
                size={24}
                contentScale={EXTERNAL_BRAND_ICON_CONTENT_SCALE.youtube}
              />
              <Text style={[styles.buttonText, { color: theme.colors.brandYoutube }]}>
                {labels.withSinging}
              </Text>
            </View>
          </TouchableRipple>

          {accompanimentUrl && (
            <>
              <View
                style={[
                  styles.verticalDivider,
                  { backgroundColor: theme.colors.outlineVariant },
                ]}
              />
              <TouchableRipple
                accessibilityHint={labels.youtubeHint}
                onPress={() =>
                  openURL(accompanimentUrl, 'Error', 'Could not open the YouTube video.')
                }
                style={styles.flexButton}
              >
                <View style={styles.buttonContent}>
                  <AppIcon name="piano" size={22} color={theme.colors.primary} />
                  <Text style={[styles.buttonText, { color: theme.colors.primary }]}>
                    {labels.pianoOnly}
                  </Text>
                </View>
              </TouchableRipple>
            </>
          )}
        </View>
      </View>
    </View>
  );
});

export type HymnRowStyles = ReturnType<typeof createHymnRowStyles>;

/**
 * The row's styles. With large text, or on a narrow screen, the action
 * buttons stack instead of sharing a row.
 */
export const createHymnRowStyles = (
  textScale: Parameters<typeof scaleTypographyMetric>[1],
  effectiveTextScale: number,
  useStackedActions: boolean,
) =>
  StyleSheet.create({
    listItem: {
      paddingHorizontal: 20,
    },
    hymnCardContainer: {
      borderRadius: 16,
      borderWidth: 1,
      marginBottom: 12,
      overflow: 'hidden',
    },
    topSection: {
      padding: 16,
    },
    cardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minWidth: 0,
    },
    textContainer: {
      flex: 1,
      marginRight: 8,
    },
    leadingIcon: {
      marginRight: 12,
    },
    cardTitle: {
      fontSize: scaleTypographyMetric(18, textScale),
      lineHeight: scaleTypographyMetric(24, textScale),
      fontWeight: '700',
    },
    // Lined up with the title, under the treble clef.
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: -6,
      paddingBottom: 12,
      paddingLeft: 16 + scaleTypographyMetric(DESIGN_TOKENS.ICON_SIZE_FEATURED, textScale) + 12,
      paddingRight: 16,
    },
    chip: {
      alignItems: 'center',
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      minHeight: Math.ceil(32 + Math.max(0, effectiveTextScale - 1) * 12),
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    chipText: {
      fontSize: scaleTypographyMetric(14, textScale),
      fontWeight: '700',
      lineHeight: scaleTypographyMetric(20, textScale),
    },
    bottomSection: {
      flexDirection: useStackedActions ? 'column' : 'row',
      alignItems: 'center',
    },
    flexButton: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      width: useStackedActions ? '100%' : undefined,
      minHeight: Math.ceil(44 + Math.max(0, effectiveTextScale - 1) * 20),
    },
    buttonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    buttonText: {
      marginLeft: 8,
      fontWeight: '600',
      fontSize: scaleTypographyMetric(15, textScale),
      lineHeight: scaleTypographyMetric(21, textScale),
      flexShrink: 1,
    },
    verticalDivider: {
      width: useStackedActions ? '100%' : 1,
      height: useStackedActions ? 1 : 24,
    },
    webPressable: {
      cursor: 'pointer',
    },
  });
