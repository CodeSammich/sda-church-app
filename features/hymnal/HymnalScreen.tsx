import { AppIcon } from '@/components/AppIcon';
import {
  type FeaturedCarouselItem,
  LibraryFeaturedCarousel,
} from '@/components/LibraryFeaturedCarousel';
import { scaleTypographyMetric } from '@/constants/AppPreferences';
import { LanguageContext, type SupportedLanguage } from '@/constants/LanguageContext';
import { DESIGN_TOKENS } from '@/constants/Layout';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import { useHeroUnderStatusBar } from '@/hooks/useHeroUnderStatusBar';
import * as BibleService from '@/services/BibleService';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import { router, Stack, useIsFocused, useLocalSearchParams } from 'expo-router';
import {
  memo,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Searchbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createHymnRowStyles, HymnRow, type HymnRowLabels } from './HymnRow';
import {
  getHymnalLabel,
  getHymnalShortLabel,
  getHymnalTitleParts,
  type HymnalBookId,
} from './HymnalLabels';
import {
  getDisplayedHymns,
  getHymnalOrder,
  HYMNAL_SELECTION_ROUTE,
  HYMNALS,
  type HymnalHymn,
  isHymnalBookId,
} from './Hymnals';
import {
  getHymnalSearchItems,
  getHymnalSearchResults,
  type HymnalSearchItem,
} from './HymnalSearch';

const copy = {
  en: {
    title: 'Hymnals',
    english: 'English',
    chinese: 'Chinese',
    hymnalPage: (name: string, page: number, count: number) =>
      `${name}, hymnal ${page} of ${count}`,
    lookup: 'English–Chinese Hymn Lookup',
    searchEnglish: 'Search by number, title, or scripture...',
    searchChinese: 'Search by number or title...',
    searchButton: 'Search this hymnal',
    showAll: 'Show all hymns',
    noMatch: 'No hymns match your search.',
    otherHymnals: 'In other hymnals',
    otherResultLabel: (hymnal: string, number: number | string, title: string) =>
      `${hymnal}, hymn ${number}, ${title}`,
    watchYouTube: 'YouTube',
    crossReferenceNames: { english: 'SDA Hymnal 1985', chinese: 'Chinese Hymnal 505' },
    crossReferenceLabel: (name: string, number: number) => `${name}, hymn ${number}`,
    crossReferenceHint: 'Shows this hymn in that hymnal',
  },
  zh: {
    title: '詩歌本',
    english: '英文',
    chinese: '中文',
    hymnalPage: (name: string, page: number, count: number) =>
      `${name}，第 ${page}/${count} 本`,
    lookup: '英中詩歌編號對照',
    searchEnglish: '按編號、標題或經文搜尋...',
    searchChinese: '按編號或標題搜尋...',
    searchButton: '搜尋這本詩歌',
    showAll: '顯示全部詩歌',
    noMatch: '沒有符合搜尋的詩歌。',
    otherHymnals: '其他詩歌本',
    otherResultLabel: (hymnal: string, number: number | string, title: string) =>
      `${hymnal}第 ${number} 首，${title}`,
    watchYouTube: 'YouTube',
    crossReferenceNames: { english: '英文 SDA 詩歌本 1985 年版', chinese: '中文讚美詩 505 版' },
    crossReferenceLabel: (name: string, number: number) => `${name}第 ${number} 首`,
    crossReferenceHint: '在那本詩歌本中顯示這首詩歌',
  },
  'zh-cn': {
    title: '诗歌本',
    english: '英文',
    chinese: '中文',
    hymnalPage: (name: string, page: number, count: number) =>
      `${name}，第 ${page}/${count} 本`,
    lookup: '英中诗歌编号对照',
    searchEnglish: '按编号、标题或经文搜索...',
    searchChinese: '按编号或标题搜索...',
    searchButton: '搜索当前诗歌本',
    showAll: '显示全部诗歌',
    noMatch: '没有符合搜索的诗歌。',
    otherHymnals: '其他诗歌本',
    otherResultLabel: (hymnal: string, number: number | string, title: string) =>
      `${hymnal}第 ${number} 首，${title}`,
    watchYouTube: 'YouTube',
    crossReferenceNames: { english: '英文 SDA 诗歌本 1985 年版', chinese: '中文赞美诗 505 版' },
    crossReferenceLabel: (name: string, number: number) => `${name}第 ${number} 首`,
    crossReferenceHint: '在那本诗歌本中显示这首诗歌',
  },
  es: {
    title: 'Himnarios',
    english: 'Inglés',
    chinese: 'Chino',
    hymnalPage: (name: string, page: number, count: number) =>
      `${name}, himnario ${page} de ${count}`,
    lookup: 'Correspondencia de Himnos en Inglés y Chino',
    searchEnglish: 'Buscar por número, título o referencia...',
    searchChinese: 'Buscar por número o título...',
    searchButton: 'Buscar en este himnario',
    showAll: 'Mostrar todos los himnos',
    noMatch: 'Ningún himno coincide con tu búsqueda.',
    otherHymnals: 'En otros himnarios',
    otherResultLabel: (hymnal: string, number: number | string, title: string) =>
      `${hymnal}, himno ${number}, ${title}`,
    watchYouTube: 'YouTube',
    crossReferenceNames: { english: 'Himnario ASD 1985', chinese: 'Himnario Chino 505' },
    crossReferenceLabel: (name: string, number: number) => `${name}, himno ${number}`,
    crossReferenceHint: 'Muestra este himno en ese himnario',
  },
} as const;

