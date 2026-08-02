import { UIStateContext } from '@/components/GlobalHeader';
import { AppIcon } from '@/components/AppIcon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  GestureResponderEvent,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Divider,
  IconButton,
  Modal,
  Portal,
  Text,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getBibleReaderUiTextScale,
  scaleTypographyMetric,
  type TextScale,
} from '@/constants/AppPreferences';
import { useBottomTabHeight } from '@/constants/BottomTabHeightContext';
import { LanguageContext } from '@/constants/LanguageContext';
import { getBottomTabContentHeight } from '@/constants/Layout';
import { useTextSize } from '@/constants/TextSizeContext';
import { SCRIPTURE_FONT_FAMILIES, useAppTheme } from '@/constants/Themes';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import * as BibleService from '@/services/BibleService';
import {
  getSavedVerseKey,
  loadSavedVerses,
  SavedVerseReference,
  storeSavedVerses,
} from '@/services/SavedVersesService';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import {
  createReaderStyles,
  getCompactBibleAudioDockHeight,
  getBibleDockLayout,
  getBibleDockViewportLayout,
} from '@/styles/ReaderStyles';

const FOOTER_PADDING_GUTTER = 34;

type SleepTimerSetting = 5 | 10 | 15 | 30 | 60 | 120 | 'chapter' | null;

const BIBLE_TRANS_KEY = BibleService.BIBLE_TRANSLATION_STORAGE_KEY;
const BIBLE_BOOK_KEY = 'user-bible-book';
const BIBLE_CHAPTER_KEY = 'user-bible-chapter';

type SavedVerseDisplay = SavedVerseReference & {
  bookName: string;
  text?: string;
};

const savedChapterCache = new Map<
  string,
  Promise<BibleService.TranslationBookChapter>
>();

const getSavedChapter = (translationId: string, bookId: string, chapter: number) => {
  const cacheKey = `${translationId}:${bookId}:${chapter}`;
  let request = savedChapterCache.get(cacheKey);
  if (!request) {
    request = BibleService.fetchChapter(translationId, bookId, chapter).catch((error) => {
      savedChapterCache.delete(cacheKey);
      throw error;
    });
    savedChapterCache.set(cacheKey, request);
  }
  return request;
};

const uiLabels = {
  en: {
    translation: 'Translation',
    book: 'Book',
    chapter: 'Chapter',
    chapterItem: 'Chapter {n}',
    verse: 'Verse',
    verseItem: 'Verse {n}',
    bible: 'Bible',
    footnote: 'Footnote',
    hebrewSubtitle: 'Hebrew (Original)',
    hebrewAramaicOriginal: 'Hebrew / Aramaic (Original)',
    greekOriginal: 'Koine Greek (Original)',
    loadingOriginal: 'Loading original-language text…',
    originalUnavailable: 'Original-language text is unavailable.',
    source: 'Source',
    prevChapter: 'Prev',
    nextChapter: 'Next',
    share: 'Share Verse',
    cancel: 'Cancel',
    shareAction: 'Share',
    saveAction: 'Save',
    removeAction: 'Remove',
    savedVerses: 'Saved Verses',
    savedVersesSubtitle: 'Shown in {translation}',
    noSavedVerses: 'Your saved verses will appear here.',
    audioPlayer: 'Bible audio',
    showAudioControls: 'Show full Bible audio controls',
    audio: 'Audio',
    audioUnavailable: 'Audio unavailable for this chapter',
    back10: 'Back 10 seconds',
    forward30: 'Forward 30 seconds',
    playbackSpeed: 'Playback speed',
    sleepTimer: 'Sleep timer',
    timerOff: 'Off',
    minutes: '{n} minutes',
    oneHour: '1 hour',
    twoHours: '2 hours',
    endOfChapter: 'End of chapter',
    previousChapter: 'Previous chapter',
    nextChapterA11y: 'Next chapter',
    en: 'English',
    zh: 'Traditional Chinese',
    'zh-cn': 'Simplified Chinese',
    es: 'Spanish',
  },
  zh: {
    translation: '譯本',
    book: '書卷',
    chapter: '章節',
    chapterItem: '第 {n} 章',
    verse: '節',
    verseItem: '第 {n} 節',
    bible: '聖經',
    footnote: '腳注',
    hebrewSubtitle: '希伯來語 (原文)',
    hebrewAramaicOriginal: '希伯來語／亞蘭語（原文）',
    greekOriginal: '通用希臘語（原文）',
    loadingOriginal: '正在載入原文…',
    originalUnavailable: '無法載入原文。',
    source: '來源',
    prevChapter: '上一章',
    nextChapter: '下一章',
    share: '分享經文',
    cancel: '取消',
    shareAction: '分享',
    saveAction: '儲存',
    removeAction: '移除',
    savedVerses: '已儲存經文',
    savedVersesSubtitle: '以 {translation} 顯示',
    noSavedVerses: '您儲存的經文會顯示在這裡。',
    audioPlayer: '聖經有聲書',
    showAudioControls: '顯示完整聖經有聲書控制項',
    audio: '有聲書',
    audioUnavailable: '此章節沒有有聲版本',
    back10: '後退 10 秒',
    forward30: '前進 30 秒',
    playbackSpeed: '播放速度',
    sleepTimer: '睡眠定時器',
    timerOff: '關閉',
    minutes: '{n} 分鐘',
    oneHour: '1 小時',
    twoHours: '2 小時',
    endOfChapter: '本章結束',
    previousChapter: '上一章',
    nextChapterA11y: '下一章',
    en: '英文',
    zh: '繁體中文',
    'zh-cn': '簡體中文',
    es: '西班牙文',
  },
  'zh-cn': {
    translation: '译本',
    book: '书卷',
    chapter: '章节',
    chapterItem: '第 {n} 章',
    verse: '节',
    verseItem: '第 {n} 节',
    bible: '圣经',
    footnote: '脚注',
    hebrewSubtitle: '希伯来语 (原文)',
    hebrewAramaicOriginal: '希伯来语／亚兰语（原文）',
    greekOriginal: '通用希腊语（原文）',
    loadingOriginal: '正在加载原文…',
    originalUnavailable: '无法加载原文。',
    source: '来源',
    prevChapter: '上一章',
    nextChapter: '下一章',
    share: '分享经文',
    cancel: '取消',
    shareAction: '分享',
    saveAction: '保存',
    removeAction: '移除',
    savedVerses: '已保存经文',
    savedVersesSubtitle: '以 {translation} 显示',
    noSavedVerses: '您保存的经文会显示在这里。',
    audioPlayer: '圣经有声书',
    showAudioControls: '显示完整圣经有声书控件',
    audio: '有声书',
    audioUnavailable: '此章节没有有声版本',
    back10: '后退 10 秒',
    forward30: '前进 30 秒',
    playbackSpeed: '播放速度',
    sleepTimer: '睡眠定时器',
    timerOff: '关闭',
    minutes: '{n} 分钟',
    oneHour: '1 小时',
    twoHours: '2 小时',
    endOfChapter: '本章结束',
    previousChapter: '上一章',
    nextChapterA11y: '下一章',
    en: '英文',
    zh: '繁体中文',
    'zh-cn': '简体中文',
    es: '西班牙文',
  },
  es: {
    translation: 'Traducción',
    book: 'Libro',
    chapter: 'Capítulo',
    chapterItem: 'Capítulo {n}',
    verse: 'Versículo',
    verseItem: 'Versículo {n}',
    bible: 'Biblia',
    footnote: 'Footnote',
    hebrewSubtitle: 'Hebreo (Original)',
    hebrewAramaicOriginal: 'Hebreo / arameo (original)',
    greekOriginal: 'Griego koiné (original)',
    loadingOriginal: 'Cargando texto original…',
    originalUnavailable: 'El texto original no está disponible.',
    source: 'Fuente',
    prevChapter: 'Anterior',
    nextChapter: 'Siguiente',
    share: 'Compartir Versículo',
    cancel: 'Cancelar',
    shareAction: 'Compartir',
    saveAction: 'Guardar',
    removeAction: 'Quitar',
    savedVerses: 'Versículos guardados',
    savedVersesSubtitle: 'Mostrados en {translation}',
    noSavedVerses: 'Tus versículos guardados aparecerán aquí.',
    audioPlayer: 'Audio de la Biblia',
    showAudioControls: 'Mostrar todos los controles de audio bíblico',
    audio: 'Audio',
    audioUnavailable: 'Audio no disponible para este capítulo',
    back10: 'Retroceder 10 segundos',
    forward30: 'Avanzar 30 segundos',
    playbackSpeed: 'Velocidad de reproducción',
    sleepTimer: 'Temporizador',
    timerOff: 'Desactivado',
    minutes: '{n} minutos',
    oneHour: '1 hora',
    twoHours: '2 horas',
    endOfChapter: 'Fin del capítulo',
    previousChapter: 'Capítulo anterior',
    nextChapterA11y: 'Capítulo siguiente',
    en: 'Inglés',
    zh: 'Chino tradicional',
    'zh-cn': 'Chino simplificado',
    es: 'Español',
  },
};

