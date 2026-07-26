import { LanguageContext } from '@/constants/LanguageContext';
import {
  ALL_SEARCH_LABELS,
  getSearchableItems,
  getSearchRoute,
  getSearchSubtitle,
  isSearchMatch,
  resolveBibleReference,
  SearchableItem,
} from '@/constants/SearchTerms';
import { useAppTheme } from '@/constants/Themes';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useSegments } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Appbar, List, Portal, Searchbar, Text } from 'react-native-paper';
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
  'prayer',
  'team',
]);

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

export const GlobalHeader = (props: any) => {
  const { language } = useContext(LanguageContext);
  const segments = useSegments();
  const theme = useAppTheme();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<any>(null);
  const headerRef = useRef<View>(null);
  const insets = useSafeAreaInsets();

  const { menuAnim } = useContext(UIStateContext);
  const [headerHeight, setHeaderHeight] = useState(0);

  // Animate the header off the top of the screen
  const headerTranslateY = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-(headerHeight || 150), 0],
  });

  // Clear search state whenever the navigation path changes (switching tabs or views)
  useEffect(() => {
    setSearchQuery('');
    setIsSearching(false);
  }, [segments.join('/')]);

  // A pillar root is the entry-point for one of our four main tabs (Tenet 5 & 7).
  // We use route segments to identify the root index files of the pillar folders.
  // In Expo Router, the (tabs) group and the tab names form the first 1-2 segments.
  const isPillarRoot = segments.length <= 2;

  const isBiblePage = segments.includes('bible');
  const isHymnalPage = segments.includes('english-hymnal');
  const isSubPage = !isPillarRoot;

  const title = props.options?.title;
  const backTo = props.options?.backTo;
  const isHeroHeaderRoute = HERO_HEADER_ROUTES.has(props.route?.name);
  const showTitleChip = props.options?.showTitleChip ?? !isHeroHeaderRoute;
  const titleChipAnim = useRef(new Animated.Value(showTitleChip ? 1 : 0)).current;

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
    ALL_SEARCH_LABELS[language as keyof typeof ALL_SEARCH_LABELS] || ALL_SEARCH_LABELS.en;

  // Search only the content belonging to the active reader. Other screens do
  // not expose search or build a result set.
  const searchableItems = getSearchableItems(language).filter((item) =>
    isHymnalPage
      ? item.isHymn
      : isBiblePage
        ? item.isBibleBook && item.route !== '/bible'
        : false,
  );

  const filtered = searchableItems.filter((item) =>
    isSearchMatch(item, searchQuery, language),
  );

  // A reference such as "John 3:16" can loosely match several similarly named
  // books. Keep only the resolved book while retaining any non-Bible matches on
  // the general search screen.
  const bibleReference = resolveBibleReference(searchQuery, language);
  const deduplicated = bibleReference
    ? filtered.filter(
        (item) =>
          !item.isBibleBook || item.route.includes(`bookId=${bibleReference.bookId}`),
      )
    : filtered;

  const results = deduplicated.map((item) => ({
    ...item,
    route: getSearchRoute(item, searchQuery),
    subtitle: getSearchSubtitle(item, searchQuery, language),
  }));

  const handleSelectResult = (item: SearchableItem) => {
    const q = searchQuery.toLowerCase();
    setSearchQuery('');
    setIsSearching(false);
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

  const handleBackPress = () => {
    if (backTo) {
      router.navigate(backTo as any);
    } else if (segments.includes('you')) {
      router.navigate('/you' as any);
    } else if (segments.includes('resources')) {
      router.navigate('/resources' as any);
    } else if (segments.includes('community')) {
      router.navigate('/community' as any);
    } else if (segments.includes('home')) {
      router.navigate('/' as any);
    } else {
      router.back();
    }
  };

  return (
    <Animated.View
      style={[
        styles.headerWrapper,
        {
          backgroundColor: 'transparent',
          paddingTop: insets.top,
          transform: [{ translateY: headerTranslateY }],
        },
      ]}
    >
      <Appbar.Header
        ref={headerRef}
        statusBarHeight={0}
        style={{ backgroundColor: 'transparent', elevation: 0, height: 64 }}
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
            <MaterialCommunityIcons
              name="chevron-left"
              size={26}
              color={theme.dark ? '#FFFFFF' : '#17211F'}
            />
          </Pressable>
        )}
        {!isBiblePage && !isHymnalPage ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            {isSubPage && title && (
              <Animated.View
                pointerEvents={showTitleChip ? 'auto' : 'none'}
                style={[
                  styles.floatingTitleChip,
                  {
                    backgroundColor: 'rgba(255, 255, 255, 0.94)',
                    borderColor: 'rgba(255, 255, 255, 0.72)',
                    opacity: titleChipAnim,
                    transform: [{ translateY: titleChipTranslateY }],
                  },
                ]}
              >
                <Text
                  variant="titleMedium"
                  style={{ color: '#17211F', fontWeight: 'bold' }}
                  numberOfLines={1}
                >
                  {title}
                </Text>
              </Animated.View>
            )}
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Searchbar
              ref={searchRef}
              placeholder={
                isBiblePage
                  ? searchLabels.searchBiblePlaceholder
                  : searchLabels.searchHymnalPlaceholder
              }
              onChangeText={setSearchQuery}
              value={searchQuery}
              onFocus={() => setIsSearching(true)}
              blurOnSubmit={false}
              returnKeyType="search"
              onSubmitEditing={() => {
                if (results.length > 0) {
                  handleSelectResult(results[0]);
                }
              }}
              onBlur={() => setTimeout(() => setIsSearching(false), 200)} // Delay to allow onPress to fire
              style={[
                styles.floatingSearchbar,
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
                fontSize: 16,
              }}
              iconColor={theme.colors.onSurfaceVariant}
              placeholderTextColor={theme.colors.onSurfaceVariant}
            />
            {isSearching && searchQuery.length > 0 && results.length > 0 && (
              <Portal>
                <View
                  style={[
                    styles.resultsOverlay,
                    {
                      top: headerHeight,
                      backgroundColor: theme.colors.background,
                    },
                  ]}
                >
                  {results.map((item, index) => (
                    <List.Item
                      key={index}
                      title={item.title}
                      description={item.subtitle}
                      left={(p) => (
                        <List.Icon
                          {...p}
                          icon={item.icon}
                          color={theme.colors.tertiary}
                        />
                      )}
                      onPress={() => handleSelectResult(item)}
                    />
                  ))}
                </View>
              </Portal>
            )}
          </View>
        )}
      </Appbar.Header>
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
    width: 42,
    height: 42,
    borderRadius: 21,
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
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
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
    height: 44,
    marginRight: 12,
    marginLeft: 12,
  },
  resultsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
});