// The list holds the picked hymnal's hymns and, while searching, a heading
// and the matches from the other hymnals.
const OTHER_HYMNALS_HEADING = { kind: 'heading' } as const;
type OtherHymnalResult = Readonly<{ kind: 'other'; item: HymnalSearchItem }>;
type HymnalListItem = HymnalHymn | typeof OTHER_HYMNALS_HEADING | OtherHymnalResult;

const isHymn = (item: HymnalListItem): item is HymnalHymn => !('kind' in item);

/** One hymnal's search, or the hymn a link or cross-reference opened in it. */
type HymnalView = Readonly<{ query: string; hymnNum?: string }>;

const EMPTY_VIEW: HymnalView = { query: '' };

const firstParam = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

// A routed hymn shows on its own, as on the old hymnal pages; the search,
// from `highlight`, applies only when the hymnal doesn't have that hymn.
const getRoutedView = (
  hymnalId: HymnalBookId,
  hymnNum: string | undefined,
  highlight: string | undefined,
): HymnalView => {
  const hasHymn =
    !!hymnNum &&
    HYMNALS[hymnalId].getHymns().some((hymn) => hymn.number.toString() === hymnNum);
  return hasHymn ? { query: '', hymnNum } : { query: highlight ?? '', hymnNum };
};

const getHref = (route: string, params: Record<string, string | undefined>) => {
  const query = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => !!entry[1]),
  ).toString();
  return query ? `${route}?${query}` : route;
};

type HymnalScreenProps = Readonly<{
  /** The hymnal an old hymnal route opens, such as the English hymnal's. */
  defaultHymnalId?: HymnalBookId;
}>;

/**
 * The hymnal page: a carousel of the hymnals, in the Library's featured style,
 * picks one, and its search and hymns follow below, all in one list. The
 * app language's hymnals come first.
 *
 * It's at /home/hymnal-selection and at each hymnal's own older route, which
 * opens with that hymnal picked. Each route takes `hymnal` (to pick another
 * one), `hymnNum` (to show just that hymn), `highlight` (a search), and
 * `backTo`. Each hymnal keeps its own search while another one is showing,
 * and a search lists the other hymnals' matches after the hymnal's own.
 */