export default function BibleScreen() {
  const theme = useAppTheme();
  const { textScale } = useTextSize();
  const {
    fontScale: osFontScale,
    height: viewportHeight,
    width: viewportWidth,
  } = useWindowDimensions();
  const NavigationStyles = useNavigationStyles();
  const ReaderStyles = useMemo(() => createReaderStyles(textScale), [textScale]);
  const bibleUiTextScale = getBibleReaderUiTextScale(textScale);
  const styles = useMemo(
    () => createStyles(textScale, bibleUiTextScale),
    [bibleUiTextScale, textScale],
  );
  const effectiveTextScale = Math.max(1, bibleUiTextScale * osFontScale);
  const measuredBottomTabHeight = useBottomTabHeight();
  const dockLayout = useMemo(
    () => getBibleDockLayout(viewportWidth, effectiveTextScale),
    [effectiveTextScale, viewportWidth],
  );
  const insets = useSafeAreaInsets();
  const headerHeight = useGlobalHeaderHeight(true);
  const fullscreenEdgeInset =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: fullscreen)').matches
      ? 12
      : 0;
  const bottomDockInset = Math.max(insets.bottom, fullscreenEdgeInset);
  const bottomTabContentHeight =
    measuredBottomTabHeight === null
      ? getBottomTabContentHeight(effectiveTextScale)
      : Math.max(0, measuredBottomTabHeight - bottomDockInset);
  const { language, languageSelectionRevision } = useContext(LanguageContext);
  const { menuAnim, setMenuVisible: setGlobalMenuVisible } = useContext(UIStateContext);
  const [menuVisible, setMenuVisible] = useState(true);

  const {
    bookId: paramBookId,
    chapter: paramChapter,
    translationId: paramTransId,
    backTo: paramBackTo,
  } = useLocalSearchParams<{
    bookId?: string;
    chapter?: string;
    translationId?: string;
    backTo?: string;
  }>();

  const labels = uiLabels[language as keyof typeof uiLabels] || uiLabels.en;
  const translationParamSignature = paramTransId
    ? `${paramTransId}:${paramBookId || ''}:${paramChapter || ''}`
    : null;
  const getTranslationLabel = (
    translation: (typeof BibleService.SUPPORTED_TRANSLATIONS)[number],
  ) => `${translation.name} (${(labels as Record<string, string>)[translation.lang]})`;
  const scrollRef = useRef<ScrollView>(null);
  const versePositions = useRef<Record<number, number>>({});
  const lastScrollY = useRef(0);

  // Selection state
  const [supportedTranslation, setSupportedTranslation] = useState(() => {
    const defaultId = BibleService.DEFAULT_TRANSLATION_MAP[language] || 'BSB';
    return (
      BibleService.SUPPORTED_TRANSLATIONS.find((t) => t.id === defaultId) ||
      BibleService.SUPPORTED_TRANSLATIONS[0]
    );
  });
  const [book, setBook] = useState<BibleService.TranslationBook | null>(null);
  const [chapterNum, setChapterNum] = useState(1);

  // Persistence state
  const [isPersistenceLoaded, setIsPersistenceLoaded] = useState(false);
  const initialBookId = useRef<string | null>(null);
  const handledLanguageSelectionRevision = useRef(languageSelectionRevision);
  const handledTranslationParamSignature = useRef<string | null>(null);

  // Data state
  const [books, setBooks] = useState<BibleService.TranslationBook[]>([]);
  const [chapterData, setChapterData] =
    useState<BibleService.TranslationBookChapter | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedVerses, setSavedVerses] = useState<SavedVerseReference[]>([]);
  const [savedVerseDisplays, setSavedVerseDisplays] = useState<SavedVerseDisplay[]>([]);
  const [savedVersesLoading, setSavedVersesLoading] = useState(false);
  const [originalVerse, setOriginalVerse] =
    useState<BibleService.OriginalLanguageVerse | null>(null);
  const [originalVerseLoading, setOriginalVerseLoading] = useState(false);
  const [originalVerseError, setOriginalVerseError] = useState(false);
  const pendingSavedVerseScroll = useRef<number | null>(null);

  // Modal states
  const [modalType, setModalType] = useState<
    'translation' | 'book' | 'chapter' | 'verse' | 'verse-detail' | 'saved' | null
  >(null);
  const [selectedVerseNum, setSelectedVerseNum] = useState<number | null>(null);

  // To prevent the "content flash" during modal dismissal
  const [lastActiveType, setLastActiveType] = useState<typeof modalType>(null);

  // Multi-selection state
  const [selectedVerses, setSelectedVerses] = useState<Set<number>>(new Set());
  const toggleVerseSelection = (num: number) => {
    setSelectedVerses((prev) => {
      const next = new Set(prev);
      if (next.has(num)) {
        next.delete(num);
      } else {
        next.add(num);
      }
      return next;
    });
  };
  const clearSelection = () => setSelectedVerses(new Set());
  const isSelectionActive = selectedVerses.size > 0;

  const updateMenuVisibility = (visible: boolean) => {
    setMenuVisible(visible);
    setGlobalMenuVisible(visible);
  };

  useEffect(() => {
    if (isSelectionActive && !menuVisible) {
      updateMenuVisibility(true);
    }
  }, [isSelectionActive]);

  // Load selection from storage on mount
  useEffect(() => {
    const loadSelection = async () => {
      try {
        const [savedTransId, savedBookId, savedChap, storedVerses] = await Promise.all([
          AsyncStorage.getItem(BIBLE_TRANS_KEY),
          AsyncStorage.getItem(BIBLE_BOOK_KEY),
          AsyncStorage.getItem(BIBLE_CHAPTER_KEY),
          loadSavedVerses(),
        ]);

        if (savedTransId) {
          const trans = BibleService.SUPPORTED_TRANSLATIONS.find(
            (t) => t.id === savedTransId,
          );
          if (trans) setSupportedTranslation(trans);
        }
        if (savedBookId) initialBookId.current = savedBookId;
        if (savedChap) setChapterNum(parseInt(savedChap, 10));
        setSavedVerses(storedVerses);
      } catch (e) {
        console.error('Failed to load Bible selection:', e);
      } finally {
        setIsPersistenceLoaded(true);
      }
    };
    loadSelection();
  }, []);

  // Save selection whenever it changes
  useEffect(() => {
    if (!isPersistenceLoaded) return;

    const saveSelection = async () => {
      try {
        await AsyncStorage.setItem(BIBLE_TRANS_KEY, supportedTranslation.id);
        if (book) await AsyncStorage.setItem(BIBLE_BOOK_KEY, book.id);
        await AsyncStorage.setItem(BIBLE_CHAPTER_KEY, chapterNum.toString());
      } catch (e) {
        console.error('Failed to save Bible selection:', e);
      }
    };
    saveSelection();
  }, [supportedTranslation.id, book?.id, chapterNum, isPersistenceLoaded]);

  // An app-language choice takes precedence over any Bible translation chosen
  // before it. A later translation choice in this reader is persisted normally
  // and remains in effect until the next app-language choice.
  useEffect(() => {
    if (
      !isPersistenceLoaded ||
      handledLanguageSelectionRevision.current === languageSelectionRevision
    ) {
      return;
    }

    handledLanguageSelectionRevision.current = languageSelectionRevision;
    // Consume any parameters belonging to the route that was already open. They
    // must not undo this newer app-language selection when the books reload.
    handledTranslationParamSignature.current = translationParamSignature;
    const defaultTranslationId = BibleService.DEFAULT_TRANSLATION_MAP[language] || 'BSB';
    const defaultTranslation = BibleService.SUPPORTED_TRANSLATIONS.find(
      (translation) => translation.id === defaultTranslationId,
    );

    if (defaultTranslation) setSupportedTranslation(defaultTranslation);
  }, [
    language,
    languageSelectionRevision,
    isPersistenceLoaded,
    translationParamSignature,
  ]);

  // Reactive effect to sync state with navigation parameters (e.g., from Hymnal)
  useEffect(() => {
    if (!isPersistenceLoaded) return;

    if (!paramTransId) {
      handledTranslationParamSignature.current = null;
    } else if (
      handledTranslationParamSignature.current !== translationParamSignature
    ) {
      handledTranslationParamSignature.current = translationParamSignature;
      const trans = BibleService.SUPPORTED_TRANSLATIONS.find(
        (t: any) => t.id === paramTransId,
      );
      if (trans && trans.id !== supportedTranslation.id) {
        setSupportedTranslation(trans);
      }
    }

    if (paramBookId) {
      // If the book is already in our current 'books' list, we can set it immediately.
      // Otherwise, we set initialBookId so the fetchBooks effect picks it up.
      const matchingBook = books.find(
        (b: BibleService.TranslationBook) => b.id === paramBookId,
      );
      if (matchingBook) {
        if (matchingBook.id !== book?.id) {
          setBook(matchingBook);
        }
      } else {
        initialBookId.current = paramBookId;
      }
    }

    if (paramChapter) {
      const chap = parseInt(paramChapter, 10);
      if (!isNaN(chap) && chap !== chapterNum) {
        setChapterNum(chap);
      }
    }
  }, [
    paramTransId,
    paramBookId,
    paramChapter,
    isPersistenceLoaded,
    books,
  ]);

  // Keep the Bible dock visible at the bottom of the screen at all times.
  // We only animate the height so it "drops" down to the bottom when the tab bar hides.
  const dockTranslateY = 0;

  // Determine navigation boundaries
  const currentBookIdx = books.findIndex(
    (b: BibleService.TranslationBook) => b.id === book?.id,
  );
  const isFirstChapter = chapterNum === 1 && currentBookIdx === 0;
  const isLastChapter = !!(
    book &&
    chapterNum === book.numberOfChapters &&
    currentBookIdx === books.length - 1 &&
    currentBookIdx !== -1
  );

  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioPositionMillis, setAudioPositionMillis] = useState(0);
  const [audioDurationMillis, setAudioDurationMillis] = useState(0);
  const [audioBufferedMillis, setAudioBufferedMillis] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [sleepTimerSetting, setSleepTimerSetting] =
    useState<SleepTimerSetting>(null);
  const [sleepTimerVisible, setSleepTimerVisible] = useState(false);
  const [scrubPositionMillis, setScrubPositionMillis] = useState<number | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const audioLoadIdRef = useRef(0);
  const isScrubbingRef = useRef(false);
  const audioScrubberWidth = useRef(1);
  const sleepTimerSettingRef = useRef<SleepTimerSetting>(null);
  const sleepTimerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);

  const clearSleepTimer = () => {
    if (sleepTimerTimeoutRef.current) {
      clearTimeout(sleepTimerTimeoutRef.current);
      sleepTimerTimeoutRef.current = null;
    }
    sleepTimerSettingRef.current = null;
    setSleepTimerSetting(null);
  };

  const selectSleepTimer = (setting: SleepTimerSetting) => {
    if (sleepTimerTimeoutRef.current) {
      clearTimeout(sleepTimerTimeoutRef.current);
      sleepTimerTimeoutRef.current = null;
    }

    sleepTimerSettingRef.current = setting;
    setSleepTimerSetting(setting);
    setSleepTimerVisible(false);

    if (typeof setting === 'number') {
      sleepTimerTimeoutRef.current = setTimeout(async () => {
        setShouldAutoPlay(false);
        try {
          await soundRef.current?.pauseAsync();
        } catch (e) {
          console.error('Sleep timer pause error:', e);
        } finally {
          sleepTimerTimeoutRef.current = null;
          sleepTimerSettingRef.current = null;
          setSleepTimerSetting(null);
        }
      }, setting * 60 * 1000);
    }
  };

  /**
   * Handles automatic audio transition when a track finishes.
   */
  const onPlaybackStatusUpdate = (status: any) => {
    if (!status.isLoaded) {
      if (status.error) setIsAudioLoading(false);
      return;
    }

    setIsAudioLoading(!!status.isBuffering);
    setIsPlaying(status.isPlaying);
    setAudioDurationMillis(status.durationMillis || 0);
    setAudioBufferedMillis(status.playableDurationMillis || status.positionMillis || 0);
    if (!isScrubbingRef.current) {
      setAudioPositionMillis(status.positionMillis || 0);
    }

    if (status.didJustFinish) {
      setIsPlaying(false);
      if (sleepTimerSettingRef.current === 'chapter') {
        clearSleepTimer();
        setShouldAutoPlay(false);
        return;
      }
      if (!isLastChapter) {
        // Signal that the next chapter should start playing automatically
        setShouldAutoPlay(true);
        navigateToChapter('next');
      }
    }
  };

  const toggleAudio = async () => {
    const audioLinks = chapterData?.thisChapterAudioLinks;
    if (!audioLinks || Object.keys(audioLinks).length === 0) return;

    // Get the first available reader's audio URL
    const audioUrl = Object.values(audioLinks)[0];

    try {
      if (isPlaying) {
        await soundRef.current?.pauseAsync();
      } else {
        if (!soundRef.current) {
          setIsAudioLoading(true);
          const loadId = ++audioLoadIdRef.current;
          const { sound, status } = await Audio.Sound.createAsync(
            { uri: audioUrl as string },
            {
              shouldPlay: true,
              rate: playbackRate,
              shouldCorrectPitch: true,
              progressUpdateIntervalMillis: 250,
            },
            undefined,
            false,
          );
          if (loadId !== audioLoadIdRef.current) {
            await sound.unloadAsync();
            return;
          }
          soundRef.current = sound;
          sound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
          onPlaybackStatusUpdate(status);
        } else {
          await soundRef.current.playAsync();
        }
      }
    } catch (e) {
      setIsAudioLoading(false);
      console.error('Audio playback error:', e);
    }
  };

  const formatAudioTime = (millis: number) => {
    if (!Number.isFinite(millis) || millis < 0) return '0:00';
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getSeekPosition = (event: GestureResponderEvent) => {
    if (!audioDurationMillis) return 0;
    const ratio = Math.max(
      0,
      Math.min(1, event.nativeEvent.locationX / audioScrubberWidth.current),
    );
    return ratio * audioDurationMillis;
  };

  const seekAudio = async (nextPosition: number) => {
    const clampedPosition = Math.max(
      0,
      Math.min(audioDurationMillis, nextPosition),
    );
    setAudioPositionMillis(clampedPosition);
    try {
      await soundRef.current?.setPositionAsync(clampedPosition);
    } catch (e) {
      console.error('Audio seek error:', e);
    }
  };

  const skipAudio = (offsetMillis: number) => {
    seekAudio(audioPositionMillis + offsetMillis);
  };

  const cyclePlaybackRate = async () => {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    try {
      await soundRef.current?.setRateAsync(nextRate, true);
    } catch (e) {
      console.error('Audio playback speed error:', e);
    }
  };

  useEffect(() => {
    return () => {
      if (sleepTimerTimeoutRef.current) {
        clearTimeout(sleepTimerTimeoutRef.current);
      }
    };
  }, []);

  const beginScrubbing = (event: GestureResponderEvent) => {
    isScrubbingRef.current = true;
    setScrubPositionMillis(getSeekPosition(event));
  };

  const updateScrubbing = (event: GestureResponderEvent) => {
    if (isScrubbingRef.current) {
      setScrubPositionMillis(getSeekPosition(event));
    }
  };

  const finishScrubbing = async (event: GestureResponderEvent) => {
    const nextPosition = getSeekPosition(event);
    isScrubbingRef.current = false;
    setScrubPositionMillis(null);
    await seekAudio(nextPosition);
  };

  useEffect(() => {
    const autoPlayNext = async () => {
      setShouldAutoPlay(false);
      setTimeout(() => toggleAudio(), 500);
    };

    // Only trigger auto-play if:
    // 1. Auto-play was requested (shouldAutoPlay is true)
    // 2. We are not in the middle of a network request (!loading)
    // 3. The loaded chapter data matches the user's current selection (translation/book/chapter)
    // This prevents a race condition where the effect fires for the "old" chapter
    // before the new data has started loading.
    if (
      shouldAutoPlay &&
      !loading &&
      chapterData &&
      chapterData.chapter.number === chapterNum &&
      chapterData.book.id === book?.id &&
      chapterData.translation.id === supportedTranslation.id &&
      chapterData.thisChapterAudioLinks
    ) {
      autoPlayNext();
    }
  }, [
    chapterData,
    loading,
    shouldAutoPlay,
    chapterNum,
    book?.id,
    supportedTranslation.id,
  ]);

  useEffect(() => {
    if (modalType) {
      setLastActiveType(modalType);
    }
  }, [modalType]);

  // The original-language source is selected by canonical book id, not by the
  // displayed translation. This keeps the same Hebrew/Greek lookup available
  // in every application language.
  useEffect(() => {
    if (modalType !== 'verse-detail' || !book || !selectedVerseNum) return;

    let cancelled = false;
    setOriginalVerse(null);
    setOriginalVerseError(false);
    setOriginalVerseLoading(true);

    BibleService.fetchOriginalLanguageVerse(
      book.id,
      chapterNum,
      selectedVerseNum,
    )
      .then((verse) => {
        if (!cancelled) setOriginalVerse(verse);
      })
      .catch((error) => {
        if (!cancelled) {
          setOriginalVerseError(true);
          console.error('Failed to load original-language Bible verse:', error);
        }
      })
      .finally(() => {
        if (!cancelled) setOriginalVerseLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [modalType, book?.id, chapterNum, selectedVerseNum]);

  // Initial load: Fetch books for default translation
  // This effect loads the books for the selected translation and sets the current book.
  useEffect(() => {
    if (!isPersistenceLoaded) return;

    const loadBooksAndSetBook = async () => {
      try {
        const fetchedBooks = await BibleService.fetchBooks(supportedTranslation.id);
        setBooks(fetchedBooks);

        // Determine the next book based on previous selection or default to Genesis
        setBook((prevBook) => {
          // Use saved book ID if this is the first load after persistence
          const targetBookId = initialBookId.current || prevBook?.id;
          initialBookId.current = null; // Clear it so it doesn't interfere with later changes

          const matchingBook = fetchedBooks.find(
            (b: BibleService.TranslationBook) => b.id === targetBookId,
          );

          if (matchingBook) {
            // If the book exists in the new translation, try to preserve the chapter.
            // We clamp it to 1 if the current number exceeds the new book's chapter count.
            setChapterNum((prev) => (prev > matchingBook.numberOfChapters ? 1 : prev));
            return matchingBook;
          }

          // If the book doesn't exist in the new translation, fallback to Genesis or the first book.
          // Since this is effectively a "new" book selection, we reset chapter to 1.
          setChapterNum(1);
          return (
            fetchedBooks.find((b: BibleService.TranslationBook) => b.id === 'GEN') ||
            fetchedBooks[0] ||
            null
          );
        });
      } catch (e) {
        console.error('Error loading books:', e);
      }
    };
    loadBooksAndSetBook();
  }, [supportedTranslation.id, isPersistenceLoaded]);

  // Load chapter content
  useEffect(() => {
    if (!isPersistenceLoaded) return;

    // Only fetch if we have a book and that book belongs to the current translation's book list
    // This prevents "stale" fetches when switching translations where the book IDs might differ.
    const isBookValidForTranslation = books.some(
      (b: BibleService.TranslationBook) => b.id === book?.id,
    );

    if (book && isBookValidForTranslation) {
      const loadChapter = async () => {
        setLoading(true);
        setChapterData(null); // Clear old content immediately
        try {
          const data = await BibleService.fetchChapter(
            supportedTranslation.id,
            book.id,
            chapterNum,
          );
          setChapterData(data);
        } catch (e) {
          console.error('Error loading chapter:', e);
        } finally {
          setLoading(false);
        }
      };
      loadChapter();
    }
  }, [supportedTranslation.id, book?.id, chapterNum, books, isPersistenceLoaded]);

  // Resolve saved references only while the saved-verses view is open. References
  // are translation-independent; chapter requests are deduplicated and cached per
  // translation so changing translations stays responsive.
  useEffect(() => {
    if (modalType !== 'saved') return;

    let cancelled = false;
    const orderedVerses = [...savedVerses].sort((a, b) => b.savedAt - a.savedAt);
    const initialDisplays = orderedVerses.map((verse) => ({
      ...verse,
      bookName: books.find((item) => item.id === verse.bookId)?.name || verse.bookId,
    }));
    setSavedVerseDisplays(initialDisplays);

    if (orderedVerses.length === 0) {
      setSavedVersesLoading(false);
      return;
    }

    setSavedVersesLoading(true);
    Promise.all(
      initialDisplays.map(async (savedVerse) => {
        try {
          const savedChapter = await getSavedChapter(
            supportedTranslation.id,
            savedVerse.bookId,
            savedVerse.chapter,
          );
          const verse = savedChapter.chapter.content.find(
            (item): item is BibleService.ChapterVerse =>
              item.type === 'verse' && item.number === savedVerse.verse,
          );
          return {
            ...savedVerse,
            text: verse
              ? BibleService.renderVerseToPlainText(supportedTranslation.id, verse)
              : undefined,
          };
        } catch (error) {
          console.error('Failed to load a saved Bible verse:', error);
          return savedVerse;
        }
      }),
    ).then((displays) => {
      if (!cancelled) {
        setSavedVerseDisplays(displays);
        setSavedVersesLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [modalType, savedVerses, supportedTranslation.id, books]);

  const getVersePlainText = (verseNum: number) => {
    if (!chapterData) return '';
    const verse = chapterData.chapter.content.find(
      (c) => c.type === 'verse' && c.number === verseNum,
    ) as BibleService.ChapterVerse;
    if (!verse) return '';

    return BibleService.renderVerseToPlainText(supportedTranslation.id, verse);
  };

  const savedVerseKeys = new Set(savedVerses.map(getSavedVerseKey));
  const isVerseSaved = (verseNumber: number) =>
    !!book &&
    savedVerseKeys.has(
      getSavedVerseKey({ bookId: book.id, chapter: chapterNum, verse: verseNumber }),
    );

  const areVersesSaved = (verseNumbers: number[]) =>
    verseNumbers.length > 0 && verseNumbers.every(isVerseSaved);

  const toggleSavedVerses = async (verseNumbers: number[]) => {
    if (!book || verseNumbers.length === 0) return;

    const uniqueVerseNumbers = [...new Set(verseNumbers)];
    const targetKeys = new Set(
      uniqueVerseNumbers.map((verse) =>
        getSavedVerseKey({ bookId: book.id, chapter: chapterNum, verse }),
      ),
    );
    const shouldRemove = uniqueVerseNumbers.every((verse) => isVerseSaved(verse));
    const previousVerses = savedVerses;
    const nextVerses = shouldRemove
      ? savedVerses.filter((verse) => !targetKeys.has(getSavedVerseKey(verse)))
      : [
          ...savedVerses,
          ...uniqueVerseNumbers
            .filter((verse) => !isVerseSaved(verse))
            .map((verse, index) => ({
              bookId: book.id,
              chapter: chapterNum,
              verse,
              savedAt: Date.now() + index,
            })),
        ];

    setSavedVerses(nextVerses);
    try {
      await storeSavedVerses(nextVerses);
    } catch (error) {
      setSavedVerses(previousVerses);
      console.error('Failed to save Bible verses:', error);
    }
  };

  const removeSavedVerse = async (savedVerse: SavedVerseReference) => {
    const previousVerses = savedVerses;
    const targetKey = getSavedVerseKey(savedVerse);
    const nextVerses = savedVerses.filter(
      (verse) => getSavedVerseKey(verse) !== targetKey,
    );
    setSavedVerses(nextVerses);
    try {
      await storeSavedVerses(nextVerses);
    } catch (error) {
      setSavedVerses(previousVerses);
      console.error('Failed to remove saved Bible verse:', error);
    }
  };

  const openSavedVerse = (savedVerse: SavedVerseReference) => {
    const matchingBook = books.find((item) => item.id === savedVerse.bookId);
    if (!matchingBook) return;

    const isCurrentChapter =
      book?.id === savedVerse.bookId && chapterNum === savedVerse.chapter;
    pendingSavedVerseScroll.current = isCurrentChapter ? null : savedVerse.verse;
    setBook(matchingBook);
    setChapterNum(savedVerse.chapter);
    closeModal();
    if (isCurrentChapter) {
      setTimeout(() => {
        const verseY = versePositions.current[savedVerse.verse];
        if (verseY !== undefined) {
          scrollRef.current?.scrollTo({ y: Math.max(0, verseY - 20), animated: true });
        }
      }, 250);
    }
  };

  const handleShare = async () => {
    if (!book || !chapterData) return;

    const isMultiSelect = selectedVerses.size > 0;
    const verseNumbers = isMultiSelect
      ? Array.from(selectedVerses).sort((a, b) => a - b)
      : selectedVerseNum
        ? [selectedVerseNum]
        : [];

    if (verseNumbers.length === 0) return;

    let fullText = '';
    if (verseNumbers.length === 1) {
      fullText = getVersePlainText(verseNumbers[0]);
    } else {
      fullText = verseNumbers.map((num) => getVersePlainText(num)).join('\n\n');
    }

    // Calculate smart ranges for citation (e.g., "1-4, 16")
    const ranges: string[] = [];
    let start = verseNumbers[0];
    let prev = verseNumbers[0];

    for (let i = 1; i <= verseNumbers.length; i++) {
      if (i < verseNumbers.length && verseNumbers[i] === prev + 1) {
        prev = verseNumbers[i];
      } else {
        ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
        if (i < verseNumbers.length) {
          start = verseNumbers[i];
          prev = verseNumbers[i];
        }
      }
    }
    const rangeString = ranges.join(', ');
    const reference = `${book.name} ${chapterNum}:${rangeString}`;

    const translation = supportedTranslation.name;
    const message = `"${fullText}"\n\n— ${reference} (${translation})`;

    try {
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share({
          title: reference,
          text: message,
        });
      } else {
        await Share.share({
          message: `${message}`,
          title: reference,
        });
      }
      if (isMultiSelect) clearSelection();
    } catch (e) {
      if ((e as any).name !== 'AbortError') {
        console.error('Sharing failed', e);
      }
    }
  };

  /**
   * Navigates to the next or previous chapter.
   * Automatically handles transitioning between books (e.g., Matt 28 -> Mark 1).
   */
  const navigateToChapter = (direction: 'prev' | 'next') => {
    if (!book || books.length === 0) return;
    const currentBookIdx = books.findIndex(
      (b: BibleService.TranslationBook) => b.id === book.id,
    );
    if (currentBookIdx === -1) return;

    if (isPlaying) {
      setShouldAutoPlay(true);
    }

    if (direction === 'next') {
      if (chapterNum < book.numberOfChapters) {
        setChapterNum(chapterNum + 1);
      } else if (currentBookIdx < books.length - 1) {
        const nextBook = books[currentBookIdx + 1];
        setBook(nextBook);
        setChapterNum(1);
      }
    } else {
      if (chapterNum > 1) {
        setChapterNum(chapterNum - 1);
      } else if (currentBookIdx > 0) {
        const prevBook = books[currentBookIdx - 1];
        setBook(prevBook);
        setChapterNum(prevBook.numberOfChapters);
      }
    }
  };

  /**
   * Scroll handler to toggle Reader Mode (hiding/showing menus)
   */
  const handleScroll = (event: any) => {
    if (isSelectionActive) return; // Don't hide menus while selecting
    const currentOffset = event.nativeEvent.contentOffset.y;
    // Ignore bounces
    if (currentOffset < 0) return;

    // If we've scrolled more than a small threshold, determine direction
    if (Math.abs(currentOffset - lastScrollY.current) > 15) {
      if (currentOffset > lastScrollY.current && currentOffset > 100) {
        // Scrolling down: Hide menus
        updateMenuVisibility(false);
      } else {
        // Scrolling up: Show menus
        updateMenuVisibility(true);
      }
      lastScrollY.current = currentOffset;
    }
  };

  // Scroll to top when chapter content changes
  useEffect(() => {
    // Ensure menus are visible on mount or chapter change
    updateMenuVisibility(true);

    if (chapterData) {
      clearSelection();
      versePositions.current = {}; // Clear previous chapter positions

      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }

    // Stop and unload audio when the chapter changes or the component unmounts
    return () => {
      audioLoadIdRef.current += 1;
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      isScrubbingRef.current = false;
      setIsPlaying(false);
      setIsAudioLoading(false);
      setAudioPositionMillis(0);
      setAudioDurationMillis(0);
      setAudioBufferedMillis(0);
      setScrubPositionMillis(null);
      // Always restore menus when leaving the reader
      updateMenuVisibility(true);
    };
  }, [chapterData, setGlobalMenuVisible]);

  useEffect(() => {
    if (!chapterData || pendingSavedVerseScroll.current === null) return;
    const verseNumber = pendingSavedVerseScroll.current;
    const timeout = setTimeout(() => {
      const verseY = versePositions.current[verseNumber];
      if (verseY !== undefined) {
        scrollRef.current?.scrollTo({ y: Math.max(0, verseY - 20), animated: true });
        pendingSavedVerseScroll.current = null;
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [chapterData]);

  /**
   * Renders individual content items (text, formatted text, footnotes, etc.)
   * Handles poetic indentation.
   */
  const renderItemContent = (
    item: any,
    i: number,
    contentArray: any[],
    allowUnderline = true,
    isBold = false,
  ) => {
    const textValue = typeof item === 'string' ? item : (item as any).text || '';
    const isPoetic = typeof item === 'object' && item !== null && 'poem' in item;
    const startsWithNewLine = textValue.startsWith('\n');
    const prevItem = i > 0 ? contentArray[i - 1] : null;
    const prevIsLineBreak = !!(
      prevItem &&
      typeof prevItem === 'object' &&
      'lineBreak' in prevItem
    );
    const followsFootnote = !!(
      prevItem &&
      typeof prevItem === 'object' &&
      'noteId' in prevItem
    );

    // 1. Calculate Poetic Continuity
    // We scan backwards to skip over metadata (like footnotes) to see if this segment
    // is a continuation of a previously split line.
    let isLineContinuation = false;
    let foundPreviousContent = false;

    if (isPoetic && i > 0 && !prevIsLineBreak) {
      let skippedInterruption = false;
      for (let k = i - 1; k >= 0; k--) {
        const prev = contentArray[k];
        const isMetadata = typeof prev === 'object' && prev !== null && 'noteId' in prev;
        const isWhitespace = typeof prev === 'string' && prev.trim().length === 0;

        if (isMetadata || isWhitespace) {
          skippedInterruption = true;
          continue;
        }

        foundPreviousContent = true;
        const prevIsPoetic = typeof prev === 'object' && prev !== null && 'poem' in prev;
        const prevText = typeof prev === 'string' ? prev : (prev as any)?.text || '';
        const prevIsSelah = BibleService.isSelahMarker(supportedTranslation.id, prevText);

        // Only "heal" the line if we are on the exact same poetic level and the
        // raw text doesn't explicitly start with a newline.
        if (
          prevIsPoetic &&
          !prevIsSelah &&
          (prev as any).poem === item.poem &&
          skippedInterruption &&
          !startsWithNewLine
        ) {
          isLineContinuation = true;
        }
        break;
      }
      if (!foundPreviousContent) isLineContinuation = false;
    }

    // Version-specific detection for liturgical/poetic markers.
    // This ensures we don't match modern academic terms in historical translations.
    const isSelah = BibleService.isSelahMarker(supportedTranslation.id, textValue);

    // If we follow a footnote and don't start with whitespace or punctuation,
    // inject a space to prevent "welded" words like "allywith".
    // We only inject if we AREN'T about to start a new poetic line (which adds a newline).
    let contentText = textValue;
    const willAddPoeticNewLine =
      isPoetic &&
      !isLineContinuation &&
      i > 0 &&
      foundPreviousContent &&
      !prevIsLineBreak;
    const willAddSelahNewLine = isSelah && i > 0 && !prevIsLineBreak;

    if (
      (followsFootnote || isSelah) &&
      !(isPoetic && !isLineContinuation && i > 0) &&
      !willAddPoeticNewLine &&
      !willAddSelahNewLine &&
      contentText.length > 0 &&
      !BibleService.startsWithPunctuationOrSpace(contentText)
    ) {
      contentText = ' ' + contentText;
    }

    // Peek ahead for footnote markers to apply underlining to the current word
    let isFootnoted = false;
    if (allowUnderline) {
      for (let j = i + 1; j < contentArray.length; j++) {
        const next = contentArray[j];
        if (typeof next === 'object' && 'noteId' in next) {
          isFootnoted = true;
          break;
        }
        if (typeof next === 'string' && next.trim().length > 0) break;
        if (typeof next === 'object' && ('text' in next || 'heading' in next)) break;
      }
    }

    const renderText = (text: string, style?: any) => {
      const { leading, core, trailingPunct, trailingSpace } =
        BibleService.segmentText(text);

      // 1. Handle Liturgical Markers (Selah/Higgaion)
      if (isSelah) {
        // Wrap Selah in a View to ensure it behaves as a block-level element
        // allowing `textAlign: 'right'` to work consistently across platforms.
        return (
          <View key={i} style={{ width: '100%' }}>
            <Text
              style={ReaderStyles.selahMarker}
            >
              <Text
                style={[
                  style,
                  isFootnoted
                    ? {
                        textDecorationLine: 'underline',
                        textDecorationColor: theme.colors.primary,
                      }
                    : undefined,
                  isBold && { fontWeight: 'bold' },
                ]}
              >
                {core}
              </Text>
              {trailingPunct}
            </Text>
          </View>
        );
      }

      if (!isFootnoted || !core) {
        return (
          <Text key={i} style={[style, isBold && { fontWeight: 'bold' }]}>
            {text}
          </Text>
        );
      }

      return (
        <Text key={i} style={[style, isBold && { fontWeight: 'bold' }]}>
          {leading}
          <Text
            style={[
              {
                textDecorationLine: 'underline',
                textDecorationColor: theme.colors.primary,
              },
              isBold && { fontWeight: 'bold' },
            ]}
          >
            {core}
          </Text>
          <Text style={[style, isBold && { fontWeight: 'bold' }]}>{trailingPunct}</Text>
          {trailingSpace}
        </Text>
      );
    };

    if (typeof item === 'string') {
      return renderText(contentText);
    }

    // Formatted Text (Poetry)
    if ('text' in item) {
      const indent =
        isPoetic && item.poem && item.poem > 1 && !isSelah
          ? '\u00A0'.repeat((item.poem - 1) * 3)
          : '';

      const prefix =
        (isPoetic &&
        foundPreviousContent &&
        !isLineContinuation &&
        !isSelah &&
        i > 0 &&
        !prevIsLineBreak
          ? '\n'
          : '') + (!isLineContinuation ? indent : '');

      return renderText(prefix + contentText);
    }

    // Inline Line Breaks (explicitly provided in the data)
    if (typeof item === 'object' && item !== null && 'lineBreak' in item) {
      return <Text key={i}>{'\n'}</Text>;
    }

    // Footnote Markers: Now that we have underlines, we skip rendering the literal
    // superscript caller (e.g., * or a) to maintain a cleaner reading experience.
    if ('noteId' in item) return null;

    return null;
  };

  /**
   * Finds the subtitle (e.g., Psalm superscription) associated with a specific verse.
   * Scans backwards from the verse to find an associated subtitle before hitting another verse.
   */
  const getAssociatedSubtitle = (verseNum: number) => {
    if (!chapterData) return null;
    const content = chapterData.chapter.content;
    const vIdx = content.findIndex((c) => c.type === 'verse' && c.number === verseNum);
    if (vIdx === -1) return null;

    for (let i = vIdx - 1; i >= 0; i--) {
      const item = content[i];
      if (item.type === 'hebrew_subtitle')
        return item as BibleService.ChapterHebrewSubtitle;
      if (item.type === 'verse' || item.type === 'heading') break;
    }
    return null;
  };

  /**
   * Helper to check if a verse has footnotes or an associated original language subtitle.
   * This prevents opening empty modals.
   */
  const getVerseExtras = (verseNum: number) => {
    if (!chapterData) return { hasFootnotes: false, hasSubtitle: false };

    const isPsalmVerseOne = book?.id === 'PSA' && verseNum === 1;
    const subtitle = getAssociatedSubtitle(verseNum);
    const subtitleText = subtitle
      ? subtitle.content
          .map((item) => (typeof item === 'string' ? item : (item as any).text || ''))
          .join('')
          .trim()
      : '';

    const uniqueFootnotes = chapterData.chapter.footnotes.filter((f) => {
      if (f.reference?.verse !== verseNum) return false;
      // Filter out footnotes that simply repeat the Hebrew Subtitle / Superscription
      if (subtitleText && f.text.trim() === subtitleText) return false;
      return true;
    });

    // Hardcode exception: Psalm Verse 1 subtitles are already rendered as structural elements.
    return {
      hasFootnotes: uniqueFootnotes.length > 0,
      hasSubtitle: !!subtitle && !isPsalmVerseOne,
    };
  };

  /**
   * Opens the "Verse Detail" modal. This modal aggregates footnotes
   * and Hebrew subtitles relevant to the specific verse tapped.
   */
  const openVerseDetails = (num: number) => {
    setOriginalVerse(null);
    setOriginalVerseError(false);
    setOriginalVerseLoading(true);
    setSelectedVerseNum(num);
    setModalType('verse-detail');
  };

  const renderContent = (content: BibleService.ChapterContent, index: number) => {
    switch (content.type) {
      case 'heading':
        return (
          <Text
            key={index}
            style={[ReaderStyles.heading, { color: theme.colors.onBackground }]}
          >
            {content.content.join(' ')}
          </Text>
        );
      case 'hebrew_subtitle':
        return (
          <Text
            key={index}
            style={[
              ReaderStyles.hebrewSubtitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {content.content.map((item, i) =>
              renderItemContent(item, i, content.content, false),
            )}
          </Text>
        );
      case 'verse':
        const { hasFootnotes, hasSubtitle } = getVerseExtras(content.number);
        const isSelected = selectedVerses.has(content.number);
        const isSaved = isVerseSaved(content.number);

        // To support right-aligned liturgical markers (Selah, Higgaion) while
        // maintaining proper inline word-wrapping for prose/poetry, we segment
        // the verse. Liturgical markers are rendered as block-level right-aligned
        // elements, while the rest of the verse remains inline.
        const verseElements: React.ReactNode[] = [];
        let inlineBuffer: { item: any; index: number }[] = [];

        const flushBuffer = (key: string) => {
          if (inlineBuffer.length === 0 && verseElements.length > 0) return;
          verseElements.push(
            <Text
              key={key}
              style={[
                ReaderStyles.verseContainer,
                { color: theme.colors.onBackground },
                isSelected && { fontWeight: 'bold' },
              ]}
            >
              {verseElements.length === 0 && (
                <Text
                  style={[
                    ReaderStyles.verseNumber,
                    {
                      color:
                        hasFootnotes || hasSubtitle
                          ? theme.colors.onSurface
                          : theme.colors.onSurfaceVariant,
                      textDecorationLine: 'none',
                    },
                    isSelected && { fontWeight: 'bold' },
                  ]}
                >
                  {content.number}{' '}
                </Text>
              )}
              {inlineBuffer.map((entry) =>
                renderItemContent(
                  entry.item,
                  entry.index,
                  content.content,
                  hasFootnotes,
                  isSelected,
                ),
              )}
            </Text>,
          );
          inlineBuffer = [];
        };

        content.content.forEach((item, i) => {
          const textValue = typeof item === 'string' ? item : (item as any).text || '';
          const isSelah = BibleService.isSelahMarker(supportedTranslation.id, textValue);

          if (isSelah) {
            flushBuffer(`text-pre-${i}`);
            verseElements.push(
              renderItemContent(item, i, content.content, hasFootnotes, isSelected),
            );
          } else {
            inlineBuffer.push({ item, index: i });
          }
        });
        flushBuffer('text-final');

        return (
          <TouchableOpacity
            key={index}
            onPress={() => {
              if (selectedVerses.size > 0) {
                toggleVerseSelection(content.number);
              } else {
                openVerseDetails(content.number);
              }
            }}
            onLongPress={() => toggleVerseSelection(content.number)}
            activeOpacity={0.6}
            style={[
              (isSaved || isSelected) && {
                backgroundColor: isSelected
                  ? theme.colors.secondaryContainer
                  : theme.colors.verseHighlight,
                borderRadius: 4,
                marginHorizontal: -8,
                paddingHorizontal: 8,
              },
            ]}
            onLayout={(e) => {
              versePositions.current[content.number] = e.nativeEvent.layout.y;
            }}
          >
            <View style={{ width: '100%' }}>{verseElements}</View>
          </TouchableOpacity>
        );
      case 'line_break':
        return <View key={index} style={ReaderStyles.lineBreak} />;
      default:
        return null;
    }
  };

  const closeModal = () => setModalType(null);

  const bibleChapterVerses = (chapterData?.chapter.content || [])
    .filter((content): content is BibleService.ChapterVerse => content.type === 'verse')
    .map((verse) => ({
      number: verse.number,
      title: `${book?.name || labels.bible} ${chapterNum}:${verse.number}`,
      text: BibleService.renderVerseToPlainText(supportedTranslation.id, verse),
    }));

  const handleBibleVerseSearchPress = (verseNumber: number) => {
    const verseY = versePositions.current[verseNumber];
    if (verseY !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(0, verseY - 20), animated: true });
    }
  };

  const audioLinks = chapterData?.thisChapterAudioLinks;
  const hasChapterAudio = !!audioLinks && Object.keys(audioLinks).length > 0;
  const dockExtraHeight =
    (hasChapterAudio ? dockLayout.audioDockHeight : 0) +
    (isSelectionActive ? dockLayout.selectionBarHeight : 0);
  const fullDockContentHeight = dockLayout.dockHeight + dockExtraHeight;
  const compactAudioDockHeight = getCompactBibleAudioDockHeight(effectiveTextScale);
  const canCompactAudioDock = hasChapterAudio && !isSelectionActive;
  const isCompactAudioDock = canCompactAudioDock && !menuVisible;
  const dockViewportLayout = getBibleDockViewportLayout({
    bottomInset: bottomDockInset,
    bottomTabHeight: bottomTabContentHeight,
    contentHeight: fullDockContentHeight,
    headerHeight,
    hiddenContentHeight: canCompactAudioDock
      ? compactAudioDockHeight
      : fullDockContentHeight,
    viewportHeight,
  });
  const animatedControlDockHeight = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      dockViewportLayout.hiddenHeight,
      dockViewportLayout.visibleHeight,
    ],
  });
  const animatedDockBottomClearance = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      bottomDockInset,
      bottomDockInset + bottomTabContentHeight,
    ],
  });
  const dockNeedsVerticalScroll =
    dockViewportLayout.hiddenNeedsScroll || dockViewportLayout.visibleNeedsScroll;

  const renderPreviousChapterButton = () =>
    !isFirstChapter ? (
      <IconButton
        icon="chevron-left"
        size={scaleTypographyMetric(26, bibleUiTextScale)}
        onPress={() => navigateToChapter('prev')}
        accessibilityLabel={labels.previousChapter}
        style={ReaderStyles.navIcon}
      />
    ) : (
      <View style={ReaderStyles.buttonPlaceholder} />
    );

  const renderNextChapterButton = () =>
    !isLastChapter ? (
      <IconButton
        icon="chevron-right"
        size={scaleTypographyMetric(26, bibleUiTextScale)}
        onPress={() => navigateToChapter('next')}
        accessibilityLabel={labels.nextChapterA11y}
        style={ReaderStyles.navIcon}
      />
    ) : (
      <View style={ReaderStyles.buttonPlaceholder} />
    );

  const renderChapterSelectors = () => (
    <View
      style={[
        ReaderStyles.pillsContainer,
        dockLayout.stackControls && styles.stackedPillsContainer,
      ]}
    >
      <TouchableOpacity
        style={[
          ReaderStyles.pill,
          dockLayout.stackControls && styles.stackedPill,
          {
            backgroundColor: theme.colors.surfaceVariant,
            minHeight: dockLayout.controlHeight,
          },
        ]}
        onPress={() => setModalType('book')}
        accessibilityRole="button"
        accessibilityLabel={`${labels.book}: ${book?.name || '...'}`}
      >
        <Text pointerEvents="none" style={ReaderStyles.pillText}>
          {book?.name || '...'}
        </Text>
        <AppIcon
          pointerEvents="none"
          name="chevron-down"
          size={14}
          scaleWithText={false}
          color={theme.colors.onSurfaceVariant}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          ReaderStyles.pill,
          dockLayout.stackControls && styles.stackedPill,
          {
            backgroundColor: theme.colors.surfaceVariant,
            minHeight: dockLayout.controlHeight,
          },
        ]}
        onPress={() => setModalType('chapter')}
        accessibilityRole="button"
        accessibilityLabel={`${labels.chapter}: ${chapterNum}`}
      >
        <Text pointerEvents="none" style={ReaderStyles.pillText}>
          {chapterNum}
        </Text>
        <AppIcon
          pointerEvents="none"
          name="chevron-down"
          size={14}
          scaleWithText={false}
          color={theme.colors.onSurfaceVariant}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          ReaderStyles.pill,
          dockLayout.stackControls && styles.stackedPill,
          {
            backgroundColor: theme.colors.surfaceVariant,
            minHeight: dockLayout.controlHeight,
          },
        ]}
        onPress={() => setModalType('verse')}
        accessibilityRole="button"
        accessibilityLabel={labels.verse}
      >
        <Text pointerEvents="none" style={ReaderStyles.pillText}>
          {labels.verse}
        </Text>
        <AppIcon
          pointerEvents="none"
          name="chevron-down"
          size={14}
          scaleWithText={false}
          color={theme.colors.onSurfaceVariant}
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={NavigationStyles.container}>
      <Stack.Screen
        options={
          {
            title: book ? `${book.name} ${chapterNum}` : labels.bible,
            backTo: paramBackTo,
            bibleTranslation: getTranslationLabel(supportedTranslation),
            onBibleTranslationPress: () => setModalType('translation'),
            onBibleSavedVersesPress: () => setModalType('saved'),
            bibleSavedVerseCount: savedVerses.length,
            bibleSavedVersesLabel: labels.savedVerses,
            bibleChapterVerses,
            onBibleVerseSearchPress: handleBibleVerseSearchPress,
          } as any
        }
      />
      <ScrollView
        ref={scrollRef}
        bounces={true}
        alwaysBounceVertical={true}
        scrollEventThrottle={32}
        onScroll={handleScroll}
        contentContainerStyle={[
          ReaderStyles.scrollContent,
          {
            paddingTop: headerHeight + 10,
            paddingBottom:
              dockViewportLayout.visibleHeight + FOOTER_PADDING_GUTTER,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator style={ReaderStyles.loader} color={theme.colors.primary} />
        ) : (
          <>
            {chapterData?.chapter.content.map((c, i) => renderContent(c, i))}
            {chapterData?.translation.attribution && !loading && (
              <Text
                variant="labelSmall"
                style={{
                  textAlign: 'center',
                  marginTop: 24,
                  marginBottom: 20,
                  opacity: 0.5,
                }}
              >
                {chapterData.translation.attribution}
              </Text>
            )}
          </>
        )}
      </ScrollView>


      {/* Control Dock: Sticky Bottom Navigation & Action Bar */}
      <Animated.View
        style={[
          ReaderStyles.controlDock,
          {
            bottom: 0,
            height: animatedControlDockHeight,
            transform: [{ translateY: dockTranslateY }],
            elevation: 5, // Higher than the audio button's 4 to prioritize nav touches
            zIndex: 10,
          },
        ]}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme.colors.background,
            },
          ]}
        />

        <ScrollView
          style={styles.controlDockScroll}
          contentContainerStyle={styles.controlDockScrollContent}
          alwaysBounceVertical={false}
          bounces={dockNeedsVerticalScroll}
          nestedScrollEnabled
          showsVerticalScrollIndicator={dockNeedsVerticalScroll}
        >

        {isCompactAudioDock ? (
          <View
            style={[
              styles.compactAudioDock,
              { minHeight: compactAudioDockHeight },
            ]}
          >
            <IconButton
              icon={isPlaying ? 'pause' : 'play'}
              mode="contained"
              containerColor={theme.colors.tertiary}
              iconColor={theme.colors.onPrimary}
              size={scaleTypographyMetric(24, bibleUiTextScale)}
              onPress={toggleAudio}
              disabled={isAudioLoading && !soundRef.current}
              accessibilityLabel={labels.audioPlayer}
              style={styles.compactAudioPlayButton}
            />
            <View style={styles.compactAudioDetails}>
              <Text
                numberOfLines={1}
                style={[
                  styles.compactAudioTitle,
                  { color: theme.colors.onSurface },
                ]}
              >
                {book?.name || labels.bible} {chapterNum}
              </Text>
              <View
                style={[
                  styles.compactAudioTrack,
                  { backgroundColor: theme.colors.outlineVariant },
                ]}
              >
                <View
                  style={[
                    styles.compactAudioProgress,
                    {
                      backgroundColor: theme.colors.tertiary,
                      width: `${
                        audioDurationMillis
                          ? Math.min(
                              100,
                              (audioPositionMillis / audioDurationMillis) * 100,
                            )
                          : 0
                      }%`,
                    },
                  ]}
                />
              </View>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={labels.showAudioControls}
              onPress={() => updateMenuVisibility(true)}
              style={styles.compactAudioExpandButton}
            >
              <AppIcon
                name="chevron-up"
                size={20}
                textScale={bibleUiTextScale}
                color={theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          </View>
        ) : (
          <>

        {/* Selection Actions Bar (Integrated) */}
        {isSelectionActive && (
          <View>
            <View
              style={[
                styles.selectionBarInner,
                dockLayout.stackControls && styles.stackedSelectionBarInner,
                { minHeight: dockLayout.selectionBarHeight },
              ]}
            >
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={labels.cancel}
                onPress={clearSelection}
                style={[
                  styles.dockTextAction,
                  dockLayout.stackControls && styles.stackedDockTextAction,
                  { borderColor: theme.colors.outline },
                ]}
              >
                <Text
                  style={[
                    styles.dockActionText,
                    { color: theme.colors.primary },
                  ]}
                >
                  {labels.cancel}
                </Text>
              </TouchableOpacity>
              <IconButton
                mode="contained-tonal"
                icon={
                  areVersesSaved(Array.from(selectedVerses))
                    ? 'bookmark-remove'
                    : 'bookmark-plus'
                }
                accessibilityLabel={
                  areVersesSaved(Array.from(selectedVerses))
                    ? labels.removeAction
                    : labels.saveAction
                }
                onPress={async () => {
                  await toggleSavedVerses(Array.from(selectedVerses));
                  clearSelection();
                }}
                style={{ margin: 0 }}
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={labels.shareAction}
                onPress={handleShare}
                style={[
                  styles.dockTextAction,
                  styles.dockContainedAction,
                  dockLayout.stackControls && styles.stackedDockTextAction,
                  { backgroundColor: theme.colors.primary },
                ]}
              >
                <AppIcon
                  pointerEvents="none"
                  name="share-variant"
                  size={22}
                  textScale={bibleUiTextScale}
                  color={theme.colors.onPrimary}
                />
                <Text
                  style={[
                    styles.dockActionText,
                    { color: theme.colors.onPrimary },
                  ]}
                >
                  {labels.shareAction}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {hasChapterAudio && (
          <View
            style={[
              ReaderStyles.audioDock,
              { minHeight: dockLayout.audioDockHeight },
            ]}
          >
            <View
              style={[
                ReaderStyles.audioControlRow,
                dockLayout.stackControls && styles.stackedAudioControlRow,
              ]}
            >
              <TouchableOpacity
                onPress={cyclePlaybackRate}
                accessibilityRole="button"
                accessibilityLabel={`${labels.playbackSpeed}: ${playbackRate}×`}
                style={[
                  ReaderStyles.audioSideControl,
                  dockLayout.stackControls && {
                    minHeight: dockLayout.controlHeight,
                    minWidth: dockLayout.controlHeight,
                  },
                  { backgroundColor: theme.colors.surfaceVariant },
                ]}
              >
                <Text
                  style={[
                    ReaderStyles.audioControlText,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  {playbackRate}×
                </Text>
              </TouchableOpacity>

              <View style={ReaderStyles.audioTransportControls}>
                <IconButton
                  icon="rewind-10"
                  size={scaleTypographyMetric(26, bibleUiTextScale)}
                  onPress={() => skipAudio(-10000)}
                  disabled={!soundRef.current || !audioDurationMillis}
                  accessibilityLabel={labels.back10}
                  style={ReaderStyles.audioAction}
                />
                <IconButton
                  icon={isPlaying ? 'pause' : 'play'}
                  mode="contained"
                  containerColor={theme.colors.tertiary}
                  iconColor={theme.colors.onPrimary}
                  size={scaleTypographyMetric(26, bibleUiTextScale)}
                  onPress={toggleAudio}
                  disabled={isAudioLoading && !soundRef.current}
                  accessibilityLabel={labels.audioPlayer}
                  style={ReaderStyles.audioPlayButton}
                />
                <IconButton
                  icon="fast-forward-30"
                  size={scaleTypographyMetric(26, bibleUiTextScale)}
                  onPress={() => skipAudio(30000)}
                  disabled={!soundRef.current || !audioDurationMillis}
                  accessibilityLabel={labels.forward30}
                  style={ReaderStyles.audioAction}
                />
              </View>

              <TouchableOpacity
                onPress={() => setSleepTimerVisible(true)}
                accessibilityRole="button"
                accessibilityLabel={labels.sleepTimer}
                accessibilityState={{ selected: sleepTimerSetting !== null }}
                style={[
                  ReaderStyles.audioSideControl,
                  dockLayout.stackControls && {
                    minHeight: dockLayout.controlHeight,
                    minWidth: dockLayout.controlHeight,
                  },
                  { backgroundColor: theme.colors.surfaceVariant },
                ]}
              >
                <AppIcon
                  name="timer-outline"
                  size={25}
                  textScale={bibleUiTextScale}
                  color={
                    sleepTimerSetting !== null
                      ? theme.colors.tertiary
                      : theme.colors.onSurface
                  }
                />
                {sleepTimerSetting !== null && (
                  <View
                    style={[
                      ReaderStyles.timerBadge,
                      { backgroundColor: theme.colors.tertiary },
                    ]}
                  />
                )}
              </TouchableOpacity>
            </View>

            <View
              style={[
                ReaderStyles.audioTimelineRow,
                dockLayout.stackControls && styles.stackedAudioTimelineRow,
              ]}
            >
              <Text
                style={[
                  ReaderStyles.audioTimeText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {formatAudioTime(scrubPositionMillis ?? audioPositionMillis)}
              </Text>
              <View
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={labels.audioPlayer}
                accessibilityValue={{
                  min: 0,
                  max: Math.round(audioDurationMillis / 1000),
                  now: Math.round(
                    (scrubPositionMillis ?? audioPositionMillis) / 1000,
                  ),
                  text: `${formatAudioTime(
                    scrubPositionMillis ?? audioPositionMillis,
                  )} / ${formatAudioTime(audioDurationMillis)}`,
                }}
                accessibilityActions={[
                  { name: 'decrement', label: labels.back10 },
                  { name: 'increment', label: labels.forward30 },
                ]}
                onAccessibilityAction={(event) => {
                  skipAudio(event.nativeEvent.actionName === 'increment' ? 30000 : -10000);
                }}
                style={[
                  ReaderStyles.audioScrubberTouchTarget,
                  dockLayout.stackControls && styles.stackedAudioScrubber,
                ]}
                onLayout={(event) => {
                  audioScrubberWidth.current = event.nativeEvent.layout.width || 1;
                }}
                onStartShouldSetResponder={() => audioDurationMillis > 0}
                onMoveShouldSetResponder={() => audioDurationMillis > 0}
                onResponderGrant={beginScrubbing}
                onResponderMove={updateScrubbing}
                onResponderRelease={finishScrubbing}
                onResponderTerminate={finishScrubbing}
              >
                <View style={ReaderStyles.audioTrack}>
                  <View
                    style={[
                      ReaderStyles.audioBufferedTrack,
                      {
                        backgroundColor: theme.colors.outlineVariant,
                        width: `${
                          audioDurationMillis
                            ? Math.min(
                                100,
                                (audioBufferedMillis / audioDurationMillis) * 100,
                              )
                            : 0
                        }%`,
                      },
                    ]}
                  />
                  <View
                    style={[
                      ReaderStyles.audioPlayedTrack,
                      {
                        backgroundColor: theme.colors.tertiary,
                        width: `${
                          audioDurationMillis
                            ? Math.min(
                                100,
                                ((scrubPositionMillis ?? audioPositionMillis) /
                                  audioDurationMillis) *
                                  100,
                              )
                            : 0
                        }%`,
                      },
                    ]}
                  />
                  <View
                    style={[
                      ReaderStyles.audioThumb,
                      {
                        backgroundColor: theme.colors.tertiary,
                        left: `${
                          audioDurationMillis
                            ? Math.min(
                                100,
                                ((scrubPositionMillis ?? audioPositionMillis) /
                                  audioDurationMillis) *
                                  100,
                              )
                            : 0
                        }%`,
                      },
                    ]}
                  />
                </View>
              </View>
              {isAudioLoading ? (
                <ActivityIndicator size={12} color={theme.colors.tertiary} />
              ) : (
                <Text
                  style={[
                    ReaderStyles.audioTimeText,
                    dockLayout.stackControls && styles.audioDurationText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {formatAudioTime(audioDurationMillis)}
                </Text>
              )}
            </View>

          </View>
        )}

        <View
          style={[
            ReaderStyles.dockInner,
            dockLayout.stackControls && styles.stackedDockInner,
            { height: dockLayout.dockHeight },
            fullscreenEdgeInset > 0 && { paddingHorizontal: fullscreenEdgeInset },
          ]}
        >
          {dockLayout.stackControls ? (
            <>
              {renderChapterSelectors()}
              <View style={styles.stackedNavigationRow}>
                <View style={ReaderStyles.sideSlot}>
                  {renderPreviousChapterButton()}
                </View>
                <View style={ReaderStyles.sideSlot}>{renderNextChapterButton()}</View>
              </View>
            </>
          ) : (
            <>
              <View style={ReaderStyles.sideSlot}>
                {renderPreviousChapterButton()}
              </View>
              {renderChapterSelectors()}
              <View style={ReaderStyles.sideSlot}>{renderNextChapterButton()}</View>
            </>
          )}
        </View>
          </>
        )}
        <Animated.View style={{ height: animatedDockBottomClearance }} />
        </ScrollView>
      </Animated.View>

      <Portal>
        <Modal
          visible={sleepTimerVisible}
          onDismiss={() => setSleepTimerVisible(false)}
          contentContainerStyle={[
            ReaderStyles.modalContent,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <View style={ReaderStyles.modalInner}>
            <Text
              variant="titleLarge"
              style={[ReaderStyles.modalTitle, { color: theme.colors.onSurface }]}
            >
              {labels.sleepTimer}
            </Text>
            <Divider />
            <ScrollView>
              {(
                [
                  { value: null, label: labels.timerOff },
                  { value: 5, label: labels.minutes.replace('{n}', '5') },
                  { value: 10, label: labels.minutes.replace('{n}', '10') },
                  { value: 15, label: labels.minutes.replace('{n}', '15') },
                  { value: 30, label: labels.minutes.replace('{n}', '30') },
                  { value: 60, label: labels.oneHour },
                  { value: 120, label: labels.twoHours },
                  { value: 'chapter', label: labels.endOfChapter },
                ] as { value: SleepTimerSetting; label: string }[]
              ).map((option) => (
                <TouchableOpacity
                  key={option.value ?? 'off'}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{
                    selected: option.value === sleepTimerSetting,
                  }}
                  onPress={() => selectSleepTimer(option.value)}
                  style={styles.pressRow}
                >
                  <AppIcon
                    pointerEvents="none"
                    name={
                      option.value === 'chapter'
                        ? 'book-clock-outline'
                        : 'timer-outline'
                    }
                    size={24}
                    textScale={bibleUiTextScale}
                    color={theme.colors.onSurfaceVariant}
                  />
                  <Text
                    style={[
                      styles.pressRowText,
                      option.value === sleepTimerSetting
                        ? { color: theme.colors.primary, fontWeight: '700' }
                        : { color: theme.colors.onSurface },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {option.value === sleepTimerSetting && (
                    <AppIcon
                      pointerEvents="none"
                      name="check"
                      size={24}
                      textScale={bibleUiTextScale}
                      color={theme.colors.primary}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>
      </Portal>

      {/* Selection Modals */}
      <Portal>
        <Modal
          visible={!!modalType}
          onDismiss={closeModal}
          contentContainerStyle={[
            ReaderStyles.modalContent,
            lastActiveType === 'verse-detail' && styles.verseDetailModalContent,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <View style={ReaderStyles.modalInner}>
            {lastActiveType === 'saved' ? (
              <>
                <Text
                  variant="titleLarge"
                  style={[ReaderStyles.modalTitle, { color: theme.colors.onSurface }]}
                >
                  {labels.savedVerses}
                </Text>
                <Text
                  variant="bodySmall"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    textAlign: 'center',
                    marginTop: -8,
                    marginBottom: 12,
                  }}
                >
                  {labels.savedVersesSubtitle.replace(
                    '{translation}',
                    supportedTranslation.name,
                  )}
                </Text>
                <Divider />
                {savedVerseDisplays.length === 0 ? (
                  <View style={styles.savedEmptyState}>
                    {savedVersesLoading ? (
                      <ActivityIndicator color={theme.colors.primary} />
                    ) : (
                      <>
                        <AppIcon
                          name="bookmark-outline"
                          size={36}
                          textScale={bibleUiTextScale}
                          color={theme.colors.onSurfaceVariant}
                        />
                        <Text
                          style={{
                            color: theme.colors.onSurfaceVariant,
                            textAlign: 'center',
                          }}
                        >
                          {labels.noSavedVerses}
                        </Text>
                      </>
                    )}
                  </View>
                ) : (
                  <FlatList
                    data={savedVerseDisplays}
                    keyExtractor={getSavedVerseKey}
                    contentContainerStyle={{ paddingVertical: 4 }}
                    renderItem={({ item }) => (
                      <View style={styles.savedVerseRow}>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={`${item.bookName} ${item.chapter}:${item.verse}`}
                          onPress={() => openSavedVerse(item)}
                          style={styles.savedVerseMainAction}
                        >
                          <AppIcon
                            pointerEvents="none"
                            name="bookmark"
                            size={24}
                            textScale={bibleUiTextScale}
                            color={theme.colors.primary}
                          />
                          <View pointerEvents="none" style={styles.savedVerseText}>
                            <Text
                              style={[
                                styles.pressRowText,
                                {
                                  color: theme.colors.onSurface,
                                  fontWeight: '700',
                                },
                              ]}
                            >
                              {item.bookName} {item.chapter}:{item.verse}
                            </Text>
                            {(item.text || savedVersesLoading) && (
                              <Text
                                style={[
                                  styles.savedVerseDescription,
                                  { color: theme.colors.onSurfaceVariant },
                                ]}
                              >
                                {item.text || '…'}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                        <IconButton
                          icon="bookmark-remove-outline"
                          accessibilityLabel={`${labels.removeAction}: ${item.bookName} ${item.chapter}:${item.verse}`}
                          onPress={() => removeSavedVerse(item)}
                        />
                      </View>
                    )}
                  />
                )}
              </>
            ) : lastActiveType === 'verse-detail' ? (
              <>
                <Text
                  variant="titleLarge"
                  style={[ReaderStyles.modalTitle, { color: theme.colors.onSurface }]}
                >
                  {book?.name} {chapterNum}:{selectedVerseNum}
                </Text>
                <Divider />
                <ScrollView style={ReaderStyles.modalScroll}>
                  <View style={ReaderStyles.detailSection}>
                    <Text style={[ReaderStyles.detailText, { fontWeight: '500' }]}>
                      {getVersePlainText(selectedVerseNum || 0)}
                    </Text>
                  </View>
                  <Divider style={{ marginBottom: 16 }} />
                  {originalVerseLoading ? (
                    <View style={styles.originalVerseStatus}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                      <Text style={{ color: theme.colors.onSurfaceVariant }}>
                        {labels.loadingOriginal}
                      </Text>
                    </View>
                  ) : originalVerse ? (
                    <View style={ReaderStyles.detailSection}>
                      <Text
                        variant="labelSmall"
                        style={{ color: theme.colors.tertiary, marginBottom: 6 }}
                      >
                        {originalVerse.textDirection === 'rtl'
                          ? labels.hebrewAramaicOriginal
                          : labels.greekOriginal}
                      </Text>
                      <Text
                        selectable
                        style={[
                          styles.originalVerseText,
                          {
                            color: theme.colors.onSurface,
                            textAlign:
                              originalVerse.textDirection === 'rtl' ? 'right' : 'left',
                            writingDirection: originalVerse.textDirection,
                            fontFamily:
                              originalVerse.textDirection === 'rtl'
                                ? SCRIPTURE_FONT_FAMILIES.hebrew
                                : SCRIPTURE_FONT_FAMILIES.greek,
                          },
                        ]}
                      >
                        {originalVerse.text}
                      </Text>
                      {/*
                        Required CC BY 4.0 attribution for the original-language
                        edition. fetch(bible's free CDN access does not waive the
                        source edition's license. Do not remove this notice when
                        changing the popup; see README.md and the Bible design doc.
                      */}
                      <Text
                        variant="labelSmall"
                        style={[
                          styles.originalVerseAttribution,
                          { color: theme.colors.onSurfaceVariant },
                        ]}
                      >
                        {labels.source}: {originalVerse.edition}.{' '}
                        {originalVerse.attribution}
                      </Text>
                    </View>
                  ) : originalVerseError ? (
                    <View style={ReaderStyles.detailSection}>
                      <Text style={{ color: theme.colors.error }}>
                        {labels.originalUnavailable}
                      </Text>
                    </View>
                  ) : null}
                  <Divider style={{ marginBottom: 16 }} />
                  {/* 
                      Aggregated Verse Content:
                      We calculate the subtitle text first to identify and filter
                      redundant footnotes that repeat the same information.
                  */}
                  {(() => {
                    const subtitle = getAssociatedSubtitle(selectedVerseNum || 0);
                    const subtitleText = subtitle
                      ? subtitle.content
                          .map((item) =>
                            typeof item === 'string' ? item : (item as any).text || '',
                          )
                          .join('')
                          .trim()
                      : '';

                    // Hardcode exception: Subtitles for Psalms Verse 1 are already visible in-line.
                    const isPsalmVerseOne = book?.id === 'PSA' && selectedVerseNum === 1;

                    return (
                      <>
                        {subtitle && !isPsalmVerseOne && (
                          <View style={ReaderStyles.detailSection}>
                            <Text
                              variant="labelSmall"
                              style={{ color: theme.colors.tertiary, marginBottom: 4 }}
                            >
                              {labels.hebrewSubtitle}
                            </Text>
                            <Text
                              style={[ReaderStyles.detailText, { fontStyle: 'italic' }]}
                            >
                              {subtitleText}
                            </Text>
                          </View>
                        )}

                        {chapterData?.chapter.footnotes
                          .filter((f) => {
                            if (f.reference?.verse !== selectedVerseNum) return false;
                            // Filter duplicates
                            if (subtitleText && f.text.trim() === subtitleText)
                              return false;
                            return true;
                          })
                          .map((f, i) => (
                            <View key={`fn-${i}`} style={ReaderStyles.detailSection}>
                              <Text
                                variant="labelSmall"
                                style={{ color: theme.colors.primary, marginBottom: 4 }}
                              >
                                {labels.footnote} ({f.caller})
                              </Text>
                              <Text style={ReaderStyles.detailText}>{f.text}</Text>
                            </View>
                          ))}
                      </>
                    );
                  })()}
                </ScrollView>
                <View
                  style={[
                    styles.detailActions,
                    dockLayout.stackControls && styles.stackedDetailActions,
                  ]}
                >
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={
                      isVerseSaved(selectedVerseNum || 0)
                        ? labels.removeAction
                        : labels.saveAction
                    }
                    onPress={() => toggleSavedVerses([selectedVerseNum || 0])}
                    style={[
                      styles.detailActionButton,
                      styles.detailOutlinedAction,
                      dockLayout.stackControls && styles.stackedDetailActionButton,
                      { borderColor: theme.colors.outline },
                    ]}
                  >
                    <AppIcon
                      pointerEvents="none"
                      name={
                        isVerseSaved(selectedVerseNum || 0)
                          ? 'bookmark-remove'
                          : 'bookmark-plus'
                      }
                      size={22}
                      textScale={bibleUiTextScale}
                      color={theme.colors.primary}
                    />
                    <Text
                      style={[
                        styles.detailActionText,
                        { color: theme.colors.primary },
                      ]}
                    >
                      {isVerseSaved(selectedVerseNum || 0)
                        ? labels.removeAction
                        : labels.saveAction}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={labels.share}
                    onPress={handleShare}
                    style={[
                      styles.detailActionButton,
                      dockLayout.stackControls && styles.stackedDetailActionButton,
                      { backgroundColor: theme.colors.primary },
                    ]}
                  >
                    <AppIcon
                      pointerEvents="none"
                      name="share-variant"
                      size={22}
                      textScale={bibleUiTextScale}
                      color={theme.colors.onPrimary}
                    />
                    <Text
                      style={[
                        styles.detailActionText,
                        { color: theme.colors.onPrimary },
                      ]}
                    >
                      {labels.share}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text
                  variant="titleLarge"
                  style={[ReaderStyles.modalTitle, { color: theme.colors.onSurface }]}
                >
                  {lastActiveType === 'translation'
                    ? labels.translation
                    : lastActiveType === 'book'
                      ? labels.book
                      : lastActiveType === 'verse'
                        ? labels.verse
                        : labels.chapter}
                </Text>
                <Divider />
                <FlatList<
                  | (typeof BibleService.SUPPORTED_TRANSLATIONS)[number]
                  | BibleService.TranslationBook
                  | number
                >
                  data={
                    lastActiveType === 'translation'
                      ? BibleService.SUPPORTED_TRANSLATIONS
                      : lastActiveType === 'book'
                        ? books
                        : lastActiveType === 'verse'
                          ? Array.from(
                              { length: chapterData?.numberOfVerses || 0 },
                              (_, i) => i + 1,
                            )
                          : Array.from(
                              { length: book?.numberOfChapters || 0 },
                              (_, i) => i + 1,
                            )
                  }
                  keyExtractor={(item) =>
                    typeof item === 'object' ? item.id : item.toString()
                  }
                  renderItem={({ item }) => {
                    const itemLabel =
                      typeof item === 'object'
                        ? 'lang' in item
                          ? getTranslationLabel(item)
                          : item.name
                        : (lastActiveType === 'verse'
                            ? labels.verseItem
                            : labels.chapterItem
                          ).replace('{n}', item.toString());
                    const isSelectedItem =
                      (lastActiveType === 'translation' &&
                        typeof item === 'object' &&
                        item.id === supportedTranslation.id) ||
                      (lastActiveType === 'book' &&
                        typeof item === 'object' &&
                        item.id === book?.id) ||
                      (lastActiveType === 'chapter' && item === chapterNum);

                    return (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={itemLabel}
                      accessibilityState={{ selected: isSelectedItem }}
                      onPress={() => {
                        const changesChapter =
                          lastActiveType === 'translation' ||
                          lastActiveType === 'book' ||
                          lastActiveType === 'chapter';
                        // Keep audio playing only when the selection loads a new chapter.
                        if (isPlaying && changesChapter) {
                          setShouldAutoPlay(true);
                        }
                        if (lastActiveType === 'translation') {
                          handledTranslationParamSignature.current =
                            translationParamSignature;
                          setSupportedTranslation(item as any);
                        } else if (lastActiveType === 'book') {
                          setBook(item as any);
                          setChapterNum(1);
                        } else if (lastActiveType === 'chapter') {
                          setChapterNum(item as any);
                        } else if (lastActiveType === 'verse') {
                          const verseNumber = item as number;
                          setTimeout(() => {
                            const verseY = versePositions.current[verseNumber];
                            if (verseY !== undefined) {
                              scrollRef.current?.scrollTo({
                                y: Math.max(0, verseY - 20),
                                animated: true,
                              });
                            }
                          }, 250);
                        }
                        closeModal();
                      }}
                      style={styles.pressRow}
                    >
                      <Text
                        style={[
                          styles.pressRowText,
                          isSelectedItem
                            ? { color: theme.colors.primary, fontWeight: '700' }
                            : { color: theme.colors.onSurface },
                        ]}
                      >
                        {itemLabel}
                      </Text>
                      {isSelectedItem && (
                        <AppIcon
                          pointerEvents="none"
                          name="check"
                          size={24}
                          textScale={bibleUiTextScale}
                          color={theme.colors.primary}
                        />
                      )}
                    </TouchableOpacity>
                    );
                  }}
                />
              </>
            )}
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const createStyles = (textScale: TextScale, uiTextScale: TextScale) => StyleSheet.create({
  controlDockScroll: {
    flex: 1,
  },
  controlDockScrollContent: {
    flexGrow: 1,
  },
  compactAudioDock: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  compactAudioPlayButton: {
    margin: 0,
    minHeight: 48,
    minWidth: 48,
  },
  compactAudioDetails: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  compactAudioTitle: {
    fontSize: scaleTypographyMetric(14, uiTextScale),
    fontWeight: '700',
    lineHeight: scaleTypographyMetric(18, uiTextScale),
  },
  compactAudioTrack: {
    borderRadius: 2,
    height: 4,
    overflow: 'hidden',
    width: '100%',
  },
  compactAudioProgress: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  compactAudioExpandButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  verseDetailModalContent: {
    maxHeight: '94%',
    marginTop: 8,
    marginBottom: 8,
  },
  selectionBarInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
  },
  stackedSelectionBarInner: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  dockTextAction: {
    minHeight: 44,
    minWidth: 44,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dockContainedAction: {
    borderWidth: 0,
  },
  stackedDockTextAction: {
    width: '100%',
  },
  dockActionText: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: scaleTypographyMetric(14, uiTextScale),
    lineHeight: scaleTypographyMetric(20, uiTextScale),
    fontWeight: '700',
    textAlign: 'center',
  },
  stackedAudioControlRow: {
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  stackedAudioTimelineRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  stackedAudioScrubber: {
    flex: 0,
    width: '100%',
  },
  audioDurationText: {
    alignSelf: 'flex-end',
  },
  stackedDockInner: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  stackedPillsContainer: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
  },
  stackedPill: {
    width: '100%',
    paddingHorizontal: 12,
  },
  stackedNavigationRow: {
    minHeight: 52,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 16,
  },
  stackedDetailActions: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  detailActionButton: {
    flexGrow: 1,
    flexBasis: 140,
    minWidth: 0,
    minHeight: 44,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  detailOutlinedAction: {
    borderWidth: 1,
  },
  stackedDetailActionButton: {
    width: '100%',
    flexBasis: 'auto',
    flexGrow: 0,
  },
  detailActionText: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: scaleTypographyMetric(14, uiTextScale),
    lineHeight: scaleTypographyMetric(20, uiTextScale),
    fontWeight: '700',
    textAlign: 'center',
  },
  pressRow: {
    width: '100%',
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressRowText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: scaleTypographyMetric(16, uiTextScale),
    lineHeight: scaleTypographyMetric(22, uiTextScale),
  },
  savedVerseRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  savedVerseMainAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  savedVerseText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  savedVerseDescription: {
    flexShrink: 1,
    marginTop: 4,
    fontSize: scaleTypographyMetric(14, textScale),
    lineHeight: scaleTypographyMetric(20, textScale),
  },
  originalVerseStatus: {
    minHeight: 72,
    marginBottom: 16,
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  originalVerseText: {
    fontSize: scaleTypographyMetric(20, textScale),
    lineHeight: scaleTypographyMetric(32, textScale),
    marginBottom: 10,
  },
  originalVerseAttribution: {
    fontSize: scaleTypographyMetric(11, textScale),
    lineHeight: scaleTypographyMetric(16, textScale),
  },
  savedEmptyState: {
    minHeight: 180,
    padding: 24,
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
