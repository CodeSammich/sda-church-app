import { EgwEditionDialog } from '@/components/EgwEditionDialog';
import {
  LibraryBookCard,
  shouldUseLibraryListLayout,
} from '@/components/LibraryBookCard';
import { VerseHero } from '@/components/VerseHero';
import { SourceNoticePanel } from '@/components/SourceNoticePanel';
import { scaleTypographyMetric } from '@/constants/AppPreferences';
import {
  CHURCH_BUILDING_IMAGE_URL,
  openURL,
} from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import { EGW_BOOKS } from '@/features/library/EgwBookCatalog';
import { getLibraryItemsForLanguage } from '@/features/library/LibraryCatalog';
import { useHeroHeaderTitle } from '@/hooks/useHeroHeaderTitle';
import { router, Stack } from 'expo-router';
import { useContext, useMemo, useState } from 'react';
import {
  type ImageSourcePropType,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';

const allLabels = {
  en: {
    title: 'Library',
    verse:
      '“So they read from the Book of the Law of God, explaining it and giving insight, so that the people could understand what was being read.”',
    verseRef: 'Nehemiah 8:8 (BSB)',
    egwAuthor: 'Ellen G. White',
    sourceTitle: 'Reading sources',
    egwSource:
      'Ellen G. White editions are hosted externally on EGW Writings.',
    publicDomainSource:
      'Adventist pioneer and Christian classic works are public domain in the U.S. and hosted externally on Project Gutenberg.',
    chooseEdition: 'Choose an edition. Your app language is listed first.',
    opensOfficial: 'Opens the official EGW Writings edition',
    egwOpenError: 'Could not open this EGW Writings book.',
    legalLink: 'Legal Disclaimer',
    close: 'Close',
    adventistWritings: 'Adventist writings',
    classics: 'Christian classics',
    chooseBook: 'Choose this book and its language edition',
    opensGutenberg: 'Opens externally on Project Gutenberg',
    openError: 'Could not open this library source.',
  },
  zh: {
    title: '圖書館',
    verse: '「他們清清楚楚地念神的律法書，講明意思，使百姓明白所念的。」',
    verseRef: '尼希米記 8:8（和合本）',
    egwAuthor: '懷愛倫',
    sourceTitle: '閱讀來源',
    egwSource:
      '懷愛倫著作版本由 EGW Writings 外部網站提供。',
    publicDomainSource:
      '復臨先賢與基督教經典著作在美國屬於公版，並由 Project Gutenberg 外部網站提供。',
    chooseEdition: '請選擇版本。應用程式語言會優先顯示。',
    opensOfficial: '開啟 EGW Writings 官方版本',
    egwOpenError: '無法開啟這本懷愛倫著作。',
    legalLink: '法律聲明',
    close: '關閉',
    adventistWritings: '復臨著作',
    classics: '基督教經典',
    chooseBook: '選擇此書及語言版本',
    opensGutenberg: '在 Project Gutenberg 外部網站開啟',
    openError: '無法開啟此圖書來源。',
  },
  'zh-cn': {
    title: '图书馆',
    verse: '“他们清清楚楚地念神的律法书，讲明意思，使百姓明白所念的。”',
    verseRef: '尼希米记 8:8（和合本）',
    egwAuthor: '怀爱伦',
    sourceTitle: '阅读来源',
    egwSource:
      '怀爱伦著作版本由 EGW Writings 外部网站提供。',
    publicDomainSource:
      '复临先驱与基督教经典著作在美国属于公版，并由 Project Gutenberg 外部网站提供。',
    chooseEdition: '请选择版本。应用程序语言会优先显示。',
    opensOfficial: '打开 EGW Writings 官方版本',
    egwOpenError: '无法打开这本怀爱伦著作。',
    legalLink: '法律声明',
    close: '关闭',
    adventistWritings: '复临著作',
    classics: '基督教经典',
    chooseBook: '选择此书及语言版本',
    opensGutenberg: '在 Project Gutenberg 外部网站打开',
    openError: '无法打开此图书来源。',
  },
  es: {
    title: 'Biblioteca',
    verse:
      '“Leían en el libro de la ley de Dios claramente, y ponían el sentido, de modo que entendiesen la lectura.”',
    verseRef: 'Nehemías 8:8 (RVR1909)',
    egwAuthor: 'Elena G. de White',
    sourceTitle: 'Fuentes de lectura',
    egwSource:
      'Las ediciones de Elena G. de White están alojadas externamente en EGW Writings.',
    publicDomainSource:
      'Las obras de pioneros adventistas y los clásicos cristianos son de dominio público en EE. UU. y están alojados externamente en Project Gutenberg.',
    chooseEdition: 'Elige una edición. El idioma de la aplicación aparece primero.',
    opensOfficial: 'Abre la edición oficial de EGW Writings',
    egwOpenError: 'No se pudo abrir este libro de EGW Writings.',
    legalLink: 'Aviso legal',
    close: 'Cerrar',
    adventistWritings: 'Escritos adventistas',
    classics: 'Clásicos cristianos',
    chooseBook: 'Elige este libro y una edición por idioma',
    opensGutenberg: 'Se abre externamente en Project Gutenberg',
    openError: 'No se pudo abrir esta fuente de la biblioteca.',
  },
};

const BOOK_COVERS: Readonly<Record<string, ImageSourcePropType>> = {
  'bates-seventh-day-sabbath': require('../../../public/library/bates-seventh-day-sabbath.png'),
  'andrews-history-sabbath': require('../../../public/library/andrews-history-sabbath.png'),
  'bunyan-pilgrims-progress': require('../../../public/library/bunyan-pilgrims-progress.png'),
};

const EGW_COVERS: Readonly<Record<string, ImageSourcePropType>> = {
  'patriarchs-and-prophets': require('../../../public/library/egw/patriarchs-and-prophets.jpg'),
  'prophets-and-kings': require('../../../public/library/egw/prophets-and-kings.jpg'),
  'desire-of-ages': require('../../../public/library/egw/desire-of-ages.jpg'),
  'acts-of-the-apostles': require('../../../public/library/egw/acts-of-the-apostles.jpg'),
  'great-controversy': require('../../../public/library/egw/great-controversy.jpg'),
  'steps-to-christ': require('../../../public/library/egw/steps-to-christ.jpg'),
  'christs-object-lessons': require('../../../public/library/egw/christs-object-lessons.jpg'),
  'ministry-of-healing': require('../../../public/library/egw/ministry-of-healing.jpg'),
  education: require('../../../public/library/egw/education.jpg'),
};

export default function LibraryScreen() {
  const { language } = useContext(LanguageContext);
  const { textScale } = useTextSize();
  const { fontScale, width } = useWindowDimensions();
  const theme = useAppTheme();
  const labels = allLabels[language] || allLabels.en;
  const catalog = getLibraryItemsForLanguage(language);
  const [selectedEgwBookId, setSelectedEgwBookId] = useState<string | null>(null);
  const styles = useMemo(() => createStyles(textScale), [textScale]);
  const { showHeaderTitle, handleHeroScroll } = useHeroHeaderTitle();
  const useListLayout = shouldUseLibraryListLayout(
    width,
    Math.max(1, fontScale * textScale),
  );
  const selectedEgwBook =
    EGW_BOOKS.find(({ id }) => id === selectedEgwBookId) || null;
  const pioneerWorks = catalog.publicDomainWorks.filter(
    ({ collection }) => collection === 'adventist-pioneers',
  );
  const christianClassics = catalog.publicDomainWorks.filter(
    ({ collection }) => collection === 'christian-classics',
  );

  const renderPublicDomainBookCards = (
    books: typeof catalog.publicDomainWorks,
  ) =>
    books.map((item) => (
      <LibraryBookCard
        key={item.id}
        accessibilityHint={labels.opensGutenberg}
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
        options={{ title: labels.title, showTitleChip: showHeaderTitle } as any}
      />
      <ScrollView
        style={{ flex: 1 }}
        onScroll={handleHeroScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
      >
        <VerseHero
          title={labels.title}
          verse={labels.verse}
          reference={labels.verseRef}
          imageSource={{ uri: CHURCH_BUILDING_IMAGE_URL }}
          verseColors={
            theme.dark
              ? ['#18312D', '#204A43', '#2D6258']
              : ['#28594F', '#367466', '#4C8F7D']
          }
        />

        <View style={styles.content}>
          <SourceNoticePanel
            items={[
              { icon: 'bookshelf', text: labels.egwSource },
              {
                icon: 'book-open-variant',
                text: labels.publicDomainSource,
              },
            ]}
            legalLabel={labels.legalLink}
            onLegalPress={() =>
              router.push({
                pathname: '/you/legal',
                params: { backTo: '/resources/library' },
              } as any)
            }
            style={styles.sourcePanel}
            title={labels.sourceTitle}
          />

          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            {labels.adventistWritings}
          </Text>
          <View style={[styles.bookGrid, useListLayout && styles.bookList]}>
            {EGW_BOOKS.map((work) => (
              <LibraryBookCard
                key={work.id}
                accessibilityHint={labels.chooseBook}
                author={labels.egwAuthor}
                coverSource={EGW_COVERS[work.id]}
                listLayout={useListLayout}
                onPress={() => setSelectedEgwBookId(work.id)}
                title={work.workTitle[language]}
              />
            ))}
            {renderPublicDomainBookCards(pioneerWorks)}
          </View>

          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            {labels.classics}
          </Text>
          <View style={[styles.bookGrid, useListLayout && styles.bookList]}>
            {renderPublicDomainBookCards(christianClassics)}
          </View>
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
      paddingTop: 12,
    },
    sourcePanel: {
      marginBottom: 22,
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