export function HymnalScreen({ defaultHymnalId }: HymnalScreenProps) {
  const theme = useAppTheme();
  const NavigationStyles = useNavigationStyles();
  const { textScale } = useTextSize();
  const { fontScale, width } = useWindowDimensions();
  const effectiveTextScale = fontScale * textScale;
  const useStackedActions = (width - 48) / 2 < 120 * Math.max(1, effectiveTextScale);
  const rowStyles = useMemo(
    () => createHymnRowStyles(textScale, effectiveTextScale, useStackedActions),
    [effectiveTextScale, textScale, useStackedActions],
  );
  const styles = useMemo(
    () => createStyles(textScale, effectiveTextScale),
    [effectiveTextScale, textScale],
  );
  const insets = useSafeAreaInsets();
  const headerHeight = useGlobalHeaderHeight();
  const isFocused = useIsFocused();
  const { language } = useContext(LanguageContext);
  const labels = copy[language as SupportedLanguage] || copy.en;
  // The carousel is dark in both themes, so the status bar uses light icons
  // while it's behind them, and the header shows the hymnal's name once it
  // has scrolled away.
  const { heroUnderStatusBar, onHeroLayout, onScroll } = useHeroUnderStatusBar();

  const params = useLocalSearchParams<{
    backTo?: string;
    hymnal?: string;
    hymnNum?: string;
    highlight?: string;
    refresh?: string;
  }>();
  const backTo = firstParam(params.backTo);
  const hymnalParam = firstParam(params.hymnal);
  const hymnNum = firstParam(params.hymnNum);
  const highlight = firstParam(params.highlight);
  const refresh = firstParam(params.refresh);
  const routedHymnalId = isHymnalBookId(hymnalParam) ? hymnalParam : defaultHymnalId;
  const route = defaultHymnalId ? HYMNALS[defaultHymnalId].route : HYMNAL_SELECTION_ROUTE;
  const order = useMemo(() => getHymnalOrder(language), [language]);

  const [selectedId, setSelectedId] = useState<HymnalBookId>(
    () => routedHymnalId ?? order[0],
  );
  const [views, setViews] = useState<Partial<Record<HymnalBookId, HymnalView>>>(() =>
    routedHymnalId ? { [routedHymnalId]: getRoutedView(routedHymnalId, hymnNum, highlight) } : {},
  );
  const viewsRef = useRef(views);
  viewsRef.current = views;
  const listRef = useRef<FlatList<HymnalListItem>>(null);
  // Like the header's search: Paper's Searchbar handle isn't exported.
  const searchRef = useRef<any>(null);
  const searchTop = useRef(0);

  // A link to this page while it's open, such as the way back from the Bible,
  // picks its hymnal and hymn again.
  const routeKey = [routedHymnalId, hymnNum, highlight, refresh].join('|');
  const appliedRouteKey = useRef(routeKey);
  useEffect(() => {
    if (appliedRouteKey.current === routeKey) return;
    appliedRouteKey.current = routeKey;
    if (!routedHymnalId) return;
    setSelectedId(routedHymnalId);
    setViews((current) => ({
      ...current,
      [routedHymnalId]: getRoutedView(routedHymnalId, hymnNum, highlight),
    }));
    listRef.current?.scrollToOffset({ animated: false, offset: 0 });
  }, [highlight, hymnNum, routeKey, routedHymnalId]);

  const selectedIndex = Math.max(0, order.indexOf(selectedId));
  const selectedLabel = getHymnalLabel(selectedId, language);
  const hymns = HYMNALS[selectedId].getHymns();
  const view = views[selectedId] ?? EMPTY_VIEW;
  // The list catches up with typing a moment later, but never filters a
  // newly picked hymnal by the last one's search.
  const deferred = useDeferredValue(`${selectedId}\n${view.query}`);
  const query = deferred.startsWith(`${selectedId}\n`)
    ? deferred.slice(selectedId.length + 1)
    : view.query;
  const displayHymns = useMemo(
    () => getDisplayedHymns(hymns, view.hymnNum, query),
    [hymns, query, view.hymnNum],
  );
  const routedHymn =
    view.hymnNum !== undefined && displayHymns.length === 1 &&
    displayHymns[0].number.toString() === view.hymnNum
      ? displayHymns[0]
      : undefined;
  // A search also looks through every other hymnal, as the header's search
  // across all hymnals once did, with the 1985 ↔ 505 equivalents of the
  // picked hymnal's matches first.
  const otherResults = useMemo(
    () =>
      routedHymn || !query.trim()
        ? []
        : getHymnalSearchResults(getHymnalSearchItems(language), query, {
            activeHymnalId: selectedId,
            excludeActive: true,
          }),
    [language, query, routedHymn, selectedId],
  );
  const listData = useMemo<readonly HymnalListItem[]>(
    () =>
      otherResults.length
        ? [
            ...displayHymns,
            OTHER_HYMNALS_HEADING,
            ...otherResults.map((item) => ({ kind: 'other' as const, item })),
          ]
        : displayHymns,
    [displayHymns, otherResults],
  );

  const setView = useCallback(
    (hymnalId: HymnalBookId, next: HymnalView) =>
      setViews((current) => ({ ...current, [hymnalId]: next })),
    [],
  );

  const carouselItems = useMemo<FeaturedCarouselItem[]>(
    () =>
      order.map((hymnalId) => {
        const { title, edition } = getHymnalTitleParts(hymnalId, language);
        return {
          key: hymnalId,
          title,
          author: edition,
          coverSource: HYMNALS[hymnalId].cover,
          eyebrow: HYMNALS[hymnalId].language === 'en' ? labels.english : labels.chinese,
        };
      }),
    [labels, language, order],
  );

  const rowLabels = useMemo<HymnRowLabels>(
    () => ({
      watchYouTube: labels.watchYouTube,
      crossReference: (hymnalId, number) =>
        `${getHymnalShortLabel(hymnalId, language)} · ${number}`,
      crossReferenceLabel: (hymnalId, number) =>
        labels.crossReferenceLabel(
          hymnalId === 'sdah-1985-en'
            ? labels.crossReferenceNames.english
            : labels.crossReferenceNames.chinese,
          number,
        ),
      crossReferenceHint: labels.crossReferenceHint,
    }),
    [labels, language],
  );

  // Shows a hymn in its hymnal, as a link to it would: the same hymn from a
  // cross-reference, or a search result from another hymnal.
  const openCrossReference = useCallback(
    (hymnalId: HymnalBookId, number: number | string) => {
      setSelectedId(hymnalId);
      setView(hymnalId, { query: '', hymnNum: number.toString() });
      listRef.current?.scrollToOffset({ animated: false, offset: 0 });
    },
    [setView],
  );

  // Coming back from the Bible reopens this hymnal as it was: the same hymn
  // or search, and the same place to go back to, such as the Bulletin or Hymn
  // lookup.
  const openScripture = useCallback(
    (hymnalId: HymnalBookId, reference: string) => {
      const scripture = BibleService.parseScriptureReference(reference);
      const current = viewsRef.current[hymnalId] ?? EMPTY_VIEW;
      router.push({
        pathname: '/bible',
        params: {
          translationId: 'BSB',
          backTo: getHref(route, {
            hymnal: hymnalId !== defaultHymnalId ? hymnalId : undefined,
            backTo,
            hymnNum: current.hymnNum,
            highlight: current.query,
          }),
          ...(scripture
            ? { bookId: scripture.bookId, chapter: scripture.chapter.toString() }
            : {}),
        },
      } as any);
    },
    [backTo, defaultHymnalId, route],
  );

  // The lookup comes back to this page with its params unchanged, so the
  // page keeps its hymnal and searches.
  const openLookup = () =>
    router.push({
      pathname: '/home/hymn-lookup',
      params: {
        backTo: getHref(route, { hymnal: hymnalParam, backTo, hymnNum, highlight, refresh }),
      },
    } as any);

  const focusSearch = useCallback(() => {
    listRef.current?.scrollToOffset({
      animated: true,
      offset: Math.max(0, searchTop.current - headerHeight - 8),
    });
    setTimeout(() => searchRef.current?.focus(), 300);
  }, [headerHeight]);

  const showHymnalName = !heroUnderStatusBar;
  const screenOptions = useMemo(
    () => ({
      title: showHymnalName ? selectedLabel : labels.title,
      backTo,
      heroUnderStatusBar,
      showTitleChip: showHymnalName,
      headerSearchButton: showHymnalName
        ? { label: labels.searchButton, onPress: focusSearch }
        : undefined,
    }),
    [backTo, focusSearch, heroUnderStatusBar, labels, selectedLabel, showHymnalName],
  );

  const renderItem = useCallback(
    ({ item }: { item: HymnalListItem }) =>
      isHymn(item) ? (
        <HymnRow
          hymnalId={selectedId}
          hymn={item}
          highlighted={item === routedHymn}
          labels={rowLabels}
          styles={rowStyles}
          onOpenScripture={openScripture}
          onOpenCrossReference={openCrossReference}
        />
      ) : item.kind === 'heading' ? (
        <Text
          accessibilityRole="header"
          style={[styles.otherHeading, { color: theme.colors.onSurface }]}
        >
          {labels.otherHymnals}
        </Text>
      ) : (
        <OtherHymnalRow
          accessibilityHint={labels.crossReferenceHint}
          accessibilityLabel={labels.otherResultLabel(
            getHymnalLabel(item.item.hymnalId, language),
            item.item.hymnNumber,
            item.item.title.replace(`${item.item.hymnNumber}. `, ''),
          )}
          hymnalName={getHymnalShortLabel(item.item.hymnalId, language)}
          item={item.item}
          onOpen={openCrossReference}
          styles={styles}
        />
      ),
    [
      labels,
      language,
      openCrossReference,
      openScripture,
      routedHymn,
      rowLabels,
      rowStyles,
      selectedId,
      styles,
      theme,
    ],
  );

  const searchPlaceholder =
    HYMNALS[selectedId].language === 'en' ? labels.searchEnglish : labels.searchChinese;

  const listHeader = (
    <View>
      <View onLayout={onHeroLayout}>
        <LibraryFeaturedCarousel
          books={carouselItems}
          page={selectedIndex}
          pageLabel={(page, count, book) =>
            labels.hymnalPage(`${book.title} — ${book.author}`, page, count)}
          onPageChange={(page) => setSelectedId(order[page] ?? order[0])}
        />
      </View>
      {/* The English–Chinese lookup, which matches numbers in 1985 and 505. */}
      <Pressable
        accessibilityLabel={labels.lookup}
        accessibilityRole="button"
        onPress={openLookup}
        style={({ pressed }) => [
          styles.lookupChip,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outline,
            opacity: pressed ? 0.75 : 1,
          },
          Platform.OS === 'web' ? styles.webPressable : null,
        ]}
      >
        <AppIcon name="translate" size={18} color={theme.colors.primary} />
        <Text style={[styles.lookupText, { color: theme.colors.primary }]}>1985 ↔ 505</Text>
      </Pressable>
      <View
        onLayout={(event: LayoutChangeEvent) => {
          searchTop.current = event.nativeEvent.layout.y;
        }}
        style={styles.searchArea}
      >
        <Searchbar
          ref={searchRef}
          accessibilityLabel={searchPlaceholder}
          iconColor={theme.colors.onSurfaceVariant}
          inputStyle={styles.searchbarInput}
          onChangeText={(text) => setView(selectedId, { query: text })}
          placeholder={searchPlaceholder}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          returnKeyType="search"
          style={[
            styles.searchbar,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline },
          ]}
          value={view.query}
        />
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen options={screenOptions as any} />
      {isFocused && heroUnderStatusBar && <StatusBar barStyle="light-content" />}
      <FlatList
        ref={listRef}
        style={NavigationStyles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + 50 }}
        data={listData}
        initialNumToRender={6}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) =>
          isHymn(item)
            ? item.number.toString()
            : item.kind === 'heading'
              ? 'other-hymnals'
              : `${item.item.hymnalId}:${item.item.hymnNumber}`}
        // Only when no hymnal at all has a match.
        ListEmptyComponent={
          <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
            {labels.noMatch}
          </Text>
        }
        ListFooterComponent={
          routedHymn ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setView(selectedId, EMPTY_VIEW)}
              style={({ pressed }) => [
                styles.showAll,
                { opacity: pressed ? 0.7 : 1 },
                Platform.OS === 'web' ? styles.webPressable : null,
              ]}
            >
              <Text style={[styles.showAllText, { color: theme.colors.primary }]}>
                {labels.showAll}
              </Text>
            </Pressable>
          ) : undefined
        }
        ListHeaderComponent={listHeader}
        onScroll={onScroll}
        renderItem={renderItem}
        scrollEventThrottle={16}
      />
    </>
  );
}

