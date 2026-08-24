import { AppIcon } from '@/components/AppIcon';
import { MenuCard } from '@/components/MenuCard';
import { SourceNoticePanel } from '@/components/SourceNoticePanel';
import { TitleHero } from '@/components/TitleHero';
import { scaleTypographyMetric } from '@/constants/AppPreferences';
import { CHURCH_BUILDING_IMAGE_URL } from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import {
  lookupEquivalentHymnNumbers,
  type HymnLookupDirection,
} from '@/features/hymnal/InterlingualHymnLookup';
import {
  getHymnalSearchItems,
  type HymnalSearchItem,
} from '@/features/hymnal/HymnalSearch';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useContext, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

const LOOKUP_HYMNAL_IDS = new Set([
  'sdah-1985-en',
  'chinese-hymnal-505',
]);

const uiLabels = {
  en: {
    title: 'English–Chinese Hymn Lookup',
    search: 'Search English or Chinese hymn...',
    instructions: 'How to use this lookup',
    description:
      'Search by hymn number or title. Choose the hymn you have, and we’ll show its corresponding number.',
    selected: 'Selected hymn',
    result: 'Matching hymn',
    results: 'Matching hymns',
    noMatch: 'The cross-reference sheet does not list an equivalent hymn.',
    unavailable: 'Sheet music is not available in the online 505 catalog.',
  },
  zh: {
    title: '英中詩歌編號對照',
    search: '搜尋英文或中文詩歌...',
    instructions: '如何使用詩歌對照',
    description: '按詩歌編號或歌名搜尋。選擇你已有的詩歌，我們會顯示其對應編號。',
    selected: '已選詩歌',
    result: '對應詩歌',
    results: '對應詩歌',
    noMatch: '對照表中沒有列出相應的詩歌。',
    unavailable: '505 版網上目錄暫無此琴譜。',
  },
  'zh-cn': {
    title: '英中诗歌编号对照',
    search: '搜索英文或中文诗歌...',
    instructions: '如何使用诗歌对照',
    description: '按诗歌编号或歌名搜索。选择你已有的诗歌，我们会显示其对应编号。',
    selected: '已选诗歌',
    result: '对应诗歌',
    results: '对应诗歌',
    noMatch: '对照表中没有列出相应的诗歌。',
    unavailable: '505 版网上目录暂无此乐谱。',
  },
  es: {
    title: 'Correspondencia de Himnos en Inglés y Chino',
    search: 'Buscar himno en inglés o chino...',
    instructions: 'Cómo usar esta búsqueda',
    description:
      'Busca por número o título. Elige el himno que tienes y mostraremos su número correspondiente.',
    selected: 'Himno seleccionado',
    result: 'Himno correspondiente',
    results: 'Himnos correspondientes',
    noMatch: 'La hoja de referencia no indica un himno equivalente.',
    unavailable: 'La partitura no está disponible en el catálogo 505 en línea.',
  },
} as const;

const getItemKey = (item: HymnalSearchItem) =>
  `${item.hymnalId}:${item.hymnNumber}`;

