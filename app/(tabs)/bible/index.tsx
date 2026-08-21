import { UIStateContext } from '@/components/GlobalHeader';
import { AppIcon } from '@/components/AppIcon';
import { WrappingButton as Button } from '@/components/WrappingButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import {
  activateBibleAudioLockScreen,
  buildBibleAudioQueue,
  configureBibleAudioPlayback,
  getBibleAudioMediaTitle,
  getBibleAudioSourceId,
  getBibleAudioSourceLabel,
  getOrderedBibleAudioReaders,
  prioritizeBibleAudioSource,
} from '@/services/BibleAudioService';
import {
  useBibleAudioPlayer,
  useBibleAudioPlayerStatus,
} from '@/services/BibleAudioPlayer';
import { loadBibleChapterWithRetry } from '@/services/BibleChapterLoader';
import {
  ANDROID_AUDIO_GUIDANCE_INTERRUPTION_THRESHOLD,
  getAndroidAppsSettingsIntent,
  getCurrentAndroidAudioBrowser,
} from '@/services/AndroidBackgroundAudioGuidance';
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
  getBulletinVerseScrollOffset,
  getBibleDockLayout,
  getBibleDockViewportLayout,
} from '@/styles/ReaderStyles';

const FOOTER_PADDING_GUTTER = 34;
const AUDIO_SOURCE_LOAD_TIMEOUT_MS = 12_000;
const AUDIO_QUEUE_CHAPTER_LIMIT = 24;

type SleepTimerSetting = 5 | 10 | 15 | 30 | 60 | 120 | 'chapter' | null;

const BIBLE_TRANS_KEY = BibleService.BIBLE_TRANSLATION_STORAGE_KEY;
const BIBLE_BOOK_KEY = 'user-bible-book';
const BIBLE_CHAPTER_KEY = 'user-bible-chapter';
const BIBLE_AUDIO_READERS_KEY = 'user-bible-audio-readers';
const BIBLE_AUDIO_SOURCES_KEY = 'user-bible-audio-sources';
const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;