type OtherHymnalRowProps = Readonly<{
  accessibilityHint: string;
  accessibilityLabel: string;
  hymnalName: string;
  item: HymnalSearchItem;
  onOpen: (hymnalId: HymnalBookId, hymnNumber: number | string) => void;
  styles: ReturnType<typeof createStyles>;
}>;

/** A search result from another hymnal: its hymnal, number, and title. */
const OtherHymnalRow = memo(function OtherHymnalRow({
  accessibilityHint,
  accessibilityLabel,
  hymnalName,
  item,
  onOpen,
  styles,
}: OtherHymnalRowProps) {
  const theme = useAppTheme();
  return (
    <View style={styles.otherItem}>
      <Pressable
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={() => onOpen(item.hymnalId, item.hymnNumber)}
        style={({ pressed }) => [
          styles.otherRow,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outlineVariant,
            opacity: pressed ? 0.75 : 1,
          },
          Platform.OS === 'web' ? styles.webPressable : null,
        ]}
      >
        <View style={styles.otherText}>
          <Text style={[styles.otherHymnal, { color: theme.colors.primary }]}>{hymnalName}</Text>
          <Text style={[styles.otherTitle, { color: theme.colors.onSurface }]}>{item.title}</Text>
        </View>
        <AppIcon
          name="chevron-right"
          size={DESIGN_TOKENS.ICON_SIZE_STANDARD}
          color={theme.colors.onSurfaceVariant}
        />
      </Pressable>
    </View>
  );
});

