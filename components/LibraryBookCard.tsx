import { AppIcon } from '@/components/AppIcon';
import { scaleTypographyMetric } from '@/constants/AppPreferences';
import { DESIGN_TOKENS } from '@/constants/Layout';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';

type LibraryBookCardProps = Readonly<{
  accessibilityHint?: string;
  author: string;
  coverSource?: ImageSourcePropType;
  coverUrl?: string;
  listLayout: boolean;
  onPress: () => void;
  title: string;
}>;

export const shouldUseLibraryListLayout = (
  windowWidth: number,
  effectiveTextScale: number,
) => {
  const safeWidth = Number.isFinite(windowWidth) ? Math.max(0, windowWidth) : 0;
  const safeScale = Number.isFinite(effectiveTextScale)
    ? Math.max(1, effectiveTextScale)
    : 1;

  // Two covers need roughly 150dp each after the page gutter and grid gap.
  // Switch early when enlarged text would leave too little room for titles.
  return safeWidth < 352 || (safeWidth - 52) / 2 < 150 * safeScale;
};

export function LibraryBookCard({
  accessibilityHint,
  author,
  coverSource,
  coverUrl,
  listLayout,
  onPress,
  title,
}: LibraryBookCardProps) {
  const theme = useAppTheme();
  const { textScale } = useTextSize();
  const [remoteCoverFailed, setRemoteCoverFailed] = useState(false);
  const styles = useMemo(() => createStyles(textScale), [textScale]);
  const accessibilityLabel = `${title}. ${author}`;
  const displayedCoverSource = coverUrl && !remoteCoverFailed
    ? { uri: coverUrl }
    : coverSource;

  useEffect(() => setRemoteCoverFailed(false), [coverUrl]);

  return (
    <TouchableOpacity
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      activeOpacity={0.72}
      onPress={onPress}
      style={[
        styles.card,
        listLayout ? styles.listCard : styles.gridCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
        },
        Platform.OS === 'web' ? styles.webPressable : null,
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.coverFrame,
          listLayout ? styles.listCoverFrame : styles.gridCoverFrame,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        {displayedCoverSource ? (
          <Image
            accessible={false}
            onError={coverUrl ? () => setRemoteCoverFailed(true) : undefined}
            resizeMode="cover"
            source={displayedCoverSource}
            style={styles.cover}
          />
        ) : (
          <View style={styles.placeholderCover}>
            <AppIcon name="book-open-page-variant" size={44} color={theme.colors.primary} />
          </View>
        )}
      </View>

      <View
        pointerEvents="none"
        style={[styles.details, listLayout ? styles.listDetails : null]}
      >
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          {title}
        </Text>
        <View style={styles.authorRow}>
          <Text
            style={[styles.author, { color: theme.colors.onSurfaceVariant }]}
          >
            {author}
          </Text>
          <AppIcon
            name="chevron-right"
            size={DESIGN_TOKENS.ICON_SIZE_STANDARD}
            color={theme.colors.primary}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (textScale: Parameters<typeof scaleTypographyMetric>[1]) =>
  StyleSheet.create({
    card: {
      borderRadius: 14,
      borderWidth: 1,
      overflow: 'hidden',
    },
    gridCard: {
      flexBasis: '47%',
      flexGrow: 1,
      maxWidth: '50%',
    },
    listCard: {
      alignItems: 'stretch',
      flexDirection: 'row',
      minHeight: 168,
      width: '100%',
    },
    coverFrame: {
      overflow: 'hidden',
    },
    gridCoverFrame: {
      aspectRatio: 2 / 3,
      width: '100%',
    },
    listCoverFrame: {
      alignSelf: 'stretch',
      flexShrink: 0,
      width: 112,
    },
    cover: {
      height: '100%',
      width: '100%',
    },
    placeholderCover: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    details: {
      padding: 12,
    },
    listDetails: {
      flex: 1,
      justifyContent: 'center',
      minWidth: 0,
      padding: 16,
    },
    title: {
      fontSize: scaleTypographyMetric(16, textScale),
      fontWeight: '700',
      lineHeight: scaleTypographyMetric(22, textScale),
    },
    authorRow: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'space-between',
      marginTop: 5,
    },
    author: {
      flex: 1,
      fontSize: scaleTypographyMetric(13, textScale),
      lineHeight: scaleTypographyMetric(19, textScale),
      minWidth: 0,
    },
    webPressable: {
      cursor: 'pointer',
    },
  });