export default function HymnLookupScreen() {
  const theme = useAppTheme();
  const NavigationStyles = useNavigationStyles();
  const { textScale } = useTextSize();
  const styles = useMemo(() => createStyles(textScale), [textScale]);
  const { language } = useContext(LanguageContext);
  const labels = uiLabels[language as keyof typeof uiLabels] || uiLabels.en;
  const { backTo, sourceHymnalId, sourceNumber } = useLocalSearchParams<{
    backTo?: string;
    sourceHymnalId?: string;
    sourceNumber?: string;
  }>();
  const lookupItems = useMemo(
    () =>
      getHymnalSearchItems(language).filter((item) =>
        LOOKUP_HYMNAL_IDS.has(item.hymnalId),
      ),
    [language],
  );
  const initialKey =
    sourceHymnalId && sourceNumber
      ? `${sourceHymnalId}:${sourceNumber}`
      : undefined;
  const [selectedKey, setSelectedKey] = useState(initialKey);
  const selectedItem = lookupItems.find(
    (item) => getItemKey(item) === selectedKey,
  );

  const selectHymn = useCallback((item: HymnalSearchItem) => {
    setSelectedKey(getItemKey(item));
  }, []);

  const headerSearchItems = useMemo(
    () =>
      lookupItems.map((item) => ({
        icon: 'music-note',
        key: getItemKey(item),
        onPress: () => selectHymn(item),
        searchNumber: item.hymnNumber.toString(),
        searchText: item.keywords.join(' '),
        subtitle: item.hymnalLabel,
        title: item.title,
      })),
    [lookupItems, selectHymn],
  );

  const direction: HymnLookupDirection | undefined = selectedItem
    ? selectedItem.hymnalId === 'sdah-1985-en'
      ? 'englishToChinese'
      : 'chineseToEnglish'
    : undefined;
  const lookupResult =
    direction && selectedItem
      ? lookupEquivalentHymnNumbers(
          direction,
          selectedItem.hymnNumber.toString(),
        )
      : undefined;

  const openReader = (item: HymnalSearchItem) => {
    const lookupSource = selectedItem || item;
    const lookupBackTarget =
      `/home/hymn-lookup?sourceHymnalId=${lookupSource.hymnalId}` +
      `&sourceNumber=${lookupSource.hymnNumber}` +
      `&backTo=${encodeURIComponent('/home/hymnal-selection')}`;
    const pathname =
      item.hymnalId === 'sdah-1985-en'
        ? '/home/english-hymnal'
        : '/home/chinese-505-hymnal';

    router.push({
      pathname,
      params: {
        hymnNum: item.hymnNumber.toString(),
        backTo: lookupBackTarget,
      },
    } as any);
  };

  const targetItems =
    lookupResult?.status === 'matched' && direction
      ? lookupResult.targetNumbers.map((number) => {
          const targetHymnalId =
            direction === 'englishToChinese'
              ? 'chinese-hymnal-505'
              : 'sdah-1985-en';
          return {
            number,
            item: lookupItems.find(
              (candidate) =>
                candidate.hymnalId === targetHymnalId &&
                candidate.hymnNumber.toString() === number.toString(),
            ),
          };
        })
      : [];

  return (
    <>
      <Stack.Screen
        options={{
          title: labels.title,
          backTo,
          headerSearch: {
            items: headerSearchItems,
            placeholder: labels.search,
          },
        } as any}
      />
      <ScrollView
        style={NavigationStyles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TitleHero
          imageSource={{ uri: CHURCH_BUILDING_IMAGE_URL }}
          title={labels.title}
        />
        <View style={styles.body}>
          <SourceNoticePanel
            items={[{ icon: 'magnify', text: labels.description }]}
            style={styles.instructionPanel}
            title={labels.instructions}
          />

          {selectedItem ? (
            <View accessibilityLiveRegion="polite">
              <Text
                style={[styles.sectionHeading, { color: theme.colors.onSurface }]}
              >
                {labels.selected}
              </Text>
              <MenuCard
                title={selectedItem.title}
                description={selectedItem.hymnalLabel}
                icon="music-note"
                onPress={() => openReader(selectedItem)}
                rightIcon="book-open-variant"
              />

              {targetItems.length > 0 ? (
                <>
                  <Text
                    style={[
                      styles.sectionHeading,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    {targetItems.length === 1 ? labels.result : labels.results}
                  </Text>
                  {targetItems.map(({ number, item }) => (
                    <MenuCard
                      key={number}
                      title={item?.title || number.toString()}
                      description={item ? item.hymnalLabel : labels.unavailable}
                      icon="music-clef-treble"
                      onPress={item ? () => openReader(item) : undefined}
                      rightIcon={item ? 'book-open-variant' : null}
                    />
                  ))}
                </>
              ) : (
                <View
                  style={[
                    styles.messageCard,
                    { backgroundColor: theme.colors.surfaceVariant },
                  ]}
                >
                  <AppIcon
                    name="information-outline"
                    size={24}
                    color={theme.colors.primary}
                  />
                  <Text
                    style={[
                      styles.message,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {labels.noMatch}
                  </Text>
                </View>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}

const createStyles = (
  textScale: Parameters<typeof scaleTypographyMetric>[1],
) =>
  StyleSheet.create({
    content: {
      paddingBottom: 80,
    },
    body: {
      paddingHorizontal: 20,
    },
    instructionPanel: {
      marginTop: 4,
    },
    sectionHeading: {
      fontSize: scaleTypographyMetric(18, textScale),
      fontWeight: '700',
      lineHeight: scaleTypographyMetric(26, textScale),
      marginBottom: 10,
      marginTop: 24,
    },
    messageCard: {
      alignItems: 'center',
      borderRadius: 16,
      flexDirection: 'row',
      gap: 12,
      marginTop: 24,
      padding: 16,
    },
    message: {
      flex: 1,
      flexShrink: 1,
      fontSize: scaleTypographyMetric(15, textScale),
      lineHeight: scaleTypographyMetric(22, textScale),
    },
  });
