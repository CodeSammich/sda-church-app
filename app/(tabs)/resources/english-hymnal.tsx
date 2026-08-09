import { AppIcon } from '@/components/AppIcon';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useContext, useMemo } from 'react';
import { FlatList, ImageBackground, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Divider, Text, TouchableRipple } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  formatHymnalScriptureReference,
  getSortedHymns,
  HydratedHymn,
  openHymnal,
} from '@/constants/EnglishHymnal';
import { scaleTypographyMetric } from '@/constants/AppPreferences';
import { openYouTubeSearch } from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { DESIGN_TOKENS } from '@/constants/Layout';
import { getRoutedHymns } from '@/constants/HymnalRouting';
import { useAppTheme } from '@/constants/Themes';
import { useTextSize } from '@/constants/TextSizeContext';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import * as BibleService from '@/services/BibleService';
import { useDocumentStyles } from '@/styles/DocumentStyles';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import { LinearGradient } from 'expo-linear-gradient';

const uiLabels = {
  en: {
    title: 'SDA Hymnal — 1985 Edition',
    search: 'Search by number, title, or scripture...',
    externalLink: 'View on HymnsForWorship.org',
    legalLink: 'Legal Disclaimer',
    attribution:
      'Tap a hymn card to open its lyrics and sheet music externally on HymnsForWorship.org.',
    watchYouTube: 'YouTube',
    readScripture: 'Bible',
  },
  zh: {
    title: '英文 SDA 詩歌本 — 1985 年版',
    search: '按編號、標題或經文搜尋...',
    externalLink: '在 HymnsForWorship.org 查看',
    legalLink: '法律聲明',
    attribution: '點擊詩歌卡片即可在 HymnsForWorship.org 查看歌詞與琴譜。',
    watchYouTube: 'YouTube',
    readScripture: '查閱聖經',
  },
  'zh-cn': {
    title: '英文 SDA 诗歌本 — 1985 年版',
    search: '按编号、标题或经文搜索...',
    externalLink: '在 HymnsForWorship.org 查看',
    legalLink: '法律声明',
    attribution: '点击诗歌卡片即可在 HymnsForWorship.org 查看歌词与琴谱。',
    watchYouTube: 'YouTube',
    readScripture: '查阅圣经',
  },
  es: {
    title: 'Himnario ASD — Edición 1985',
    search: 'Buscar por número, título o referencia...',
    externalLink: 'Ver en HymnsForWorship.org',
    legalLink: 'Aviso legal',
    attribution:
      'Toca una tarjeta de himno para abrir sus letras y partituras externamente en HymnsForWorship.org.',
    watchYouTube: 'YouTube',
    readScripture: 'Biblia',
  },
};

// Module-level persistence to ensure search results remain when navigating back,
// even if the component unmounts (common in PWA/Mobile stacks).
let savedSearchQuery = '';
let lastProcessedRefresh = '';

