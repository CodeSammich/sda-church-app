import { GridMenuCard } from '@/components/GridMenuCard';
import {
  EXTERNAL_BRAND_ASSETS,
  EXTERNAL_BRAND_ICON_CONTENT_SCALE,
} from '@/constants/ExternalBrandAssets';
import { labelsFitSideBySide, WrappingActionButton } from '@/components/WrappingActionButton';
import { scaleTypographyMetric } from '@/constants/AppPreferences';
import {
  CHURCH_BUILDING_IMAGE_URL,
  CHURCH_LATITUDE,
  CHURCH_LONGITUDE,
  openSabbathStream,
} from '@/constants/ExternalLinks';
import { LanguageContext, SupportedLanguage } from '@/constants/LanguageContext';
import {
  contentColumnStyle,
  contentColumnWithin,
  DESIGN_TOKENS,
  getContentWidth,
  getCountdownFontSize,
} from '@/constants/Layout';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import * as BibleService from '@/services/BibleService';
import { getVerseOfTheDay, getVerseOfTheDayDateKey } from '@/services/VerseOfTheDay';
import {
  formatVerseOfTheDayShare,
  getTranslationName,
  loadVerseOfTheDayText,
} from '@/services/VerseOfTheDayText';
import { updateVerseOfTheDayWidget } from '@/services/VerseOfTheDayWidget';
import { getSunTimes } from '@/services/SunTimesService';
import { readCachedText, writeCachedText } from '@/services/CacheStore';
import { createNavigationStyles } from '@/styles/NavigationStyles';
import { HEADER_MAX_FONT_SCALE } from '@/hooks/useGlobalHeaderHeight';
import { useHeroUnderStatusBar } from '@/hooks/useHeroUnderStatusBar';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useContext, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { ImageBackground } from '@/components/ImageBackground';
import { Card, List, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBarSpacer } from '@/constants/BottomTabHeightContext';