const getAudioReaderLabel = (reader: string) =>
  reader
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
    .join(' ');

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
    audio: 'Audio',
    narrator: 'Narrator',
    chooseNarrator: 'Choose narrator',
    audioSettings: 'Audio settings',
    audioSource: 'Preferred source',
    automaticFallback: 'If this source is unavailable, the next source is tried automatically.',
    backgroundPlayback: 'Background playback on Android',
    backgroundPlaybackHelp: 'Fix interrupted background playback',
    backgroundAudioTitle: 'Experiencing interrupted audio?',
    backgroundAudioBody:
      'Android may pause browser audio after the screen locks. For more reliable playback, allow {browser} to use battery in the background.',
    backgroundAudioSteps:
      'Open Android Settings → Apps → {browser} → App battery usage (or Battery) → Allow background usage → Unrestricted. Setting names vary by phone.',
    backgroundAudioNetworkNote:
      'Adaptive Connectivity and automatic mobile-network switching do not need to be changed for this fix.',
    notNow: 'Not now',
    openBrowserSettings: 'Open Android app settings',
    settingsFallback: 'If Android does not open the browser settings, follow the steps above.',
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
    audio: '有聲書',
    narrator: '朗讀者',
    chooseNarrator: '選擇朗讀者',
    audioSettings: '有聲書設定',
    audioSource: '優先音源',
    automaticFallback: '如果此音源無法使用，將自動嘗試下一個音源。',
    backgroundPlayback: 'Android 背景播放',
    backgroundPlaybackHelp: '修正背景播放中斷',
    backgroundAudioTitle: '有聲聖經播放中斷嗎？',
    backgroundAudioBody:
      'Android 可能會在鎖定螢幕後暫停瀏覽器音訊。若要提高播放穩定性，請允許 {browser} 在背景使用電池。',
    backgroundAudioSteps:
      '開啟 Android「設定」→「應用程式」→「{browser}」→「應用程式耗電量」（或「電池」）→「允許背景使用」→「不受限制」。不同手機的名稱可能略有不同。',
    backgroundAudioNetworkNote:
      '此修正不需要更改「自動調整連線」或自動切換行動網路。',
    notNow: '稍後',
    openBrowserSettings: '開啟 Android 應用程式設定',
    settingsFallback: '如果 Android 沒有開啟瀏覽器設定，請依照上方步驟操作。',
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
    audio: '有声书',
    narrator: '朗读者',
    chooseNarrator: '选择朗读者',
    audioSettings: '有声书设置',
    audioSource: '优先音源',
    automaticFallback: '如果此音源无法使用，将自动尝试下一个音源。',
    backgroundPlayback: 'Android 后台播放',
    backgroundPlaybackHelp: '修复后台播放中断',
    backgroundAudioTitle: '有声圣经播放中断吗？',
    backgroundAudioBody:
      'Android 可能会在锁定屏幕后暂停浏览器音频。若要提高播放稳定性，请允许 {browser} 在后台使用电池。',
    backgroundAudioSteps:
      '打开 Android“设置”→“应用”→“{browser}”→“应用耗电量”（或“电池”）→“允许后台使用”→“不受限制”。不同手机的名称可能略有不同。',
    backgroundAudioNetworkNote:
      '此修复不需要更改“自适应连接”或自动切换移动网络。',
    notNow: '稍后',
    openBrowserSettings: '打开 Android 应用设置',
    settingsFallback: '如果 Android 没有打开浏览器设置，请按照上方步骤操作。',
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
    audio: 'Audio',
    narrator: 'Narrador',
    chooseNarrator: 'Elegir narrador',
    audioSettings: 'Ajustes de audio',
    audioSource: 'Fuente preferida',
    automaticFallback: 'Si esta fuente no está disponible, se probará la siguiente automáticamente.',
    backgroundPlayback: 'Reproducción en segundo plano en Android',
    backgroundPlaybackHelp: 'Corregir interrupciones en segundo plano',
    backgroundAudioTitle: '¿Se interrumpe el audio?',
    backgroundAudioBody:
      'Android puede pausar el audio del navegador al bloquear la pantalla. Para una reproducción más estable, permite que {browser} use la batería en segundo plano.',
    backgroundAudioSteps:
      'Abre Ajustes de Android → Aplicaciones → {browser} → Uso de batería de la aplicación (o Batería) → Permitir uso en segundo plano → Sin restricciones. Los nombres varían según el teléfono.',
    backgroundAudioNetworkNote:
      'No es necesario cambiar la Conectividad adaptativa ni el cambio automático a la red móvil.',
    notNow: 'Ahora no',
    openBrowserSettings: 'Abrir ajustes de aplicaciones',
    settingsFallback: 'Si Android no abre los ajustes del navegador, sigue los pasos anteriores.',
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

  const {
    bookId: paramBookId,
    chapter: paramChapter,
    translationId: paramTransId,
    verseStart: paramVerseStart,
    verseEnd: paramVerseEnd,
    referenceRequest: paramReferenceRequest,
    backTo: paramBackTo,
  } = useLocalSearchParams<{
    bookId?: string;
    chapter?: string;
    translationId?: string;
    verseStart?: string;
    verseEnd?: string;
    referenceRequest?: string;
    backTo?: string;
  }>();

  const labels = uiLabels[language as keyof typeof uiLabels] || uiLabels.en;
  const translationParamSignature = paramTransId
    ? `${paramTransId}:${paramBookId || ''}:${paramChapter || ''}:${
        paramReferenceRequest || ''
      }`
    : null;
  const scriptureParamSignature = paramBookId && paramChapter
    ? `${paramTransId || ''}:${paramBookId}:${paramChapter}:${paramVerseStart || ''}:${
        paramVerseEnd || ''
      }:${paramReferenceRequest || ''}`
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
  const handledScriptureParamSignature = useRef<string | null>(null);
  const pendingScriptureRange = useRef<{ start: number; end: number } | null>(null);

  // Data state
  const [books, setBooks] = useState<BibleService.TranslationBook[]>([]);
  const [chapterData, setChapterData] =
    useState<BibleService.TranslationBookChapter | null>(null);
  const [selectedAudioReaders, setSelectedAudioReaders] = useState<
    Record<string, string>
  >({});
  const [selectedAudioSources, setSelectedAudioSources] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(false);
  const [chapterReloadToken, setChapterReloadToken] = useState(0);
  const chapterLoadAttemptRef = useRef(0);
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

  useEffect(() => {
    if (isSelectionActive) setGlobalMenuVisible(true);
  }, [isSelectionActive, setGlobalMenuVisible]);

  // Load selection from storage on mount
  useEffect(() => {
    const loadSelection = async () => {
      try {
        const [
          savedTransId,
          savedBookId,
          savedChap,
          savedAudioReaders,
          savedAudioSources,
          storedVerses,
        ] =
          await Promise.all([
            AsyncStorage.getItem(BIBLE_TRANS_KEY),
            AsyncStorage.getItem(BIBLE_BOOK_KEY),
            AsyncStorage.getItem(BIBLE_CHAPTER_KEY),
            AsyncStorage.getItem(BIBLE_AUDIO_READERS_KEY),
            AsyncStorage.getItem(BIBLE_AUDIO_SOURCES_KEY),
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
        if (savedAudioReaders) {
          const parsedAudioReaders = JSON.parse(savedAudioReaders);
          if (
            parsedAudioReaders &&
            typeof parsedAudioReaders === 'object' &&
            !Array.isArray(parsedAudioReaders)
          ) {
            setSelectedAudioReaders(parsedAudioReaders);
          }
        }
        if (savedAudioSources) {
          const parsedAudioSources = JSON.parse(savedAudioSources);
          if (
            parsedAudioSources &&
            typeof parsedAudioSources === 'object' &&
            !Array.isArray(parsedAudioSources)
          ) {
            setSelectedAudioSources(parsedAudioSources);
          }
        }
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

  useEffect(() => {
    if (!isPersistenceLoaded) return;
    AsyncStorage.setItem(
      BIBLE_AUDIO_READERS_KEY,
      JSON.stringify(selectedAudioReaders),
    ).catch((e) => console.error('Failed to save Bible audio narrator:', e));
  }, [isPersistenceLoaded, selectedAudioReaders]);

  useEffect(() => {
    if (!isPersistenceLoaded) return;
    AsyncStorage.setItem(
      BIBLE_AUDIO_SOURCES_KEY,
      JSON.stringify(selectedAudioSources),
    ).catch((e) => console.error('Failed to save Bible audio source:', e));
  }, [isPersistenceLoaded, selectedAudioSources]);

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
    paramReferenceRequest,
    isPersistenceLoaded,
    books,
  ]);

  useEffect(() => {
    if (
      !isPersistenceLoaded ||
      !scriptureParamSignature ||
      handledScriptureParamSignature.current === scriptureParamSignature
    ) {
      return;
    }

    handledScriptureParamSignature.current = scriptureParamSignature;
    const start = Number(paramVerseStart);
    const requestedEnd = Number(paramVerseEnd);
    if (!Number.isInteger(start) || start < 1) {
      pendingScriptureRange.current = null;
      return;
    }

    pendingScriptureRange.current = {
      start,
      end:
        Number.isInteger(requestedEnd) && requestedEnd >= start ? requestedEnd : start,
    };
  }, [
    isPersistenceLoaded,
    scriptureParamSignature,
    paramVerseStart,
    paramVerseEnd,
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
  const [audioSettingsVisible, setAudioSettingsVisible] = useState(false);
  const [backgroundAudioGuidanceVisible, setBackgroundAudioGuidanceVisible] =
    useState(false);
  const [scrubPositionMillis, setScrubPositionMillis] = useState<number | null>(null);
  const audioPlayer = useBibleAudioPlayer(null, { updateInterval: 250 });
  const audioStatus = useBibleAudioPlayerStatus(audioPlayer);
  const loadedAudioUrlRef = useRef<string | null>(null);
  const audioLoadAttemptRef = useRef(0);
  const preserveAudioOnNextRouteChangeRef = useRef(false);
  const lastSyncedAudioChapterRef = useRef<string | null>(null);
  const audioFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isScrubbingRef = useRef(false);
  const audioScrubberWidth = useRef(1);
  const sleepTimerSettingRef = useRef<SleepTimerSetting>(null);
  const sleepTimerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundAudioGuidanceCheckedRef = useRef(false);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);
  const androidAudioBrowser = useMemo(
    () => getCurrentAndroidAudioBrowser(),
    [],
  );
  const androidAudioBrowserName = androidAudioBrowser?.name || null;
  const chapterAudioLinks = chapterData?.thisChapterAudioLinks;
  // Ordering the URLs is metadata-only. The selected recording is still sent
  // to the playback engine only after the user presses Play.
  const audioReaderEntries = getOrderedBibleAudioReaders(
    supportedTranslation.id,
    chapterAudioLinks,
  );
  const savedAudioReader = selectedAudioReaders[supportedTranslation.id];
  const selectedAudioReader = chapterAudioLinks?.[savedAudioReader]
    ? savedAudioReader
    : audioReaderEntries[0]?.[0];
  const selectedAudioSource = selectedAudioReader
    ? chapterAudioLinks?.[selectedAudioReader]
    : undefined;
  const rawSelectedAudioUrls = selectedAudioSource
    ? Array.isArray(selectedAudioSource)
      ? selectedAudioSource
      : [selectedAudioSource]
    : [];
  const audioSourcePreferenceKey = `${supportedTranslation.id}:${
    selectedAudioReader || 'default'
  }`;
  const availableAudioSources = rawSelectedAudioUrls.filter(
    (url, index, urls) =>
      urls.findIndex(
        (candidate) =>
          getBibleAudioSourceId(candidate) === getBibleAudioSourceId(url),
      ) === index,
  );
  const savedAudioSource = selectedAudioSources[audioSourcePreferenceKey];
  const selectedAudioSourceId = availableAudioSources.some(
    (url) => getBibleAudioSourceId(url) === savedAudioSource,
  )
    ? savedAudioSource
    : availableAudioSources[0]
      ? getBibleAudioSourceId(availableAudioSources[0])
      : undefined;
  const selectedAudioUrls = prioritizeBibleAudioSource(
    rawSelectedAudioUrls,
    selectedAudioSourceId,
  );
  const selectedAudioUrlsRef = useRef(selectedAudioUrls);
  selectedAudioUrlsRef.current = selectedAudioUrls;

  const buildUpcomingAudioQueue = () =>
    buildBibleAudioQueue({
      albumTitle: labels.audioPlayer,
      artist: selectedAudioReader
        ? `${supportedTranslation.name} • ${getAudioReaderLabel(selectedAudioReader)}`
        : supportedTranslation.name,
      books,
      currentBookId: book?.id || '',
      currentChapter: chapterNum,
      limit: AUDIO_QUEUE_CHAPTER_LIMIT,
      preferredSourceId: selectedAudioSourceId,
      selectedAudioUrls,
      selectedReader: selectedAudioReader,
      translationId: supportedTranslation.id,
      translationLabel: supportedTranslation.name,
    });

  const clearAudioFallbackTimeout = () => {
    if (audioFallbackTimeoutRef.current) {
      clearTimeout(audioFallbackTimeoutRef.current);
      audioFallbackTimeoutRef.current = null;
    }
  };

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

    if (setting === 'chapter') {
      audioPlayer.setQueue?.([]);
    } else if (loadedAudioUrlRef.current) {
      audioPlayer.setQueue?.(buildUpcomingAudioQueue());
    }

    if (typeof setting === 'number') {
      sleepTimerTimeoutRef.current = setTimeout(() => {
        setShouldAutoPlay(false);
        try {
          audioPlayer.pause();
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

  useEffect(() => {
    const positionMillis = audioStatus.currentTime * 1000;
    const currentPlayerStatus = audioPlayer.currentStatus;
    const isCurrentSourceReady =
      currentPlayerStatus.isLoaded && currentPlayerStatus.duration > 0;
    setIsAudioLoading(
      loadedAudioUrlRef.current !== null &&
        (!isCurrentSourceReady ||
          audioStatus.isBuffering ||
          !!audioStatus.loadError),
    );
    setIsPlaying(audioStatus.playing);
    setAudioDurationMillis(audioStatus.duration * 1000);
    setAudioBufferedMillis(positionMillis);
    if (!isScrubbingRef.current) {
      setAudioPositionMillis(positionMillis);
    }
    if (isCurrentSourceReady) clearAudioFallbackTimeout();

    if (audioStatus.didJustFinish) {
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
  }, [audioStatus, isLastChapter]);

  // A queued audio transition can happen while React is throttled in the
  // background. Once the PWA is visible, catch the reader up to the chapter
  // already chosen by the audio engine and fetch its text normally.
  useEffect(() => {
    const activeChapter = audioStatus.activeChapter;
    if (!activeChapter || activeChapter.translationId !== supportedTranslation.id) {
      lastSyncedAudioChapterRef.current = null;
      return;
    }

    const syncVisibleChapter = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      const activeKey = `${activeChapter.translationId}:${activeChapter.bookId}:${activeChapter.chapter}`;
      if (lastSyncedAudioChapterRef.current === activeKey) return;
      if (book?.id === activeChapter.bookId && chapterNum === activeChapter.chapter) {
        lastSyncedAudioChapterRef.current = activeKey;
        return;
      }

      const activeBook = books.find(
        (candidate) => candidate.id === activeChapter.bookId,
      );
      if (!activeBook) return;

      lastSyncedAudioChapterRef.current = activeKey;
      preserveAudioOnNextRouteChangeRef.current = true;
      setBook(activeBook);
      setChapterNum(activeChapter.chapter);
    };

    syncVisibleChapter();
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', syncVisibleChapter);
    return () =>
      document.removeEventListener('visibilitychange', syncVisibleChapter);
  }, [
    audioStatus.activeChapter?.translationId,
    audioStatus.activeChapter?.bookId,
    audioStatus.activeChapter?.chapter,
    supportedTranslation.id,
    book?.id,
    chapterNum,
    books,
  ]);

  const loadAudioSource = async (
    sourceIndex: number,
    resumePositionMillis = 0,
  ): Promise<void> => {
    const audioUrls = selectedAudioUrlsRef.current;
    const audioUrl = audioUrls[sourceIndex];
    if (!audioUrl) {
      clearAudioFallbackTimeout();
      loadedAudioUrlRef.current = null;
      setIsAudioLoading(false);
      console.error('Bible audio unavailable: every configured host failed.');
      return;
    }

    const attempt = ++audioLoadAttemptRef.current;
    clearAudioFallbackTimeout();

    try {
      setIsAudioLoading(true);
      loadedAudioUrlRef.current = audioUrl;
      const audioTitle = getBibleAudioMediaTitle(
        `${book?.name || labels.bible} ${chapterNum}`,
        supportedTranslation.name,
        audioUrl,
      );
      audioPlayer.replace({
        uri: audioUrl,
        name: audioTitle,
      });
      audioPlayer.setPlaybackRate(playbackRate, 'high');
      activateBibleAudioLockScreen(audioPlayer, {
        title: audioTitle,
        artist: selectedAudioReader
          ? `${supportedTranslation.name} • ${getAudioReaderLabel(selectedAudioReader)}`
          : supportedTranslation.name,
        albumTitle: labels.audioPlayer,
      });
      // Queueing is on demand: descriptors are created only after Play, and
      // the web player assigns a URL only to the immediate next chapter.
      audioPlayer.setQueue?.(buildUpcomingAudioQueue());
      if (resumePositionMillis > 0) {
        await audioPlayer.seekTo(resumePositionMillis / 1000);
      }
      audioPlayer.play();

      audioFallbackTimeoutRef.current = setTimeout(() => {
        if (
          attempt !== audioLoadAttemptRef.current ||
          (audioPlayer.currentStatus.isLoaded &&
            audioPlayer.currentStatus.duration > 0)
        ) {
          return;
        }

        if (sourceIndex + 1 < audioUrls.length) {
          console.warn(
            `Bible audio host failed to load; trying fallback ${sourceIndex + 2}/${audioUrls.length}.`,
          );
        }
        loadAudioSource(sourceIndex + 1, resumePositionMillis);
      }, AUDIO_SOURCE_LOAD_TIMEOUT_MS);
    } catch (e) {
      console.warn('Bible audio host failed; trying the next fallback.', e);
      await loadAudioSource(sourceIndex + 1, resumePositionMillis);
    }
  };

  const startAudio = async () => {
    if (selectedAudioUrlsRef.current.length === 0) return;
    try {
      await configureBibleAudioPlayback();
      if (!loadedAudioUrlRef.current) {
        await loadAudioSource(0);
      } else {
        audioPlayer.play();
      }
    } catch (e) {
      setIsAudioLoading(false);
      console.error('Audio playback error:', e);
    }
  };

  const offerBackgroundAudioGuidance = () => {
    if (
      !androidAudioBrowserName ||
      backgroundAudioGuidanceCheckedRef.current
    ) {
      return;
    }
    backgroundAudioGuidanceCheckedRef.current = true;
    setBackgroundAudioGuidanceVisible(true);
  };

  const openBackgroundAudioGuidance = () => {
    setAudioSettingsVisible(false);
    setBackgroundAudioGuidanceVisible(true);
  };

  const openAndroidBackgroundSettings = () => {
    if (!androidAudioBrowser || typeof window === 'undefined') return;
    window.location.assign(getAndroidAppsSettingsIntent());
  };

  const toggleAudio = async () => {
    if (isPlaying) {
      clearAudioFallbackTimeout();
      audioLoadAttemptRef.current += 1;
      audioPlayer.pause();
      return;
    }

    await startAudio();
  };

  useEffect(() => {
    if (
      (audioStatus.interruptionCount || 0) >=
      ANDROID_AUDIO_GUIDANCE_INTERRUPTION_THRESHOLD
    ) {
      offerBackgroundAudioGuidance();
    }
  }, [audioStatus.interruptionCount, androidAudioBrowserName]);

  const unloadAudio = () => {
    clearAudioFallbackTimeout();
    audioLoadAttemptRef.current += 1;
    audioPlayer.pause();
    audioPlayer.clearLockScreenControls();
    audioPlayer.replace(null);
    loadedAudioUrlRef.current = null;
    isScrubbingRef.current = false;
    setIsPlaying(false);
    setIsAudioLoading(false);
    setAudioPositionMillis(0);
    setAudioDurationMillis(0);
    setAudioBufferedMillis(0);
    setScrubPositionMillis(null);
  };

  const selectAudioReader = (reader: string) => {
    if (reader === selectedAudioReader) return;

    unloadAudio();
    setSelectedAudioReaders((current) => ({
      ...current,
      [supportedTranslation.id]: reader,
    }));
  };

  const selectAudioSource = (sourceUrl: string) => {
    const sourceId = getBibleAudioSourceId(sourceUrl);
    if (sourceId === selectedAudioSourceId) return;

    unloadAudio();
    setSelectedAudioSources((current) => ({
      ...current,
      [audioSourcePreferenceKey]: sourceId,
    }));
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
      await audioPlayer.seekTo(clampedPosition / 1000);
    } catch (e) {
      console.error('Audio seek error:', e);
    }
  };

  const skipAudio = (offsetMillis: number) => {
    seekAudio(audioPositionMillis + offsetMillis);
  };

  const selectPlaybackRate = async (nextRate: number) => {
    setPlaybackRate(nextRate);
    try {
      audioPlayer.setPlaybackRate(nextRate, 'high');
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
    const autoPlayNext = () => {
      setShouldAutoPlay(false);
      // Chapter completion must start playback explicitly. Reusing the toggle
      // can observe the previous chapter's final `playing` status and pause the
      // newly loaded chapter instead. Avoid a timer here because browsers may
      // throttle it as soon as an installed PWA moves to the background.
      void startAudio();
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
    const activeChapter = audioStatus.activeChapter;
    if (
      !loadedAudioUrlRef.current ||
      !activeChapter ||
      !chapterData ||
      chapterData.translation.id !== activeChapter.translationId ||
      chapterData.book.id !== activeChapter.bookId ||
      chapterData.chapter.number !== activeChapter.chapter
    ) {
      return;
    }

    audioPlayer.setQueue?.(buildUpcomingAudioQueue());
  }, [chapterData, audioStatus.activeChapter]);

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
      const attempt = ++chapterLoadAttemptRef.current;
      let cancelled = false;
      const loadChapter = async () => {
        setLoading(true);
        setChapterData(null); // Clear old content immediately
        try {
          const data = await loadBibleChapterWithRetry(
            supportedTranslation.id,
            book.id,
            chapterNum,
          );
          if (!cancelled && attempt === chapterLoadAttemptRef.current) {
            setChapterData(data);
          }
        } catch (e) {
          if (!cancelled && attempt === chapterLoadAttemptRef.current) {
            console.error('Error loading chapter:', e);
          }
        } finally {
          if (!cancelled && attempt === chapterLoadAttemptRef.current) {
            setLoading(false);
          }
        }
      };
      void loadChapter();
      return () => {
        cancelled = true;
      };
    }
  }, [
    supportedTranslation.id,
    book?.id,
    chapterNum,
    books,
    isPersistenceLoaded,
    chapterReloadToken,
  ]);

  // Android can suspend an in-flight media or scripture request while the PWA
  // is locked. Retry the selected chapter and an unready audio element as soon
  // as the document is usable again, without requiring prev/next navigation.
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const recoverInterruptedLoads = () => {
      if (document.visibilityState === 'hidden') return;
      const chapterMatchesSelection =
        chapterData?.translation.id === supportedTranslation.id &&
        chapterData?.book.id === book?.id &&
        chapterData?.chapter.number === chapterNum;

      if (loading || !chapterMatchesSelection) {
        setChapterReloadToken((current) => current + 1);
      }
      if (isAudioLoading && !audioStatus.playing) {
        audioPlayer.play();
      }
    };

    document.addEventListener('visibilitychange', recoverInterruptedLoads);
    window.addEventListener('online', recoverInterruptedLoads);
    return () => {
      document.removeEventListener('visibilitychange', recoverInterruptedLoads);
      window.removeEventListener('online', recoverInterruptedLoads);
    };
  }, [
    loading,
    chapterData,
    supportedTranslation.id,
    book?.id,
    chapterNum,
    isAudioLoading,
    audioStatus.playing,
    audioPlayer,
  ]);

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
  const navigateToChapter = (
    direction: 'prev' | 'next',
    sourceBookId = book?.id,
    sourceChapter = chapterNum,
  ) => {
    if (!sourceBookId || books.length === 0) return;
    const currentBookIdx = books.findIndex(
      (candidate: BibleService.TranslationBook) => candidate.id === sourceBookId,
    );
    if (currentBookIdx === -1) return;
    const sourceBook = books[currentBookIdx];

    if (isPlaying) {
      setShouldAutoPlay(true);
    }

    if (direction === 'next') {
      if (sourceChapter < sourceBook.numberOfChapters) {
        setBook(sourceBook);
        setChapterNum(sourceChapter + 1);
      } else if (currentBookIdx < books.length - 1) {
        const nextBook = books[currentBookIdx + 1];
        setBook(nextBook);
        setChapterNum(1);
      }
    } else {
      if (sourceChapter > 1) {
        setBook(sourceBook);
        setChapterNum(sourceChapter - 1);
      } else if (currentBookIdx > 0) {
        const prevBook = books[currentBookIdx - 1];
        setBook(prevBook);
        setChapterNum(prevBook.numberOfChapters);
      }
    }
  };

  useEffect(() => {
    audioPlayer.setRemoteChapterHandlers?.({
      onNext: (activeChapter) => {
        setShouldAutoPlay(true);
        navigateToChapter(
          'next',
          activeChapter?.bookId,
          activeChapter?.chapter,
        );
      },
      onPrevious: (activeChapter) => {
        setShouldAutoPlay(true);
        navigateToChapter(
          'prev',
          activeChapter?.bookId,
          activeChapter?.chapter,
        );
      },
    });
    return () => audioPlayer.setRemoteChapterHandlers?.();
  }, [
    audioPlayer,
    isPlaying,
    book?.id,
    chapterNum,
    books,
  ]);

  /** Hides the surrounding app chrome while keeping Bible controls visible. */
  const handleScroll = (event: any) => {
    if (isSelectionActive) return;
    const currentOffset = event.nativeEvent.contentOffset.y;
    if (currentOffset < 0) return;

    if (Math.abs(currentOffset - lastScrollY.current) > 15) {
      if (currentOffset > lastScrollY.current && currentOffset > 100) {
        setGlobalMenuVisible(false);
      } else {
        setGlobalMenuVisible(true);
      }
      lastScrollY.current = currentOffset;
    }
  };

  // Scroll to top when chapter content changes
  useEffect(() => {
    // Restore the surrounding app chrome on mount or chapter change.
    setGlobalMenuVisible(true);

    if (chapterData) {
      clearSelection();
      versePositions.current = {}; // Clear previous chapter positions

      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }

    return () => {
      // Always restore menus when leaving the reader.
      setGlobalMenuVisible(true);
    };
  }, [chapterData, setGlobalMenuVisible]);

  // Playback follows the selected route, not the lifecycle of its text request.
  // A queued transition changes the route after audio has already advanced, so
  // exactly that route cleanup is skipped.
  useEffect(() => {
    return () => {
      if (preserveAudioOnNextRouteChangeRef.current) {
        preserveAudioOnNextRouteChangeRef.current = false;
        return;
      }
      unloadAudio();
    };
  }, [supportedTranslation.id, book?.id, chapterNum]);

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

  useEffect(() => {
    const range = pendingScriptureRange.current;
    if (
      !chapterData ||
      !range ||
      chapterData.book.id !== paramBookId ||
      chapterData.chapter.number !== Number(paramChapter) ||
      chapterData.translation.id !== paramTransId
    ) {
      return;
    }

    const targetVerse = chapterData.chapter.content.find(
      (content): content is BibleService.ChapterVerse =>
        content.type === 'verse' && content.number === range.start,
    );

    if (!targetVerse) {
      pendingScriptureRange.current = null;
      return;
    }

    const timeout = setTimeout(() => {
      const verseY = versePositions.current[targetVerse.number];
      if (verseY !== undefined) {
        const scrollY =
          paramBackTo === '/home/bulletin'
            ? getBulletinVerseScrollOffset(verseY, viewportHeight)
            : Math.max(0, verseY - 20);
        scrollRef.current?.scrollTo({ y: scrollY, animated: true });
      }
      pendingScriptureRange.current = null;
    }, 250);

    return () => clearTimeout(timeout);
  }, [
    chapterData,
    scriptureParamSignature,
    paramBookId,
    paramChapter,
    paramTransId,
    paramBackTo,
    viewportHeight,
  ]);

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
                        textDecorationColor:
                          theme.colors.readerColors.footnoteIndicator,
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
                textDecorationColor: theme.colors.readerColors.footnoteIndicator,
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

  const hasChapterAudio = audioReaderEntries.length > 0;
  const dockExtraHeight =
    (hasChapterAudio ? dockLayout.audioDockHeight : 0) +
    (isSelectionActive ? dockLayout.selectionBarHeight : 0);
  const fullDockContentHeight = dockLayout.dockHeight + dockExtraHeight;
  const dockViewportLayout = getBibleDockViewportLayout({
    bottomInset: bottomDockInset,
    bottomTabHeight: bottomTabContentHeight,
    contentHeight: fullDockContentHeight,
    headerHeight,
    hiddenContentHeight: fullDockContentHeight,
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
        <Text
          pointerEvents="none"
          numberOfLines={1}
          ellipsizeMode="tail"
          style={ReaderStyles.pillText}
        >
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

  const renderChapterNavigationDock = () => (
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
            <View style={ReaderStyles.sideSlot}>{renderPreviousChapterButton()}</View>
            <View style={ReaderStyles.sideSlot}>{renderNextChapterButton()}</View>
          </View>
        </>
      ) : (
        <>
          <View style={ReaderStyles.sideSlot}>{renderPreviousChapterButton()}</View>
          {renderChapterSelectors()}
          <View style={ReaderStyles.sideSlot}>{renderNextChapterButton()}</View>
        </>
      )}
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
                onPress={() => setAudioSettingsVisible(true)}
                accessibilityRole="button"
                accessibilityLabel={`${labels.audioSettings}: ${playbackRate}×`}
                accessibilityHint={`${labels.narrator}, ${labels.playbackSpeed}, ${labels.audioSource}`}
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
                <AppIcon
                  pointerEvents="none"
                  name="tune-variant"
                  size={13}
                  textScale={bibleUiTextScale}
                  color={theme.colors.onSurfaceVariant}
                />
              </TouchableOpacity>

              <View style={ReaderStyles.audioTransportControls}>
                <IconButton
                  icon="rewind-10"
                  size={scaleTypographyMetric(26, bibleUiTextScale)}
                  onPress={() => skipAudio(-10000)}
                  disabled={!loadedAudioUrlRef.current || !audioDurationMillis}
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
                  disabled={isAudioLoading && !loadedAudioUrlRef.current}
                  accessibilityLabel={labels.audioPlayer}
                  style={ReaderStyles.audioPlayButton}
                />
                <IconButton
                  icon="fast-forward-30"
                  size={scaleTypographyMetric(26, bibleUiTextScale)}
                  onPress={() => skipAudio(30000)}
                  disabled={!loadedAudioUrlRef.current || !audioDurationMillis}
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
                  !dockLayout.stackControls && ReaderStyles.audioElapsedTimeText,
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

        {renderChapterNavigationDock()}
        <Animated.View style={{ height: animatedDockBottomClearance }} />
        </ScrollView>
      </Animated.View>

      <Portal>
        <Modal
          visible={audioSettingsVisible}
          onDismiss={() => setAudioSettingsVisible(false)}
          contentContainerStyle={[
            ReaderStyles.audioSettingsContent,
            { marginBottom: bottomDockInset + 12 },
            { backgroundColor: theme.colors.background },
          ]}
        >
          <View style={ReaderStyles.modalInner}>
            <Text
              variant="titleLarge"
              style={[ReaderStyles.modalTitle, { color: theme.colors.onSurface }]}
            >
              {labels.audioSettings}
            </Text>
            <Divider />
            <ScrollView>
              <Text
                variant="titleMedium"
                style={[styles.audioSettingsSectionTitle, { color: theme.colors.onSurface }]}
              >
                {labels.playbackSpeed}: {playbackRate}×
              </Text>
              <View style={styles.audioSettingsRateRow}>
                {PLAYBACK_RATES.map((rate) => {
                  const isSelected = rate === playbackRate;
                  return (
                    <TouchableOpacity
                      key={rate}
                      accessibilityRole="button"
                      accessibilityLabel={`${labels.playbackSpeed}: ${rate}×`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => selectPlaybackRate(rate)}
                      style={[
                        styles.audioSettingsRate,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.primaryContainer
                            : theme.colors.surfaceVariant,
                          borderColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.outlineVariant,
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                    >
                      {isSelected && (
                        <AppIcon
                          pointerEvents="none"
                          name="check-circle"
                          size={16}
                          textScale={bibleUiTextScale}
                          color={theme.colors.onPrimaryContainer}
                        />
                      )}
                      <Text
                        style={{
                          color: isSelected
                            ? theme.colors.onPrimaryContainer
                            : theme.colors.onSurfaceVariant,
                          fontWeight: isSelected ? '700' : '600',
                        }}
                      >
                        {rate}×
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Divider style={styles.audioSettingsDivider} />
              <Text
                variant="titleMedium"
                style={[styles.audioSettingsSectionTitle, { color: theme.colors.onSurface }]}
              >
                {labels.narrator}
              </Text>
              {audioReaderEntries.map(([reader]) => {
                const isSelected = reader === selectedAudioReader;
                const readerLabel = getAudioReaderLabel(reader);
                return (
                  <TouchableOpacity
                    key={reader}
                    accessibilityRole="button"
                    accessibilityLabel={readerLabel}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => selectAudioReader(reader)}
                    style={styles.pressRow}
                  >
                    <AppIcon
                      pointerEvents="none"
                      name="account-voice"
                      size={24}
                      textScale={bibleUiTextScale}
                      color={theme.colors.onSurfaceVariant}
                    />
                    <Text
                      style={[
                        styles.pressRowText,
                        isSelected
                          ? { color: theme.colors.primary, fontWeight: '700' }
                          : { color: theme.colors.onSurface },
                      ]}
                    >
                      {readerLabel}
                    </Text>
                    {isSelected && (
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
              })}

              {availableAudioSources.length > 0 && (
                <>
                  <Divider style={styles.audioSettingsDivider} />
                  <Text
                    variant="titleMedium"
                    style={[styles.audioSettingsSectionTitle, { color: theme.colors.onSurface }]}
                  >
                    {labels.audioSource}
                  </Text>
                  {availableAudioSources.map((sourceUrl) => {
                    const sourceId = getBibleAudioSourceId(sourceUrl);
                    const isSelected = sourceId === selectedAudioSourceId;
                    return (
                      <TouchableOpacity
                        key={sourceId}
                        accessibilityRole="button"
                        accessibilityLabel={getBibleAudioSourceLabel(sourceUrl)}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => selectAudioSource(sourceUrl)}
                        style={styles.pressRow}
                      >
                        <AppIcon
                          pointerEvents="none"
                          name="server-network"
                          size={24}
                          textScale={bibleUiTextScale}
                          color={theme.colors.onSurfaceVariant}
                        />
                        <Text
                          style={[
                            styles.pressRowText,
                            isSelected
                              ? { color: theme.colors.primary, fontWeight: '700' }
                              : { color: theme.colors.onSurface },
                          ]}
                        >
                          {getBibleAudioSourceLabel(sourceUrl)}
                        </Text>
                        {isSelected && (
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
                  })}
                  {availableAudioSources.length > 1 && (
                    <Text
                      style={[
                        styles.audioSettingsHelper,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      {labels.automaticFallback}
                    </Text>
                  )}
                </>
              )}
              {androidAudioBrowserName && (
                <>
                  <Divider style={styles.audioSettingsDivider} />
                  <Text
                    variant="titleMedium"
                    style={[
                      styles.audioSettingsSectionTitle,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    {labels.backgroundPlayback}
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={labels.backgroundPlaybackHelp}
                    onPress={openBackgroundAudioGuidance}
                    style={styles.pressRow}
                  >
                    <AppIcon
                      pointerEvents="none"
                      name="battery-lock-open"
                      size={24}
                      textScale={bibleUiTextScale}
                      color={theme.colors.onSurfaceVariant}
                    />
                    <Text
                      style={[
                        styles.pressRowText,
                        { color: theme.colors.onSurface },
                      ]}
                    >
                      {labels.backgroundPlaybackHelp}
                    </Text>
                    <AppIcon
                      pointerEvents="none"
                      name="chevron-right"
                      size={24}
                      textScale={bibleUiTextScale}
                      color={theme.colors.onSurfaceVariant}
                    />
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </Modal>
      </Portal>

      <Portal>
        <Modal
          visible={backgroundAudioGuidanceVisible}
          onDismiss={() => setBackgroundAudioGuidanceVisible(false)}
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
              {labels.backgroundAudioTitle}
            </Text>
            <Divider />
            <ScrollView contentContainerStyle={styles.backgroundAudioGuidanceBody}>
              <Text
                variant="bodyLarge"
                style={{ color: theme.colors.onSurface }}
              >
                {labels.backgroundAudioBody.replace(
                  '{browser}',
                  androidAudioBrowserName || 'browser',
                )}
              </Text>
              <Text
                variant="bodyMedium"
                style={[
                  styles.backgroundAudioGuidanceSteps,
                  {
                    color: theme.colors.onPrimaryContainer,
                    backgroundColor: theme.colors.primaryContainer,
                  },
                ]}
              >
                {labels.backgroundAudioSteps.replace(
                  '{browser}',
                  androidAudioBrowserName || 'browser',
                )}
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {labels.backgroundAudioNetworkNote}
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {labels.settingsFallback}
              </Text>
            </ScrollView>
            <View style={styles.backgroundAudioGuidanceActions}>
              <Button
                mode="outlined"
                onPress={() => setBackgroundAudioGuidanceVisible(false)}
                style={styles.backgroundAudioGuidanceAction}
              >
                {labels.notNow}
              </Button>
              <Button
                mode="contained"
                icon="open-in-new"
                onPress={openAndroidBackgroundSettings}
                style={styles.backgroundAudioGuidanceAction}
              >
                {labels.openBrowserSettings}
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>

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
  audioSettingsSectionTitle: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
    fontWeight: '700',
  },
  audioSettingsRateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  audioSettingsRate: {
    minWidth: 52,
    minHeight: 44,
    borderRadius: 22,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  audioSettingsDivider: {
    marginTop: 8,
  },
  audioSettingsHelper: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 14,
    fontSize: scaleTypographyMetric(13, uiTextScale),
    lineHeight: scaleTypographyMetric(18, uiTextScale),
  },
  backgroundAudioGuidanceBody: {
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  backgroundAudioGuidanceSteps: {
    borderRadius: 12,
    fontSize: scaleTypographyMetric(15, uiTextScale),
    lineHeight: scaleTypographyMetric(22, uiTextScale),
    padding: 14,
  },
  backgroundAudioGuidanceActions: {
    alignItems: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backgroundAudioGuidanceAction: {
    flexGrow: 1,
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