const createStyles = (
  textScale: Parameters<typeof scaleTypographyMetric>[1],
  effectiveTextScale: number,
) =>
  StyleSheet.create({
    lookupChip: {
      alignItems: 'center',
      alignSelf: 'center',
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      marginTop: -8,
      minHeight: Math.ceil(40 + Math.max(0, effectiveTextScale - 1) * 16),
      paddingHorizontal: 16,
      paddingVertical: 6,
    },
    lookupText: {
      fontSize: scaleTypographyMetric(15, textScale),
      fontWeight: '700',
      lineHeight: scaleTypographyMetric(20, textScale),
    },
    searchArea: {
      paddingBottom: 12,
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    searchbar: {
      borderRadius: 24,
      borderWidth: 1,
      elevation: 0,
      minHeight: Math.ceil(44 + Math.max(0, effectiveTextScale - 1) * 20),
    },
    searchbarInput: {
      minHeight: 0,
      paddingBottom: 0,
      paddingTop: 0,
      fontSize: scaleTypographyMetric(16, textScale),
    },
    message: {
      fontSize: scaleTypographyMetric(15, textScale),
      lineHeight: scaleTypographyMetric(22, textScale),
      paddingHorizontal: 20,
      paddingVertical: 24,
      textAlign: 'center',
    },
    otherHeading: {
      fontSize: scaleTypographyMetric(18, textScale),
      fontWeight: '700',
      lineHeight: scaleTypographyMetric(24, textScale),
      paddingBottom: 10,
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    otherItem: {
      paddingHorizontal: 20,
    },
    otherRow: {
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
      minHeight: Math.ceil(48 + Math.max(0, effectiveTextScale - 1) * 20),
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    otherText: {
      flex: 1,
      minWidth: 0,
    },
    otherHymnal: {
      fontSize: scaleTypographyMetric(13, textScale),
      fontWeight: '700',
      lineHeight: scaleTypographyMetric(18, textScale),
    },
    otherTitle: {
      fontSize: scaleTypographyMetric(16, textScale),
      fontWeight: '600',
      lineHeight: scaleTypographyMetric(22, textScale),
    },
    showAll: {
      alignItems: 'center',
      alignSelf: 'center',
      justifyContent: 'center',
      minHeight: Math.ceil(44 + Math.max(0, effectiveTextScale - 1) * 20),
      paddingHorizontal: 20,
    },
    showAllText: {
      fontSize: scaleTypographyMetric(16, textScale),
      fontWeight: '700',
      lineHeight: scaleTypographyMetric(22, textScale),
    },
    webPressable: {
      cursor: 'pointer',
    },
  });