export default function HymnalScreen() {
  const theme = useAppTheme();
  const DocumentStyles = useDocumentStyles();
  const NavigationStyles = useNavigationStyles();
  const { textScale } = useTextSize();
  const { fontScale, width } = useWindowDimensions();
  const useStackedActions =
    (width - 48) / 2 < 120 * Math.max(1, fontScale * textScale);
  const styles = useMemo(
    () => createStyles(textScale, fontScale * textScale, useStackedActions),
    [fontScale, textScale, useStackedActions],
  );
  const insets = useSafeAreaInsets();
  const headerHeight = useGlobalHeaderHeight();
  const { language } = useContext(LanguageContext);
  const { backTo, refresh, hymnNum, highlight } = useLocalSearchParams<{
    backTo?: string;
    refresh?: string;
    hymnNum?: string;
    highlight?: string;
  }>();
  const labels = uiLabels[language as keyof typeof uiLabels] || uiLabels.en;
  const allHymns = useMemo(() => getSortedHymns('en'), []);

  // If we have a highlight query from the search bar, filter the list.
  // This allows the header search to behave like a filter for this view.
  const displayHymns = useMemo(() => {
    const query = (highlight || '').toLowerCase().trim();
    return getRoutedHymns(allHymns, hymnNum, (h) =>
      !query ||
        h.number.toString().includes(query) ||
        h.title.toLowerCase().includes(query) ||
        Boolean(h.scriptureReference?.toLowerCase().includes(query)),
    );
  }, [allHymns, highlight, hymnNum]);

  const renderHymnItem = ({ item }: { item: HydratedHymn }) => {
    return (
      <View
        style={[
          styles.hymnCardContainer,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
      >
        {/* Top Section: Link to Sheet Music Website */}
        <TouchableRipple
          onPress={() => openHymnal(item.number)}
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

        {/* Bottom Action Section */}
        <View style={styles.bottomSection}>
          {/* YouTube Search */}
          <TouchableRipple
            onPress={() => openYouTubeSearch(`SDA Hymnal 1985 ${item.title}`)}
            style={styles.flexButton}
          >
            <View style={styles.buttonContent}>
              <AppIcon
                name="youtube"
                size={24}
                color={(theme.colors as any).brandYoutube}
              />
              <Text
                style={[styles.buttonText, { color: (theme.colors as any).brandYoutube }]}
              >
                {labels.watchYouTube}
              </Text>
            </View>
          </TouchableRipple>

          {item.scriptureReference && (
            <>
              <View
                style={[
                  styles.verticalDivider,
                  { backgroundColor: theme.colors.outlineVariant },
                ]}
              />
              <TouchableRipple
                onPress={() => {
                  const scripture = BibleService.parseScriptureReference(
                    item.scriptureReference,
                  );
                  router.push({
                    pathname: '/bible',
                    params: {
                      translationId: 'BSB',
                      backTo: '/resources/english-hymnal',
                      ...(scripture
                        ? {
                            bookId: scripture.bookId,
                            chapter: scripture.chapter.toString(),
                          }
                        : {}),
                    },
                  } as any);
                }}
                style={styles.flexButton}
              >
                <View style={styles.buttonContent}>
                  <AppIcon
                    name="book-cross"
                    size={22}
                    color={theme.colors.primary}
                  />
                  <Text
                    style={[styles.buttonText, { color: theme.colors.primary }]}
                  >
                    {formatHymnalScriptureReference(item.scriptureReference)}
                  </Text>
                </View>
              </TouchableRipple>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: labels.title, backTo } as any} />
      <ScrollView
        style={DocumentStyles.container}
        contentContainerStyle={{ paddingTop: 0 }}
      >
        {/* Hero */}
        <ImageBackground
          source={require('../../../public/SDAH1985.jpg')}
          style={[NavigationStyles.heroHeader, { paddingTop: headerHeight + 6, paddingBottom: 24 }]}
          resizeMode="cover"
        >
          <LinearGradient
            colors={theme.gradients.heroOverlay}
            style={StyleSheet.absoluteFill}
          />
          <Text
            variant="headlineSmall"
            style={[
              NavigationStyles.heroTitle,
              { color: theme.dark ? theme.colors.onSurface : theme.colors.onSecondary },
            ]}
          >
            {labels.title}
          </Text>
        </ImageBackground>

        {/* Body */}
        <View style={DocumentStyles.section}>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/you/legal',
                params: { backTo: '/resources/english-hymnal' },
              } as any)
            }
            style={styles.legalNotice}
          >
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}
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

        <FlatList
          data={displayHymns}
          keyExtractor={(item) => item.number.toString()}
          renderItem={renderHymnItem}
          contentContainerStyle={[
            NavigationStyles.contentContainer,
            { paddingTop: 8, paddingBottom: insets.bottom + 50 },
          ]}
        />
      </ScrollView>
    </>
  );
}

const createStyles = (
  textScale: Parameters<typeof scaleTypographyMetric>[1],
  effectiveTextScale: number,
  useStackedActions: boolean,
) => StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  cardSubtitle: {
    fontSize: scaleTypographyMetric(14, textScale),
    lineHeight: scaleTypographyMetric(20, textScale),
    marginTop: 2,
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
  searchbar: {
    borderRadius: 24,
    minHeight: Math.ceil(44 + Math.max(0, effectiveTextScale - 1) * 20),
  },
  searchbarInput: {
    minHeight: 0,
    paddingBottom: 0,
    paddingTop: 0,
    fontSize: scaleTypographyMetric(16, textScale),
  },
  legalNotice: {
    marginTop: 10,
    paddingHorizontal: 4,
  },
  attributionText: {
    marginTop: 4,
    paddingHorizontal: 4,
    opacity: 0.8,
  },
});
