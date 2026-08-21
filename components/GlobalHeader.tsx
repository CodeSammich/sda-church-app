import { getHeaderBackTarget, hasHeaderBackButton } from '@/constants/BackNavigation';
import {
  getBibleReaderUiTextScale,
  scaleTypographyMetric,
} from '@/constants/AppPreferences';
import { LanguageContext } from '@/constants/LanguageContext';
import { useTextSize } from '@/constants/TextSizeContext';
import { getGlobalHeaderHeightForScale } from '@/hooks/useGlobalHeaderHeight';
import {
  getHymnalSearchItems,
  getHymnalSearchResults,
  getHymnalSearchSubtitle,
  type HymnalSearchItem,
} from '@/features/hymnal/HymnalSearch';
import { useAppTheme } from '@/constants/Themes';
import { AppIcon } from '@/components/AppIcon';
import { router, useSegments } from 'expo-router';
import {
  createContext,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Appbar, List, Searchbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HERO_HEADER_ROUTES = new Set([
  'about-my-church',
  'about-sda',
  'baptism',
  'bulletin',
  'discover',
  'events',
  'fellowship',
  'give',
  'hymnal-selection',
  'team',
]);

const READER_SEARCH_LABELS = {
  en: {
    searchBiblePlaceholder: 'Search this chapter...',
    searchCurrentHymnalPlaceholder: 'Search this hymnal...',
    searchAllHymnalsPlaceholder: 'Search all hymnals...',
  },
  zh: {
    searchBiblePlaceholder: '搜尋本章...',
    searchCurrentHymnalPlaceholder: '搜尋這本詩歌...',
    searchAllHymnalsPlaceholder: '搜尋所有詩歌本...',
  },
  'zh-cn': {
    searchBiblePlaceholder: '搜索本章...',
    searchCurrentHymnalPlaceholder: '搜索当前诗歌本...',
    searchAllHymnalsPlaceholder: '搜索所有诗歌本...',
  },
  es: {
    searchBiblePlaceholder: 'Buscar en este capítulo...',
    searchCurrentHymnalPlaceholder: 'Buscar en este himnario...',
    searchAllHymnalsPlaceholder: 'Buscar en todos los himnarios...',
  },
} as const;

/**
 * Context to drive global UI visibility (Reader Mode).
 */
export const UIStateContext = createContext<{
  menuAnim: Animated.Value;
  setMenuVisible: (visible: boolean) => void;
}>({
  menuAnim: new Animated.Value(1),
  setMenuVisible: () => {},
});

type BibleVerseSearchResult = {
  icon: 'format-quote-close';
  number: number;
  subtitle: string;
  text: string;
  title: string;
};
type HymnalHeaderSearchResult = HymnalSearchItem & { subtitle: string };
type HeaderSearchResult = BibleVerseSearchResult | HymnalHeaderSearchResult;

export const GlobalHeader = (props: any) => {
  const { language } = useContext(LanguageContext);
  const segments = useSegments();
  // Expo typed routes expose segments as a tuple union. Widen it for generic
  // route membership checks while preserving the runtime values.
  const routeSegments: readonly string[] = segments;
  const isBiblePage = routeSegments.includes('bible');
  const bibleTranslation = props.options?.bibleTranslation as string | undefined;
  const theme = useAppTheme();
  const { textScale } = useTextSize();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [isBibleSearchExpanded, setIsBibleSearchExpanded] = useState(false);
  const searchExpansion = useRef(new Animated.Value(0)).current;
  const searchRef = useRef<any>(null);
  const headerRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const { fontScale, width: windowWidth } = useWindowDimensions();
  const [measuredHeaderContentHeight, setMeasuredHeaderContentHeight] = useState(0);
  const headerTextScale = isBiblePage
    ? getBibleReaderUiTextScale(textScale)
    : textScale;
  const effectiveTextScale = Math.max(1, fontScale * headerTextScale);
  const compactControlHeight = Math.ceil(44 + (effectiveTextScale - 1) * 24);
  const wrappedControlHeight = Math.max(
    compactControlHeight,
    Math.ceil(40 * effectiveTextScale + 12),
  );
  const stackBibleControls =
    isBiblePage &&
    Boolean(bibleTranslation) &&
    effectiveTextScale >= 1.5;

  const { menuAnim } = useContext(UIStateContext);
  const [headerHeight, setHeaderHeight] = useState(0);

  // Animate the header off the top of the screen
  const headerTranslateY = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-((headerHeight || 150) + insets.top + 16), 0],
  });

  // Clear search state whenever the navigation path changes (switching tabs or views)
  useEffect(() => {
    setSearchQuery('');
    setIsSearching(false);
    setIsBibleSearchExpanded(false);
    searchExpansion.setValue(0);
  }, [segments.join('/')]);

  // A pillar root is the entry-point for one of our four main tabs (Tenet 5 & 7).
  // We use route segments to identify the root index files of the pillar folders.
  // In Expo Router, the (tabs) group and the tab names form the first 1-2 segments.
  const backTo = props.options?.backTo;
  const isPillarRoot = !hasHeaderBackButton(routeSegments, backTo);

  const activeHymnalRoute = routeSegments.includes('english-hymnal')
    ? '/home/english-hymnal'
    : routeSegments.includes('chinese-505-hymnal')
      ? '/home/chinese-505-hymnal'
      : routeSegments.includes('chinese-506-hymnal')
        ? '/home/chinese-506-hymnal'
        : routeSegments.includes('chinese-707-new-simplified-hymnal')
          ? '/home/chinese-707-new-simplified-hymnal'
          : routeSegments.includes('chinese-707-four-part-hymnal')
            ? '/home/chinese-707-four-part-hymnal'
            : routeSegments.includes('chinese-707-standard-hymnal')
              ? '/home/chinese-707-standard-hymnal'
              : undefined;
  const isHymnalPage = Boolean(activeHymnalRoute);
  const isHymnalSelectionPage = routeSegments.includes('hymnal-selection');
  const isHymnalSearchPage = isHymnalPage || isHymnalSelectionPage;
  const isSubPage = !isPillarRoot;

  const title = props.options?.title;
  const onBibleTranslationPress = props.options?.onBibleTranslationPress as
    | (() => void)
    | undefined;
  const onBibleSavedVersesPress = props.options?.onBibleSavedVersesPress as
    | (() => void)
    | undefined;
  const bibleSavedVerseCount = (props.options?.bibleSavedVerseCount || 0) as number;
  const bibleSavedVersesLabel =
    (props.options?.bibleSavedVersesLabel as string | undefined) || 'Saved verses';
  const bibleChapterVerses = (props.options?.bibleChapterVerses || []) as Array<{
    number: number;
    text: string;
    title: string;
  }>;
  const onBibleVerseSearchPress = props.options?.onBibleVerseSearchPress as
    | ((verseNumber: number) => void)
    | undefined;
  const isHeroHeaderRoute = HERO_HEADER_ROUTES.has(props.route?.name);
  const showTitleChip = props.options?.showTitleChip ?? !isHeroHeaderRoute;
  const appBarHeight = getGlobalHeaderHeightForScale(
    effectiveTextScale,
    stackBibleControls,
    showTitleChip ? measuredHeaderContentHeight : 0,
  );
  const titleChipAnim = useRef(new Animated.Value(showTitleChip ? 1 : 0)).current;

  useEffect(() => {
    setMeasuredHeaderContentHeight(0);
  }, [effectiveTextScale, title, windowWidth]);

  useEffect(() => {
    Animated.timing(titleChipAnim, {
      toValue: showTitleChip ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [showTitleChip, titleChipAnim]);

  const titleChipTranslateY = titleChipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-6, 0],
  });

  const searchLabels =
    READER_SEARCH_LABELS[language as keyof typeof READER_SEARCH_LABELS] ||
    READER_SEARCH_LABELS.en;

  // Hymnal readers search the complete catalog so a title in either language
  // can lead directly to the matching edition. Other screens build no results.
  const searchableItems = useMemo(
    () => {
      if (!isHymnalSearchPage) return [];
      const items = getHymnalSearchItems(language);
      return isHymnalPage
        ? items.filter(
            (item) => item.route.split('?')[0] === activeHymnalRoute,
          )
        : items;
    },
    [activeHymnalRoute, isHymnalPage, isHymnalSearchPage, language],
  );

  const filtered = useMemo(
    () =>
      getHymnalSearchResults(
        searchableItems,
        deferredSearchQuery,
        activeHymnalRoute,
      ),
    [activeHymnalRoute, deferredSearchQuery, searchableItems],
  );

  const hymnalResults: HymnalHeaderSearchResult[] = filtered.map((item) => ({
    ...item,
    subtitle: isHymnalSelectionPage
      ? `${getHymnalSearchSubtitle(language)} · ${item.hymnalLabel}`
      : getHymnalSearchSubtitle(language),
  }));

  const normalizedBibleQuery = searchQuery.trim().toLocaleLowerCase();
  const bibleResults: BibleVerseSearchResult[] = normalizedBibleQuery
    ? bibleChapterVerses
        .filter((verse) =>
          verse.text.toLocaleLowerCase().includes(normalizedBibleQuery),
        )
        .map((verse) => ({
          ...verse,
          icon: 'format-quote-close' as const,
          subtitle: verse.text,
        }))
    : [];

  const results: HeaderSearchResult[] = isBiblePage
    ? bibleResults
    : hymnalResults;

  const handleSelectResult = (item: HymnalSearchItem) => {
    const q = searchQuery.toLowerCase();
    setSearchQuery('');
    setIsSearching(false);
    setIsBibleSearchExpanded(false);
    searchExpansion.setValue(0);
    searchRef.current?.blur();

    // If already on a subpage, replace to avoid history loops.
    // Otherwise, navigate normally into the stack.
    const navFn = isSubPage ? router.replace : router.navigate;

    // Parse out existing query parameters from the route string if present.
    // This ensures Expo Router handles discrete params correctly during navigation.
    const [pathname, queryString] = item.route.split('?');
    const routeParams: Record<string, string> = {};
    if (queryString) {
      queryString.split('&').forEach((pair) => {
        const [key, value] = pair.split('=');
        routeParams[key] = decodeURIComponent(value);
      });
    }

    navFn({
      pathname: pathname as any,
      params: { ...routeParams, highlight: q },
    });
  };

  const handleSelectBibleVerse = (verseNumber: number) => {
    collapseBibleSearch();
    onBibleVerseSearchPress?.(verseNumber);
  };

  const handleBackPress = () => {
    router.replace(getHeaderBackTarget(routeSegments, backTo) as any);
  };

  const expandBibleSearch = () => {
    setIsBibleSearchExpanded(true);
    searchExpansion.setValue(0);
    Animated.timing(searchExpansion, {
      toValue: 1,
      duration: 220,
      useNativeDriver: false,
    }).start();
    setTimeout(() => searchRef.current?.focus(), 80);
  };

  const collapseBibleSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    setIsBibleSearchExpanded(false);
    searchExpansion.setValue(0);
    searchRef.current?.blur();
  };

  const expandedBibleSearchWidth = Math.min(
    windowWidth - (isSubPage ? 82 : 24),
    520,
  );
  const bibleSearchWidth = searchExpansion.interpolate({
    inputRange: [0, 1],
    outputRange: [compactControlHeight, expandedBibleSearchWidth],
  });

  const renderSearchbar = (isExpandableBible = false) => (
    <Searchbar
      ref={searchRef}
      placeholder={
        isBiblePage
          ? searchLabels.searchBiblePlaceholder
          : isHymnalSelectionPage
            ? searchLabels.searchAllHymnalsPlaceholder
            : searchLabels.searchCurrentHymnalPlaceholder
      }
      onChangeText={setSearchQuery}
      value={searchQuery}
      onFocus={() => setIsSearching(true)}
      blurOnSubmit={false}
      returnKeyType="search"
      onSubmitEditing={() => {
        if (results.length > 0) {
          if (isBiblePage) {
            handleSelectBibleVerse((results[0] as (typeof bibleResults)[number]).number);
          } else {
            handleSelectResult(results[0] as HymnalSearchItem);
          }
        }
      }}
      onBlur={() =>
        setTimeout(() => {
          setIsSearching(false);
          if (isExpandableBible && searchQuery.trim().length === 0) {
            setIsBibleSearchExpanded(false);
            searchExpansion.setValue(0);
          }
        }, 200)
      }
      right={
        isExpandableBible
          ? ({ color }) => (
              <Pressable
                onPress={collapseBibleSearch}
                accessibilityRole="button"
                accessibilityLabel="Close search"
                style={styles.searchCloseButton}
              >
                <AppIcon
                  name="close"
                  size={21}
                  textScale={headerTextScale}
                  color={color}
                />
              </Pressable>
            )
          : undefined
      }
      style={[
        styles.floatingSearchbar,
        isExpandableBible && styles.expandedBibleSearchbar,
        { minHeight: compactControlHeight },
        {
          backgroundColor: theme.colors.surface,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
        },
      ]}
      inputStyle={{
        minHeight: 0,
        paddingBottom: 0,
        paddingTop: 0,
        fontSize: scaleTypographyMetric(16, headerTextScale),
      }}
      iconColor={theme.colors.onSurfaceVariant}
      placeholderTextColor={theme.colors.onSurfaceVariant}
    />
  );

  return (
    <Animated.View
      style={[
        styles.headerWrapper,
        {
          backgroundColor: 'transparent',
          paddingTop: insets.top,
          opacity: menuAnim,
          transform: [{ translateY: headerTranslateY }],
        },
      ]}
    >
      <Appbar.Header
        ref={headerRef}
        statusBarHeight={0}
        style={{ backgroundColor: 'transparent', elevation: 0, height: appBarHeight }}
        onLayout={(e) => {
          const { height } = e.nativeEvent.layout;
          setHeaderHeight(height + insets.top);
        }}
      >
        {isSubPage && (
          <Pressable
            onPress={handleBackPress}
            style={({ pressed }) => [
              styles.circleBackButton,
              {
                width: compactControlHeight,
                height: compactControlHeight,
                borderRadius: compactControlHeight / 2,
              },
              {
                backgroundColor: theme.dark
                  ? 'rgba(18, 18, 18, 0.88)'
                  : 'rgba(255, 255, 255, 0.94)',
                borderColor: theme.dark
                  ? 'rgba(255, 255, 255, 0.28)'
                  : 'rgba(255, 255, 255, 0.72)',
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <AppIcon
              name="chevron-left"
              size={26}
              textScale={headerTextScale}
              color={theme.dark ? '#FFFFFF' : '#17211F'}
            />
          </Pressable>
        )}
        {!isBiblePage && !isHymnalSearchPage ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            {isSubPage && title && (
              <Animated.View
                pointerEvents={showTitleChip ? 'auto' : 'none'}
                onLayout={(event) => {
                  const nextHeight = Math.ceil(event.nativeEvent.layout.height);
                  setMeasuredHeaderContentHeight((currentHeight) =>
                    currentHeight === nextHeight ? currentHeight : nextHeight,
                  );
                }}
                style={[
                  styles.floatingTitleChip,
                  {
                    minHeight: compactControlHeight,
                    maxWidth: windowWidth - 86,
                    paddingHorizontal: effectiveTextScale >= 1.75 ? 8 : 16,
                  },
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outlineVariant,
                    opacity: titleChipAnim,
                    transform: [{ translateY: titleChipTranslateY }],
                  },
                ]}
              >
                <Text
                  variant="titleMedium"
                  style={{
                    color: theme.colors.onSurface,
                    fontSize: scaleTypographyMetric(16, textScale),
                    fontWeight: 'bold',
                    lineHeight: scaleTypographyMetric(20, textScale),
                    textAlign: 'center',
                  }}
                >
                  {title}
                </Text>
              </Animated.View>
            )}
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {isBiblePage ? (
              <View
                style={[
                  styles.bibleSearchContainer,
                  stackBibleControls && styles.stackedBibleSearchContainer,
                ]}
              >
                {!isBibleSearchExpanded && bibleTranslation && onBibleTranslationPress && (
                  <Pressable
                    onPress={onBibleTranslationPress}
                    accessibilityRole="button"
                    accessibilityLabel={`Translation: ${bibleTranslation}`}
                    style={({ pressed }) => [
                      styles.translationChip,
                      {
                        minHeight: stackBibleControls
                          ? wrappedControlHeight
                          : compactControlHeight,
                      },
                      stackBibleControls && styles.stackedTranslationChip,
                      {
                        backgroundColor: theme.colors.surface,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <AppIcon
                      name="translate"
                      size={18}
                      textScale={headerTextScale}
                      color={theme.colors.primary}
                    />
                    <Text
                      style={{
                        color: theme.colors.onSurface,
                        fontSize: scaleTypographyMetric(14, headerTextScale),
                        fontWeight: '700',
                        lineHeight: scaleTypographyMetric(19, headerTextScale),
                        textAlign: 'center',
                        flexShrink: 1,
                      }}
                    >
                      {bibleTranslation}
                    </Text>
                    <AppIcon
                      name="chevron-down"
                      size={17}
                      textScale={headerTextScale}
                      color={theme.colors.onSurfaceVariant}
                    />
                  </Pressable>
                )}
                {!isBibleSearchExpanded && onBibleSavedVersesPress && (
                  <Pressable
                    onPress={onBibleSavedVersesPress}
                    accessibilityRole="button"
                    accessibilityLabel={
                      bibleSavedVerseCount > 0
                        ? `${bibleSavedVersesLabel}: ${bibleSavedVerseCount}`
                        : bibleSavedVersesLabel
                    }
                    style={({ pressed }) => [
                      styles.collapsedSearchButton,
                      { height: compactControlHeight, width: compactControlHeight },
                      {
                        backgroundColor: theme.colors.surface,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <AppIcon
                      name={bibleSavedVerseCount > 0 ? 'bookmark' : 'bookmark-outline'}
                      size={23}
                      textScale={headerTextScale}
                      color={
                        bibleSavedVerseCount > 0
                          ? theme.colors.primary
                          : theme.colors.onSurfaceVariant
                      }
                    />
                  </Pressable>
                )}
                {isBibleSearchExpanded ? (
                  <Animated.View style={{ width: bibleSearchWidth }}>
                    {renderSearchbar(true)}
                  </Animated.View>
                ) : (
                  <Pressable
                    onPress={expandBibleSearch}
                    accessibilityRole="button"
                    accessibilityLabel={searchLabels.searchBiblePlaceholder}
                    style={({ pressed }) => [
                      styles.collapsedSearchButton,
                      { height: compactControlHeight, width: compactControlHeight },
                      {
                        backgroundColor: theme.colors.surface,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <AppIcon
                      name="magnify"
                      size={24}
                      textScale={headerTextScale}
                      color={theme.colors.onSurfaceVariant}
                    />
                  </Pressable>
                )}
              </View>
            ) : (
              renderSearchbar()
            )}
          </View>
        )}
      </Appbar.Header>
      {isSearching && searchQuery.length > 0 && results.length > 0 && (
        <FlatList
          data={results}
          initialNumToRender={8}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item, index) =>
            isBiblePage
              ? `verse-${(item as any).number}`
              : `${(item as HymnalSearchItem).hymnalId}-${(item as HymnalSearchItem).hymnNumber}-${index}`
          }
          maxToRenderPerBatch={8}
          renderItem={({ item }) => (
            <List.Item
              title={item.title}
              titleNumberOfLines={0}
              titleStyle={{
                fontSize: scaleTypographyMetric(16, textScale),
                lineHeight: scaleTypographyMetric(22, textScale),
                fontWeight: '700',
              }}
              description={item.subtitle}
              descriptionNumberOfLines={0}
              descriptionStyle={{
                fontSize: scaleTypographyMetric(14, textScale),
                lineHeight: scaleTypographyMetric(20, textScale),
              }}
              left={(p) => (
                <List.Icon
                  {...p}
                  icon={item.icon}
                  color={theme.colors.tertiary}
                />
              )}
              onPress={() =>
                isBiblePage
                  ? handleSelectBibleVerse((item as any).number)
                  : handleSelectResult(item as HymnalSearchItem)
              }
            />
          )}
          style={[
            styles.resultsOverlay,
            {
              top:
                Math.max(headerHeight, insets.top + appBarHeight) + 8,
              backgroundColor: theme.colors.background,
            },
          ]}
          windowSize={5}
        />
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  headerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  circleBackButton: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    marginRight: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  floatingTitleChip: {
    minHeight: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingSearchbar: {
    elevation: 4,
    borderRadius: 24,
    minHeight: 44,
    marginRight: 12,
    marginLeft: 12,
  },
  bibleSearchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 12,
    gap: 8,
  },
  stackedBibleSearchContainer: {
    flexWrap: 'wrap',
    alignContent: 'center',
    paddingVertical: 6,
  },
  translationChip: {
    minWidth: 68,
    maxWidth: 240,
    flexShrink: 1,
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  stackedTranslationChip: {
    flexBasis: '100%',
    maxWidth: '100%',
  },
  collapsedSearchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  expandedBibleSearchbar: {
    marginLeft: 0,
    marginRight: 0,
  },
  searchCloseButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    maxHeight: 420,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
});
