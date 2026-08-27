import { EgwEditionDialog } from '@/components/EgwEditionDialog';
import { MenuCard } from '@/components/MenuCard';
import { TitleHero } from '@/components/TitleHero';
import {
  LibraryBookCard,
  shouldUseLibraryListLayout,
} from '@/components/LibraryBookCard';
import { scaleTypographyMetric } from '@/constants/AppPreferences';
import {
  CHURCH_BUILDING_IMAGE_URL,
  openURL,
} from '@/constants/ExternalLinks';
import { LanguageContext, type SupportedLanguage } from '@/constants/LanguageContext';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import { EGW_BOOKS } from '@/features/library/EgwBookCatalog';
import {
  fetchChineseLibraryCoverUrls,
  shouldLoadChineseLibraryCovers,
  type ChineseLibraryCoverUrls,
} from '@/features/library/ChineseLibrary';
import { getLibraryItemsForLanguage } from '@/features/library/LibraryCatalog';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useContext, useEffect, useMemo, useState } from 'react';
import {
  type ImageSourcePropType,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { List, Text } from 'react-native-paper';

const allLabels = {
  en: {
    title: 'Library',
    egwAuthor: 'Ellen G. White',
    chooseEdition: 'Choose an edition. Your app language is listed first. The official text reader remembers its own font and theme settings.',
    opensOfficial: 'Opens the official EGW Writings text edition',
    egwOpenError: 'Could not open this EGW Writings book.',
    close: 'Close',
    adventistWritings: 'Adventist writings',
    classics: 'Christian classics',
    chooseBook: 'Choose this book and its language edition',
    opensGutenberg: 'Opens externally on Project Gutenberg',
    openError: 'Could not open this library source.',
  },
  zh: {
    title: '圖書館',
    egwAuthor: '懷愛倫',
    chooseEdition: '請選擇版本。應用程式語言會優先顯示。官方純文字閱讀器會記住其字體與主題設定。',
    opensOfficial: '開啟 EGW Writings 官方純文字版本',
    egwOpenError: '無法開啟這本懷愛倫著作。',
    close: '關閉',
    adventistWritings: '復臨著作',
    classics: '基督教經典',
    chooseBook: '選擇此書及語言版本',
    opensGutenberg: '在 Project Gutenberg 外部網站開啟',
    openError: '無法開啟此圖書來源。',
  },
  'zh-cn': {
    title: '图书馆',
    egwAuthor: '怀爱伦',
    chooseEdition: '请选择版本。应用程序语言会优先显示。官方纯文字阅读器会记住其字体与主题设置。',
    opensOfficial: '打开 EGW Writings 官方纯文字版本',
    egwOpenError: '无法打开这本怀爱伦著作。',
    close: '关闭',
    adventistWritings: '复临著作',
    classics: '基督教经典',
    chooseBook: '选择此书及语言版本',
    opensGutenberg: '在 Project Gutenberg 外部网站打开',
    openError: '无法打开此图书来源。',
  },
  es: {
    title: 'Biblioteca',
    egwAuthor: 'Elena G. de White',
    chooseEdition: 'Elige una edición. El idioma de la aplicación aparece primero. El lector de texto oficial recuerda sus propios ajustes de fuente y tema.',
    opensOfficial: 'Abre la edición de texto oficial de EGW Writings',
    egwOpenError: 'No se pudo abrir este libro de EGW Writings.',
    close: 'Cerrar',
    adventistWritings: 'Escritos adventistas',
    classics: 'Clásicos cristianos',
    chooseBook: 'Elige este libro y una edición por idioma',
    opensGutenberg: 'Se abre externamente en Project Gutenberg',
    openError: 'No se pudo abrir esta fuente de la biblioteca.',
  },
};

const BOOK_COVERS: Readonly<Record<string, ImageSourcePropType>> = {
  'bates-seventh-day-sabbath': require('../../../../public/library/bates-seventh-day-sabbath.png'),
  'andrews-history-sabbath': require('../../../../public/library/andrews-history-sabbath.png'),
  'bunyan-pilgrims-progress': require('../../../../public/library/bunyan-pilgrims-progress.png'),
  'story-of-jesus': require('../../../../public/library/story-of-jesus.png'),
};

const EGW_COVERS: Readonly<Record<string, ImageSourcePropType>> = {
  'patriarchs-and-prophets': require('../../../../public/library/egw/patriarchs-and-prophets.jpg'),
  'prophets-and-kings': require('../../../../public/library/egw/prophets-and-kings.jpg'),
  'desire-of-ages': require('../../../../public/library/egw/desire-of-ages.jpg'),
  'acts-of-the-apostles': require('../../../../public/library/egw/acts-of-the-apostles.jpg'),
  'great-controversy': require('../../../../public/library/egw/great-controversy.jpg'),
  'steps-to-christ': require('../../../../public/library/egw/steps-to-christ.jpg'),
  'christs-object-lessons': require('../../../../public/library/egw/christs-object-lessons.jpg'),
  'ministry-of-healing': require('../../../../public/library/egw/ministry-of-healing.jpg'),
  education: require('../../../../public/library/egw/education.jpg'),
  'child-guidance': require('../../../../public/library/egw/child-guidance.png'),
  'messages-to-young-people': require('../../../../public/library/egw/messages-to-young-people.png'),
};

const COLLECTION_TITLES: Readonly<Record<string, Readonly<Record<SupportedLanguage, string>>>> = {
  egw: { en: 'Ellen G. White', zh: '懷愛倫', 'zh-cn': '怀爱伦', es: 'Elena G. de White' },
  bates: { en: 'Joseph Bates', zh: '約瑟·貝茨', 'zh-cn': '约瑟·贝茨', es: 'Joseph Bates' },
  andrews: { en: 'J. N. Andrews', zh: '約翰·安德烈斯', 'zh-cn': '约翰·安德烈斯', es: 'J. N. Andrews' },
  youth: { en: 'Youth / Young Adults', zh: '青年／青年成人', 'zh-cn': '青年／青年成人', es: 'Jóvenes / Adultos jóvenes' },
  children: { en: 'Children', zh: '兒童', 'zh-cn': '儿童', es: 'Niños' },
  topics: { en: 'Topics', zh: '主題', 'zh-cn': '主题', es: 'Temas' },
  ministry: { en: 'Ministry', zh: '事工', 'zh-cn': '事工', es: 'Ministerio' },
  family: { en: 'Family & Education', zh: '家庭與教育', 'zh-cn': '家庭与教育', es: 'Familia y educación' },
  classics: { en: 'Christian Classics', zh: '基督教經典', 'zh-cn': '基督教经典', es: 'Clásicos cristianos' },
};

const EGW_IDS_BY_COLLECTION: Readonly<Record<string, readonly string[]>> = {
  youth: ['education', 'messages-to-young-people'],
  children: ['child-guidance', 'messages-to-young-people', 'christs-object-lessons'],
  ministry: ['acts-of-the-apostles', 'ministry-of-healing'],
  family: ['education', 'child-guidance', 'christs-object-lessons'],
};

export default function LibraryScreen() {
  const { collection: collectionParam, q } = useLocalSearchParams<{
    collection?: string;
    q?: string;
  }>();
  const collection = collectionParam || 'egw';
  const { language } = useContext(LanguageContext);
  const { textScale } = useTextSize();
  const { fontScale, width } = useWindowDimensions();
  const theme = useAppTheme();
  const labels = allLabels[language] || allLabels.en;
  const catalog = getLibraryItemsForLanguage(language);
  const [selectedEgwBookId, setSelectedEgwBookId] = useState<string | null>(null);
  const [chineseCoverUrls, setChineseCoverUrls] = useState<ChineseLibraryCoverUrls>({});
  const styles = useMemo(() => createStyles(textScale), [textScale]);
  const useListLayout = shouldUseLibraryListLayout(
    width,
    Math.max(1, fontScale * textScale),
  );
  const selectedEgwBook =
    EGW_BOOKS.find(({ id }) => id === selectedEgwBookId) || null;
  const collectionTitle = COLLECTION_TITLES[collection]?.[language] || labels.title;
  const unfilteredEgwWorks = collection === 'egw'
    ? EGW_BOOKS
    : EGW_BOOKS.filter(({ id }) => EGW_IDS_BY_COLLECTION[collection]?.includes(id));
  const hasEgwWorks = unfilteredEgwWorks.length > 0;
  const unfilteredPublicWorks = catalog.publicDomainWorks.filter(({ id, collection: itemCollection }) =>
    (collection === 'bates' && id === 'bates-seventh-day-sabbath') ||
    (collection === 'andrews' && id === 'andrews-history-sabbath') ||
    (collection === 'classics' && itemCollection === 'christian-classics'),
  );
  const unfilteredOfficialWorks = catalog.officialCollections.filter(
    ({ collection: itemCollection }) => itemCollection === collection,
  );
  const normalizedQuery = (q || '').trim().toLocaleLowerCase();
  const egwWorks = unfilteredEgwWorks.filter((work) =>
    `${work.workTitle[language]} ${labels.egwAuthor}`.toLocaleLowerCase().includes(normalizedQuery),
  );
  const publicWorks = unfilteredPublicWorks.filter((work) =>
    `${work.title} ${work.author}`.toLocaleLowerCase().includes(normalizedQuery),
  );
  const officialWorks = unfilteredOfficialWorks.filter((work) =>
    `${work.title} ${work.author}`.toLocaleLowerCase().includes(normalizedQuery),
  );

  useEffect(() => {
    if (!shouldLoadChineseLibraryCovers(language) || !hasEgwWorks) {
      setChineseCoverUrls({});
      return;
    }

    const controller = new AbortController();
    fetchChineseLibraryCoverUrls(controller.signal)
      .then(setChineseCoverUrls)
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.warn('Could not refresh Chinese library covers:', error);
      });

    return () => controller.abort();
  }, [hasEgwWorks, language]);

  const renderLibraryBookCards = (
    books: typeof catalog.publicDomainWorks,
  ) =>
    books.map((item) => (
      <LibraryBookCard
        key={item.id}
        accessibilityHint={
          item.rights === 'official-external'
            ? labels.opensOfficial
            : labels.opensGutenberg
        }
        author={item.author}
        coverSource={BOOK_COVERS[item.id]}
        listLayout={useListLayout}
        onPress={() => openURL(item.sourceUrl, labels.title, labels.openError)}
        title={item.title}
      />
    ));

  return (
    <>
      <Stack.Screen
        options={{
          backTo: '/resources/library',
          title: collectionTitle,
        } as any}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
      >
        <TitleHero
          imageSource={{ uri: CHURCH_BUILDING_IMAGE_URL }}
          title={collectionTitle}
        />
        <View style={styles.content}>
          {collection === 'topics' ? (
            <List.Section>
              <MenuCard title={COLLECTION_TITLES.ministry[language]} description="Pastoral service, health, and mission" icon="hand-heart" onPress={() => router.push('/resources/library/ministry')} />
              <MenuCard title={COLLECTION_TITLES.family[language]} description="Home, character, and Christian education" icon="home-heart" onPress={() => router.push('/resources/library/family')} />
              <MenuCard title={COLLECTION_TITLES.classics[language]} description="Enduring Christian devotional literature" icon="book-cross" onPress={() => router.push('/resources/library/classics')} />
            </List.Section>
          ) : (
          <>
          <View style={[styles.bookGrid, useListLayout && styles.bookList]}>
            {egwWorks.map((work) => (
              <LibraryBookCard
                key={work.id}
                accessibilityHint={labels.chooseBook}
                author={labels.egwAuthor}
                coverSource={EGW_COVERS[work.id]}
                coverUrl={chineseCoverUrls[work.id]}
                listLayout={useListLayout}
                onPress={() => setSelectedEgwBookId(work.id)}
                title={work.workTitle[language]}
              />
            ))}
            {renderLibraryBookCards(publicWorks)}
            {renderLibraryBookCards(officialWorks)}
          </View>
          </>
          )}
        </View>
      </ScrollView>

      <EgwEditionDialog
        closeLabel={labels.close}
        language={language}
        onDismiss={() => setSelectedEgwBookId(null)}
        openError={labels.egwOpenError}
        opensOfficial={labels.opensOfficial}
        selectEditionLabel={labels.chooseEdition}
        work={selectedEgwBook}
      />
    </>
  );
}

const createStyles = (textScale: Parameters<typeof scaleTypographyMetric>[1]) =>
  StyleSheet.create({
    scrollContent: {
      paddingBottom: 28,
    },
    content: {
      paddingHorizontal: 20,
    },
    sectionTitle: {
      fontSize: scaleTypographyMetric(20, textScale),
      fontWeight: '700',
      lineHeight: scaleTypographyMetric(28, textScale),
      marginBottom: 8,
      marginTop: 4,
    },
    bookGrid: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 20,
    },
    bookList: {
      flexDirection: 'column',
    },
  });