export default function HomeScreen() {
  const { language } = useContext(LanguageContext);
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { heroUnderStatusBar, onHeroLayout, onScroll } = useHeroUnderStatusBar();
  // Home re-renders every second for the countdown. A new options object each
  // time would update the tab navigator, and every tab's header, as often.
  const screenOptions = useMemo(() => ({ heroUnderStatusBar }), [heroUnderStatusBar]);
  const { textScale } = useTextSize();
  const { fontScale, width: windowWidth } = useWindowDimensions();
  const effectiveTextScale = Math.max(1, fontScale * textScale);
  // Keep the home card grid at two columns at every text zoom level.
  const useStackedLayout = false;
  const styles = useMemo(
    () => createStyles(textScale, effectiveTextScale, useStackedLayout),
    [effectiveTextScale, textScale, useStackedLayout],
  );
  const navigationStyles = useMemo(
    () =>
      createNavigationStyles(textScale, {
        bottomInset: insets.bottom,
        fontScale,
      }),
    [fontScale, insets.bottom, textScale],
  );

  const allLabels = {
    en: {
      subtitle: 'Loading daily verse...',
      verseOfDay: 'Today’s Verse',
      readVerse: 'Read Verse',
      shareVerse: 'Share Verse',
      livestream: 'Watch Livestream',
      discover: 'New Member & Visitor',
      bulletin: 'Weekly Bulletin',
      give: 'Tithe & Offering',
      sabbathSchool: 'This Week’s Lesson',
      hymnal: 'Hymnal',
      sabbathStarts: 'Sabbath starts in',
      sabbathEnds: 'Sabbath ends in',
      // decided to remove the dynamic location since most people don't like to give away location
      // instead, each congregation shuold adjust the code to use their own location coordinates
      locationDefault: 'New York, NY',
    },
    zh: {
      subtitle: '正在載入經文...',
      verseOfDay: '今日經文',
      readVerse: '查閱經文',
      shareVerse: '分享經文',
      livestream: '觀看直播',
      discover: '新會友／訪客',
      bulletin: '每週週報',
      give: '奉獻',
      sabbathSchool: '本週安息日學課程',
      hymnal: '詩歌本',
      sabbathStarts: '距離安息日還有',
      sabbathEnds: '距離安息日結束還有',
      // decided to remove the dynamic location since most people don't like to give away location
      // instead, each congregation shuold adjust the code to use their own location coordinates
      locationDefault: '紐約',
    },
    'zh-cn': {
      subtitle: '正在载入经文...',
      verseOfDay: '今日经文',
      readVerse: '查阅经文',
      shareVerse: '分享经文',
      livestream: '观看直播',
      discover: '新会友／访客',
      bulletin: '每周周报',
      give: '奉献',
      sabbathSchool: '本周安息日学课程',
      hymnal: '诗歌本',
      sabbathStarts: '距离安息日还有',
      sabbathEnds: '距离安息日结束还有',
      locationDefault: '纽约',
    },
    es: {
      subtitle: 'Cargando versículo...',
      verseOfDay: 'Versículo de hoy',
      readVerse: 'Leer Versículo',
      shareVerse: 'Compartir',
      livestream: 'Ver Transmisión',
      discover: 'Nuevo miembro & Visitante',
      bulletin: 'Boletín Semanal',
      give: 'Diezmos y Ofrendas',
      sabbathSchool: 'Lección de esta semana',
      hymnal: 'Himnario',
      sabbathStarts: 'El Sábado comienza en',
      sabbathEnds: 'El Sábado termina en',
      // decided to remove the dynamic location since most people don't like to give away location
      // instead, each congregation shuold adjust the code to use their own location coordinates
      locationDefault: 'New York, NY',
    },
  };

  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;
  // The timer's size on screen, with both text sizes counted in, less the
  // phone's, which the text applies again itself.
  const countdownFontSize =
    getCountdownFontSize(getContentWidth(windowWidth, effectiveTextScale), effectiveTextScale) / fontScale;
  // One size for every card's text, which keeps each title's words whole.
  const gridTitles = useMemo(
    () => [labels.livestream, labels.bulletin, labels.give, labels.hymnal, labels.sabbathSchool, labels.discover],
    [labels],
  );
  // Once the app's and the phone's text sizes add up to 2× or more, the verse
  // card's two buttons each get a full row, so words like "Compartir" are
  // never cut off or broken mid-word (#385). So they do, too, wherever a word
  // of either button's label wouldn't fit beside the other button: on a narrow
  // phone in Spanish, or in a narrow iPad window (#324). The Sabbath countdown
  // has its own rule, below.
  const stackHeroActions =
    effectiveTextScale >= 2 ||
    !labelsFitSideBySide(
      [(labels as any).shareVerse, (labels as any).readVerse],
      getHeroActionsRowWidth(windowWidth, effectiveTextScale),
      HERO_ACTIONS_GAP,
      effectiveTextScale,
    );

  const [verseOfTheDay, setVerseOfTheDay] = useState<{
    text: string;
    reference: string;
    bookId: string;
    chapter: number;
    verse: number;
    dateKey: string;
  } | null>(null);

  const [isSabbath, setIsSabbath] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [useGps, setUseGps] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [sunsets, setSunsets] = useState<{ fri: Date | null; sat: Date | null }>({
    fri: null,
    sat: null,
  });

  // A copy the app can download again, kept out of the phone's backup (#524).
  const VOTD_CACHE = { folder: 'verse-of-the-day', name: `${language}.json`, key: `votd_cache_${language}` };

  // Sabbath Countdown Logic
  // NOTE: There is nothing wrong with this logic itself, but after user testing it looks like most people turn off
  // location tracking and there is not much demand. Instead, it may be better to let each congregation
  // hard code their location coordinates. I've left this code in case people want to use it.
  // All you need to do is add a local-set of labels and a conditional check on the timer display text below.
  // useEffect(() => {
  //   // Detect Location via Web Geolocation API
  //   if (Platform.OS === 'web' && 'geolocation' in navigator) {
  //     navigator.geolocation.getCurrentPosition(
  //       (position) => {
  //         // User allowed location
  //         setUseGps(true);
  //         setUserCoords({
  //           lat: position.coords.latitude,
  //           lng: position.coords.longitude,
  //         });
  //       },
  //       (error) => {
  //         // Permission denied or error
  //         setUseGps(false);
  //         console.log('Location access denied, falling back to New York.');
  //       },
  //       { enableHighAccuracy: false, timeout: 5000, maximumAge: 3600000 },
  //     );
  //   } else {
  //     // Fallback for offline or unsupported browsers
  //     setUseGps(false);
  //   }
  // }, []);

  useEffect(() => {
    const lat = useGps && userCoords ? userCoords.lat : CHURCH_LATITUDE;
    const lng = useGps && userCoords ? userCoords.lng : CHURCH_LONGITUDE;

    const getDay = (d: number) => {
      const t = new Date();
      t.setDate(t.getDate() + (d - t.getDay()));
      return t;
    };

    setSunsets({
      fri: getSunTimes(lat, lng, getDay(5))?.sunset ?? null,
      sat: getSunTimes(lat, lng, getDay(6))?.sunset ?? null,
    });
  }, [useGps, userCoords, new Date().toDateString()]);

  useEffect(() => {
    // If GPS status changes (user clicks "Allow"), the component will re-render
    // and this timer logic will re-calculate based on the new context.
    if (countdown) setCountdown(''); // Reset display to trigger immediate refresh

    const updateTimer = () => {
      const now = new Date();
      const day = now.getDay();

      const getFallback = (d: number) => {
        const t = new Date(now);
        t.setDate(now.getDate() + (d - day));
        t.setHours(18, 0, 0, 0);
        return t;
      };

      const friTarget = sunsets.fri || getFallback(5);
      const satTarget = sunsets.sat || getFallback(6);

      let isSabbathNow = false;
      let target: Date;

      if (now < friTarget) {
        isSabbathNow = false;
        target = friTarget;
      } else if (now < satTarget) {
        isSabbathNow = true;
        target = satTarget;
      } else {
        isSabbathNow = false;
        target = new Date(friTarget);
        target.setDate(target.getDate() + 7);
      }

      setIsSabbath(isSabbathNow);

      const diff = Math.max(0, target.getTime() - now.getTime());
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);

      const dStr = d > 0 ? `${d}d ` : '';
      setCountdown(
        `${dStr}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`,
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [useGps, sunsets]); // Re-run timer logic if GPS permission or sunset data changes

  const loadVerseOfTheDay = async (isCurrent: () => boolean) => {
    try {
      // Every language shows the same curated verse, which changes at 6 AM.
      const now = new Date();
      const dateKey = getVerseOfTheDayDateKey(now);
      const selection = getVerseOfTheDay(now);
      const transId =
        BibleService.DEFAULT_TRANSLATION_MAP[language as SupportedLanguage] || 'BSB';

      // Show today's verse from the cache straight away, even offline, then
      // refresh its text from the chapter.
      const cached = await readCachedText(VOTD_CACHE);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (
          isCurrent() &&
          parsed.dateKey === dateKey &&
          parsed.bookId === selection.bookId &&
          parsed.chapter === selection.chapter &&
          parsed.verse === selection.verse &&
          typeof parsed.text === 'string'
        ) {
          setVerseOfTheDay(parsed);
        }
      }

      const loaded = await loadVerseOfTheDayText(transId, selection);
      if (!loaded || !isCurrent()) return;

      const verse = { ...loaded, dateKey };
      setVerseOfTheDay(verse);
      await writeCachedText(VOTD_CACHE, JSON.stringify(verse));
      // The Android home screen widget gets this week's verses too (#235).
      await updateVerseOfTheDayWidget(language as SupportedLanguage, {
        title: labels.verseOfDay,
        share: (labels as any).shareVerse,
      });
    } catch (e) {
      console.warn('Failed to load the verse of the day:', e);
    }
  };

  useEffect(() => {
    // A request still loading for the previous language must not replace
    // the new language's verse.
    let current = true;
    loadVerseOfTheDay(() => current);
    return () => {
      current = false;
    };
  }, [language]);

  const handleShare = async () => {
    if (!verseOfTheDay) return;
    const transId =
      BibleService.DEFAULT_TRANSLATION_MAP[language as SupportedLanguage] || 'BSB';
    const message = formatVerseOfTheDayShare(verseOfTheDay, getTranslationName(transId));

    try {
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share({
          title: verseOfTheDay.reference,
          text: message,
        });
      } else {
        await Share.share({
          message,
          title: verseOfTheDay.reference,
        });
      }
    } catch (e) {
      if ((e as any).name !== 'AbortError') {
        console.error('Sharing failed', e);
      }
    }
  };

  const navigateToVerse = () => {
    if (!verseOfTheDay) return;
    router.push({
      pathname: '/bible',
      params: {
        ...BibleService.getScriptureReaderParams(
          {
            bookId: verseOfTheDay.bookId,
            chapter: verseOfTheDay.chapter,
            verseStart: verseOfTheDay.verse,
            verseEnd: verseOfTheDay.verse,
          },
          language as SupportedLanguage,
        ),
        referenceRequest: BibleService.createScriptureReferenceRequest(),
        backTo: '/',
      },
    } as any);
  };

  return (
    <>
      <Stack.Screen options={screenOptions as any} />
      <ScrollView
        style={navigationStyles.container}
        contentContainerStyle={{ paddingTop: 0 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <ImageBackground
          onLayout={onHeroLayout}
          source={{ uri: CHURCH_BUILDING_IMAGE_URL }}
          style={[
            styles.hero,
            {
              paddingTop: insets.top + DESIGN_TOKENS.VIEW_PADDING,
              paddingBottom: 28,
            },
          ]}
          resizeMode="cover"
        >
          <LinearGradient
            colors={theme.gradients.heroOverlay}
            style={StyleSheet.absoluteFill}
          />
          {/* A heading, so it follows the phone's text size only up to the
              header's cap, and "Versículo de hoy" never breaks mid-word (#385).
              The verse below follows it in full. */}
          <Text
            maxFontSizeMultiplier={HEADER_MAX_FONT_SCALE}
            variant="headlineMedium"
            style={[styles.welcomeText, { color: '#FFFFFF' }]}
          >
            {labels.verseOfDay}
          </Text>
          <Text
            variant="titleMedium"
            style={{
              // The content column's width on a wide screen, so the verse
              // keeps a comfortable line length.
              ...contentColumnWithin(24, effectiveTextScale),
              color: '#FFFFFF',
              textAlign: 'center',
              fontStyle: 'italic',
              marginTop: 4,
            }}
          >
            {verseOfTheDay
              ? `${verseOfTheDay.text}\n— ${verseOfTheDay.reference}`
              : labels.subtitle}
          </Text>
          <View style={[styles.heroActions, stackHeroActions && styles.heroActionsStacked]}>
            <WrappingActionButton
              borderColor="#FFFFFF"
              disabled={!verseOfTheDay}
              icon="share-variant"
              label={(labels as any).shareVerse}
              onPress={handleShare}
              textColor="#FFFFFF"
              style={[styles.heroActionButton, stackHeroActions && styles.heroActionButtonStacked]}
            />
            <WrappingActionButton
              backgroundColor={theme.colors.primary}
              borderColor={theme.colors.primary}
              disabled={!verseOfTheDay}
              icon="book-open-variant"
              label={(labels as any).readVerse}
              onPress={navigateToVerse}
              textColor={theme.colors.onPrimary}
              style={[styles.heroActionButton, stackHeroActions && styles.heroActionButtonStacked]}
            />
          </View>
        </ImageBackground>

        <List.Section style={styles.content}>
          {/* Sabbath Countdown Widget */}
          <Card
            style={[styles.timerCard, { backgroundColor: theme.colors.surface }]}
            mode="contained"
          >
            <Card.Content style={styles.timerContentSubtle}>
              {/* Three centred lines, like a clock (#593): what the timer counts
                  to, the timer, and the place. The timer already says when, so
                  no date; during the Sabbath the label says it counts to its end. */}
              <Text
                variant="labelMedium"
                style={{
                  color: isSabbath ? theme.colors.primary : theme.colors.secondary,
                  fontWeight: 'bold',
                  textAlign: 'center',
                }}
              >
                {isSabbath ? labels.sabbathEnds : labels.sabbathStarts}
              </Text>
              <Text
                style={[
                  styles.timerValueSubtle,
                  {
                    color: isSabbath ? theme.colors.primary : theme.colors.onSurface,
                    fontSize: countdownFontSize,
                    lineHeight: Math.round(countdownFontSize * 1.3),
                  },
                ]}
              >
                {countdown || '--:--:--'}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                {labels.locationDefault}
              </Text>
            </Card.Content>
          </Card>

          <View style={styles.grid}>
            <GridMenuCard
              fitTitles={gridTitles}
              title={labels.livestream}
              titleBlockLines={3}
              subtitle={(labels as any).liveNow}
              imageSource={EXTERNAL_BRAND_ASSETS.youtubeIcon.light}
              darkImageSource={EXTERNAL_BRAND_ASSETS.youtubeIcon.dark}
              imageContentScale={EXTERNAL_BRAND_ICON_CONTENT_SCALE.youtube}
              color={theme.colors.cardBgColors.livestream}
              onPress={openSabbathStream}
              style={styles.gridCell}
              showArrow={false}
            />
            <GridMenuCard
              fitTitles={gridTitles}
              title={labels.bulletin}
              titleBlockLines={3}
              icon="newspaper-variant-outline"
              color={theme.colors.cardBgColors.bulletin}
              iconColor={theme.colors.iconColors.bulletin}
              onPress={() =>
                router.push({
                  pathname: '/home/bulletin',
                  params: { backTo: '/' },
                } as any)
              }
              style={styles.gridCell}
              showArrow={false}
            />
            <GridMenuCard
              fitTitles={gridTitles}
              title={labels.give}
              titleBlockLines={3}
              icon="hand-heart-outline"
              color={theme.colors.cardBgColors.tithe}
              iconColor={theme.colors.iconColors.tithe}
              onPress={() =>
                router.push({
                  pathname: '/home/give',
                  params: { backTo: '/' },
                } as any)
              }
              style={styles.gridCell}
              showArrow={false}
            />
            <GridMenuCard
              fitTitles={gridTitles}
              title={labels.hymnal}
              titleBlockLines={3}
              icon="music-note"
              color={theme.colors.cardBgColors.hymnal}
              iconColor={theme.colors.iconColors.hymnal}
              onPress={() =>
                router.push({
                  pathname: '/home/hymnal-selection',
                  params: { backTo: '/' },
                } as any)
              }
              style={styles.gridCell}
              showArrow={false}
            />
            <GridMenuCard
              fitTitles={gridTitles}
              title={labels.sabbathSchool}
              titleBlockLines={3}
              icon="book-open-page-variant"
              color={theme.colors.cardBgColors.sabbathSchool}
              iconColor={theme.colors.iconColors.sabbathSchool}
              onPress={() =>
                router.push({
                  pathname: '/sabbath-school',
                  params: { backTo: '/' },
                } as any)
              }
              style={styles.gridCell}
              showArrow={false}
            />
            <GridMenuCard
              fitTitles={gridTitles}
              title={labels.discover}
              titleBlockLines={3}
              icon="compass"
              color={theme.colors.cardBgColors.discover}
              iconColor={theme.colors.iconColors.discover}
              onPress={() =>
                router.push({
                  pathname: '/home/discover',
                  params: { backTo: '/' },
                } as any)
              }
              style={styles.gridCell}
              showArrow={false}
            />
          </View>
        </List.Section>
        <TabBarSpacer />
      </ScrollView>
    </>
  );
}

// The verse card's sides, its buttons' row's own padding, and the gap between
// the two buttons.
const HERO_SIDE_PADDING = 24;
const HERO_ACTIONS_PADDING = 16;
const HERO_ACTIONS_GAP = 12;

/** The width the verse card's buttons share, within the content column. */
const getHeroActionsRowWidth = (windowWidth: number, effectiveTextScale: number) =>
  getContentWidth(windowWidth, effectiveTextScale) - 2 * HERO_SIDE_PADDING - 2 * HERO_ACTIONS_PADDING;

const createStyles = (
  textScale: Parameters<typeof scaleTypographyMetric>[1],
  effectiveTextScale: number,
  useStackedLayout: boolean,
) => StyleSheet.create({
  hero: {
    paddingHorizontal: HERO_SIDE_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  content: {
    ...contentColumnStyle(effectiveTextScale),
    padding: 20,
    paddingBottom: 16,
  },
  welcomeText: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroActions: {
    ...contentColumnWithin(HERO_SIDE_PADDING, effectiveTextScale),
    flexDirection: useStackedLayout ? 'column' : 'row',
    marginTop: 16,
    gap: HERO_ACTIONS_GAP,
    paddingHorizontal: HERO_ACTIONS_PADDING,
  },
  heroActionButton: {
    flex: useStackedLayout ? undefined : 1,
    width: useStackedLayout ? '100%' : undefined,
  },
  heroActionsStacked: {
    flexDirection: 'column',
  },
  heroActionButtonStacked: {
    flex: 0,
    width: '100%',
  },
  timerCard: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  timerContentSubtle: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  timerValueSubtle: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
    borderRadius: 0,
  },
  gridCell: {
    flexBasis: useStackedLayout ? '100%' : '47.5%',
    flexGrow: 1,
  },
});
