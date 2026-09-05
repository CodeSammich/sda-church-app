import { GridMenuCard } from '@/components/GridMenuCard';
import { WrappingActionButton } from '@/components/WrappingActionButton';
import { scaleTypographyMetric } from '@/constants/AppPreferences';
import {
  CHURCH_BUILDING_IMAGE_URL,
  CHURCH_LATITUDE,
  CHURCH_LONGITUDE,
  getSunsetApiUrl,
  openSabbathStream,
} from '@/constants/ExternalLinks';
import { LanguageContext, SupportedLanguage } from '@/constants/LanguageContext';
import { DESIGN_TOKENS, shouldUseStackedHomeLayout } from '@/constants/Layout';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import * as BibleService from '@/services/BibleService';
import { createNavigationStyles } from '@/styles/NavigationStyles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useContext, useEffect, useMemo, useState } from 'react';
import {
  ImageBackground,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Card, List, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const { language } = useContext(LanguageContext);
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { textScale } = useTextSize();
  const { fontScale, width: windowWidth } = useWindowDimensions();
  const effectiveTextScale = Math.max(1, fontScale * textScale);
  // Preserve the upstream two-column phone grid at 100%, then stack only
  // when the scaled text would leave each card too narrow to wrap cleanly.
  const useStackedLayout = shouldUseStackedHomeLayout(
    windowWidth,
    effectiveTextScale,
  );
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
      discover: 'New Member / Visitor',
      bulletin: 'Weekly Bulletin',
      give: 'Tithe & Offering',
      sabbathSchool: 'This Week’s Lesson',
      hymnal: 'Hymnal',
      sabbathStarts: 'Sabbath starts in',
      sabbathEnds: 'Sabbath ends in',
      isSabbath: 'Happy Sabbath!',
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
      isSabbath: '安息日快樂！',
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
      isSabbath: '安息日快乐！',
      locationDefault: '纽约',
    },
    es: {
      subtitle: 'Cargando versículo...',
      verseOfDay: 'Versículo de hoy',
      readVerse: 'Leer Versículo',
      shareVerse: 'Compartir',
      livestream: 'Ver Transmisión',
      discover: 'Nuevo miembro / Visitante',
      bulletin: 'Boletín Semanal',
      give: 'Diezmos y Ofrendas',
      sabbathSchool: 'Lección de esta semana',
      hymnal: 'Himnario',
      sabbathStarts: 'El Sábado comienza en',
      sabbathEnds: 'El Sábado termina en',
      isSabbath: '¡Feliz Sábado!',
      // decided to remove the dynamic location since most people don't like to give away location
      // instead, each congregation shuold adjust the code to use their own location coordinates
      locationDefault: 'New York, NY',
    },
  };

  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;

  const [randomVerse, setRandomVerse] = useState<{
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
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [sunsets, setSunsets] = useState<{ fri: Date | null; sat: Date | null }>({
    fri: null,
    sat: null,
  });

  const VOTD_CONFIG_KEY = 'votd_selection_config';
  const VOTD_CACHE_KEY = `votd_cache_${language}`;

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
    const fetchSunsets = async () => {
      const lat = useGps && userCoords ? userCoords.lat : CHURCH_LATITUDE;
      const lng = useGps && userCoords ? userCoords.lng : CHURCH_LONGITUDE;

      const getDayDate = (d: number) => {
        const t = new Date();
        // Normalize to Noon local time to ensure the date is stable across UTC/Local
        // conversions before we apply our longitude-based shift.
        t.setDate(t.getDate() + (d - t.getDay()));
        t.setHours(12, 0, 0, 0);
        return t.toISOString().split('T')[0];
      };

      try {
        const [fRes, sRes] = await Promise.all([
          fetch(getSunsetApiUrl(lat, lng, getDayDate(5))),
          fetch(getSunsetApiUrl(lat, lng, getDayDate(6))),
        ]);
        const fData = await fRes.json();
        const sData = await sRes.json();

        setSunsets({
          fri: fData.results?.sunset ? new Date(fData.results.sunset) : null,
          sat: sData.results?.sunset ? new Date(sData.results.sunset) : null,
        });
      } catch (e) {
        console.warn('Failed to fetch sunset times:', e);
      }
    };
    fetchSunsets();
  }, [useGps, userCoords, new Date().toDateString()]);

  const formatDisplayDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    };

    if (language === 'en') {
      const day = date.getDate();
      const suffix = (d: number) => {
        if (d > 3 && d < 21) return 'th';
        switch (d % 10) {
          case 1:
            return 'st';
          case 2:
            return 'nd';
          case 3:
            return 'rd';
          default:
            return 'th';
        }
      };
      const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
      const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date);
      return `${weekday}, ${month} ${day}${suffix(day)}`;
    }
    return new Intl.DateTimeFormat(language, options).format(date);
  };

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

      setTargetDate(target);
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

  const loadRandomVerse = async () => {
    try {
      // Load a new random verse each day at 6 AM local time.
      // Before 6 AM, show the previous day's verse to maintain consistency with
      // the "Verse of the Day" concept.
      const now = new Date();
      const effectiveDate = new Date(now);
      if (now.getHours() < 6) effectiveDate.setDate(now.getDate() - 1);
      const currentDateKey = `${effectiveDate.getFullYear()}-${effectiveDate.getMonth() + 1}-${effectiveDate.getDate()}`;

      const transId =
        BibleService.DEFAULT_TRANSLATION_MAP[language as SupportedLanguage] || 'BSB';

      // 1. Check if we have coordinates (selection) already cached for today.
      // We only use the cache for the "Selection" to ensure we pick the same verse,
      // but we ALWAYS re-render the text from the chapter content to ensure
      // any fixes to the BibleService renderer are applied immediately.
      const cached = await AsyncStorage.getItem(VOTD_CACHE_KEY);
      let selection: { bookId: string; chapter: number; verse: number } | null = null;
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.dateKey === currentDateKey) {
          selection = {
            bookId: parsed.bookId,
            chapter: parsed.chapter,
            verse: parsed.verse,
          };
        }
      }

      // 3. If no master selection exists for today, generate one
      if (!selection) {
        const bsbBooks = await BibleService.fetchBooks('BSB');
        const rand = BibleService.selectRandomChapter(bsbBooks);
        if (rand) {
          const bsbChapter = await BibleService.fetchChapter(
            'BSB',
            rand.book.id,
            rand.chapter,
          );
          const vNum = Math.floor(Math.random() * bsbChapter.numberOfVerses) + 1;
          selection = { bookId: rand.book.id, chapter: rand.chapter, verse: vNum };
          await AsyncStorage.setItem(
            VOTD_CONFIG_KEY,
            JSON.stringify({ ...selection, dateKey: currentDateKey }),
          );
        }
      }

      if (selection) {
        // 4. Load the text for the current language using the shared selection
        const books = await BibleService.fetchBooks(transId);
        const book =
          books.find((b: BibleService.TranslationBook) => b.id === selection?.bookId) ||
          books[0];
        const chapterData = await BibleService.fetchChapter(
          transId,
          book.id,
          selection.chapter,
        );

        const verseContent = chapterData.chapter.content.find(
          (c) => c.type === 'verse' && c.number === selection?.verse,
        ) as BibleService.ChapterVerse;

        if (verseContent) {
          const text = BibleService.renderVerseToPlainText(transId, verseContent);
          const newVOTD = {
            // The Bible text can contain dialogue punctuation of its own. Keep
            // it verbatim instead of adding decorative outer quotation marks.
            text,
            reference: `${book.name} ${selection.chapter}:${selection.verse}`,
            bookId: book.id,
            chapter: selection.chapter,
            verse: selection.verse,
            dateKey: currentDateKey,
          };
          setRandomVerse(newVOTD);
          await AsyncStorage.setItem(VOTD_CACHE_KEY, JSON.stringify(newVOTD));
        }
      }
    } catch (e) {
      console.warn('Failed to load random verse:', e);
    }
  };

  useEffect(() => {
    loadRandomVerse();
  }, [language]);

  const handleShare = async () => {
    if (!randomVerse) return;
    const transId =
      BibleService.DEFAULT_TRANSLATION_MAP[language as SupportedLanguage] || 'BSB';
    const translation =
      BibleService.SUPPORTED_TRANSLATIONS.find((t) => t.id === transId)?.name || transId;
    const message = `${randomVerse.text}\n\n— ${randomVerse.reference} (${translation})`;

    try {
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share({
          title: randomVerse.reference,
          text: message,
        });
      } else {
        await Share.share({
          message,
          title: randomVerse.reference,
        });
      }
    } catch (e) {
      if ((e as any).name !== 'AbortError') {
        console.error('Sharing failed', e);
      }
    }
  };

  const navigateToVerse = () => {
    if (!randomVerse) return;
    router.replace({
      pathname: '/bible',
      params: {
        ...BibleService.getScriptureReaderParams(
          {
            bookId: randomVerse.bookId,
            chapter: randomVerse.chapter,
            verseStart: randomVerse.verse,
            verseEnd: randomVerse.verse,
          },
          language as SupportedLanguage,
        ),
        referenceRequest: BibleService.createScriptureReferenceRequest(),
      },
    } as any);
  };

  return (
    <>
      <ScrollView
        style={navigationStyles.container}
        contentContainerStyle={{ paddingTop: 0 }}
      >
        <ImageBackground
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
          <Text
            variant="headlineMedium"
            style={[styles.welcomeText, { color: '#FFFFFF' }]}
          >
            {labels.verseOfDay}
          </Text>
          <Text
            variant="titleMedium"
            style={{
              color: '#FFFFFF',
              alignSelf: 'stretch',
              textAlign: 'center',
              fontStyle: 'italic',
              marginTop: 4,
            }}
          >
            {randomVerse
              ? `${randomVerse.text}\n— ${randomVerse.reference}`
              : labels.subtitle}
          </Text>
          <View style={styles.heroActions}>
            <WrappingActionButton
              borderColor="#FFFFFF"
              disabled={!randomVerse}
              icon="share-variant"
              label={(labels as any).shareVerse}
              onPress={handleShare}
              textColor="#FFFFFF"
              style={styles.heroActionButton}
            />
            <WrappingActionButton
              backgroundColor={theme.colors.primary}
              borderColor={theme.colors.primary}
              disabled={!randomVerse}
              icon="book-open-variant"
              label={(labels as any).readVerse}
              onPress={navigateToVerse}
              textColor={theme.colors.onPrimary}
              style={styles.heroActionButton}
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
              <View style={styles.timerRow}>
                <View style={styles.labelColumn}>
                  <Text
                    variant="labelMedium"
                    style={{
                      color: isSabbath ? theme.colors.primary : theme.colors.secondary,
                      fontWeight: 'bold',
                    }}
                  >
                    {isSabbath ? labels.isSabbath : labels.sabbathStarts}
                  </Text>
                  {targetDate && (
                    <>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {formatDisplayDate(targetDate)}
                      </Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {labels.locationDefault}
                      </Text>
                    </>
                  )}
                </View>
                <Text
                  style={[
                    styles.timerValueSubtle,
                    { color: isSabbath ? theme.colors.primary : theme.colors.onSurface },
                  ]}
                >
                  {countdown || '--:--:--'}
                </Text>
              </View>
            </Card.Content>
          </Card>

          <View style={styles.grid}>
            <GridMenuCard
              title={labels.livestream}
              titleBlockLines={useStackedLayout ? 2 : 3}
              subtitle={(labels as any).liveNow}
              icon="youtube"
              color={theme.colors.cardBgColors.livestream}
              iconColor={theme.colors.iconColors.livestream}
              onPress={openSabbathStream}
              style={styles.gridCell}
            />
            <GridMenuCard
              title={labels.bulletin}
              titleBlockLines={useStackedLayout ? 2 : 3}
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
            />
            <GridMenuCard
              title={labels.give}
              titleBlockLines={useStackedLayout ? 2 : 3}
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
            />
            <GridMenuCard
              title={labels.hymnal}
              titleBlockLines={useStackedLayout ? 2 : 3}
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
            />
            <GridMenuCard
              title={labels.sabbathSchool}
              titleBlockLines={useStackedLayout ? 2 : 3}
              icon="book-open-page-variant"
              color={theme.colors.cardBgColors.sabbathSchool}
              iconColor={theme.colors.iconColors.sabbathSchool}
              onPress={() =>
                router.push({
                  pathname: '/explore/sabbath-school',
                  params: { backTo: '/' },
                } as any)
              }
              style={styles.gridCell}
            />
            <GridMenuCard
              title={labels.discover}
              titleBlockLines={useStackedLayout ? 2 : 3}
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
            />
          </View>
        </List.Section>
      </ScrollView>
    </>
  );
}

const createStyles = (
  textScale: Parameters<typeof scaleTypographyMetric>[1],
  effectiveTextScale: number,
  useStackedLayout: boolean,
) => StyleSheet.create({
  hero: {
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  content: {
    padding: 20,
    paddingBottom: 16,
  },
  welcomeText: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroActions: {
    flexDirection: useStackedLayout ? 'column' : 'row',
    marginTop: 16,
    gap: 12,
    width: '100%',
    paddingHorizontal: 16,
  },
  heroActionButton: {
    flex: useStackedLayout ? undefined : 1,
    width: useStackedLayout ? '100%' : undefined,
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
  timerRow: {
    flexDirection: useStackedLayout ? 'column' : 'row',
    alignItems: useStackedLayout ? 'flex-start' : 'center',
    justifyContent: 'space-between',
  },
  labelColumn: {
    flex: 1,
  },
  timerValueSubtle: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontVariant: ['tabular-nums'],
    fontSize: scaleTypographyMetric(16, textScale),
    lineHeight: scaleTypographyMetric(24, textScale),
    fontWeight: '700',
    marginTop: useStackedLayout ? 8 : 0,
    flexShrink: 0,
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
