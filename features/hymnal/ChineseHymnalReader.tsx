import { AppIcon } from '@/components/AppIcon';
import { scaleTypographyMetric } from '@/constants/AppPreferences';
import { openYouTubeSearch } from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { DESIGN_TOKENS } from '@/constants/Layout';
import { getRoutedHymns } from '@/features/hymnal/HymnalRouting';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import { useDocumentStyles } from '@/styles/DocumentStyles';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useContext, useMemo } from 'react';
import {
  FlatList,
  ImageBackground,
  ImageSourcePropType,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Divider, Text, TouchableRipple } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ChineseHymnalEntry {
  number: number | string;
  title: string;
}

interface ChineseHymnalReaderProps {
  edition: 505 | 506 | 707;
  coverImage: ImageSourcePropType;
  route:
    | '/home/chinese-505-hymnal'
    | '/home/chinese-506-hymnal'
    | '/home/chinese-707-new-simplified-hymnal'
    | '/home/chinese-707-four-part-hymnal'
    | '/home/chinese-707-standard-hymnal';
  getHymns: () => ChineseHymnalEntry[];
  openHymn: (hymnNumber: number | string) => void;
  titles?: Record<'en' | 'zh' | 'zh-cn' | 'es', string>;
}

const getUiLabels = (edition: number) => ({
  en: {
    title: `Chinese Hymnal — ${edition} Edition`,
    attribution: `Tap a hymn to open its sheet music externally on the ${edition} hymnal directory at zgaxr.com.`,
    legalLink: 'Legal Disclaimer',
    watchYouTube: 'YouTube',
  },
  zh: {
    title: `中文讚美詩 — ${edition} 版`,
    attribution: `點擊詩歌即可在 zgaxr.com 的${edition}版詩歌目錄查看琴譜。`,
    legalLink: '法律聲明',
    watchYouTube: 'YouTube',
  },
  'zh-cn': {
    title: `中文赞美诗 — ${edition} 版`,
    attribution: `点击诗歌即可在 zgaxr.com 的${edition}版诗歌目录查看琴谱。`,
    legalLink: '法律声明',
    watchYouTube: 'YouTube',
  },
  es: {
    title: `Himnario Chino — Edición ${edition}`,
    attribution: `Toca un himno para abrir su partitura en el directorio externo de la edición ${edition} en zgaxr.com.`,
    legalLink: 'Aviso legal',
    watchYouTube: 'YouTube',
  },
});

export function ChineseHymnalReader({
  edition,
  coverImage,
  route,
  getHymns,
  openHymn,
  titles,
}: ChineseHymnalReaderProps) {
  const theme = useAppTheme();
  const DocumentStyles = useDocumentStyles();
  const NavigationStyles = useNavigationStyles();
  const { textScale } = useTextSize();
  const { fontScale, width } = useWindowDimensions();
  const effectiveTextScale = fontScale * textScale;
  const useStackedActions =
    (width - 48) / 2 < 120 * Math.max(1, effectiveTextScale);
  const styles = useMemo(
    () => createStyles(textScale, effectiveTextScale, useStackedActions),
    [effectiveTextScale, textScale, useStackedActions],
  );
  const insets = useSafeAreaInsets();
  const headerHeight = useGlobalHeaderHeight();
  const { language } = useContext(LanguageContext);
  const { backTo, hymnNum, highlight } = useLocalSearchParams<{
    backTo?: string;
    hymnNum?: string;
    highlight?: string;
  }>();
  const uiLabels = useMemo(() => getUiLabels(edition), [edition]);
  const labels = uiLabels[language as keyof typeof uiLabels] || uiLabels.en;
  const title = titles?.[language as keyof typeof titles] || labels.title;
  const allHymns = useMemo(() => getHymns(), [getHymns]);
  const displayHymns = useMemo(() => {
    const query = (highlight || '').toLocaleLowerCase().trim();
    return getRoutedHymns(allHymns, hymnNum, (hymn) =>
      !query ||
        hymn.number.toString().includes(query) ||
        hymn.title.toLocaleLowerCase().includes(query),
    );
  }, [allHymns, highlight, hymnNum]);

  const renderHymnItem = ({ item }: { item: ChineseHymnalEntry }) => (
    <View style={styles.listItem}>
      <View
        style={[
          styles.hymnCardContainer,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
      >
        <TouchableRipple
          onPress={() => openHymn(item.number)}
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
                {item.number}. {item.title}
              </Text>
            </View>
            <AppIcon
              name="open-in-new"
              size={DESIGN_TOKENS.ICON_SIZE_STANDARD}
              color={theme.colors.onSurfaceVariant}
            />
          </View>
        </TouchableRipple>

        <Divider />

        <View style={styles.bottomSection}>
          <TouchableRipple
            onPress={() =>
              openYouTubeSearch(
                `${edition}版赞美诗 ${item.number} ${item.title}`,
              )
            }
            style={styles.flexButton}
          >
            <View style={styles.buttonContent}>
              <AppIcon
                name="youtube"
                size={24}
                color={(theme.colors as any).brandYoutube}
              />
              <Text
                style={[
                  styles.buttonText,
                  { color: (theme.colors as any).brandYoutube },
                ]}
              >
                {labels.watchYouTube}
              </Text>
            </View>
          </TouchableRipple>
        </View>
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title, backTo } as any} />
      <FlatList
        style={DocumentStyles.container}
        data={displayHymns}
        keyExtractor={(item) => item.number.toString()}
        renderItem={renderHymnItem}
        ListHeaderComponent={
          <>
            <ImageBackground
              source={coverImage}
              style={[
                NavigationStyles.heroHeader,
                { paddingTop: headerHeight + 6, paddingBottom: 24 },
              ]}
              resizeMode="cover"
            >
              <LinearGradient
                colors={['rgba(9, 7, 6, 0.38)', 'rgba(9, 7, 6, 0.86)']}
                style={StyleSheet.absoluteFill}
              />
              <Text
                variant="headlineSmall"
                style={[NavigationStyles.heroTitle, { color: '#FFFFFF' }]}
              >
                {title}
              </Text>
            </ImageBackground>

            <View style={DocumentStyles.section}>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/you/legal',
                    params: { backTo: route },
                  } as any)
                }
                style={styles.legalNotice}
              >
                <Text
                  variant="bodySmall"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    textAlign: 'center',
                  }}
                >
                  <AppIcon
                    name="music-clef-treble"
                    size={14}
                    color={theme.colors.onSurfaceVariant}
                  />{' '}
                  {labels.attribution}{' '}
                  <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                    {labels.legalLink}
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>
          </>
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 50 }}
      />
    </>
  );
}

const createStyles = (
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
    bottomSection: {
      flexDirection: useStackedActions ? 'column' : 'row',
      alignItems: 'center',
    },
    flexButton: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
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
    legalNotice: {
      marginTop: 10,
      paddingHorizontal: 4,
    },
  });
