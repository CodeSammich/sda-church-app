import { AppIcon } from '@/components/AppIcon';
import { VerseHero } from '@/components/VerseHero';
import { scaleTypographyMetric } from '@/constants/AppPreferences';
import { CHURCH_BUILDING_IMAGE_URL } from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { DESIGN_TOKENS } from '@/constants/Layout';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import { useHeroHeaderTitle } from '@/hooks/useHeroHeaderTitle';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useContext, useMemo } from 'react';
import {
  Image,
  ImageSourcePropType,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Card, Text } from 'react-native-paper';

const uiLabels = {
  en: {
    title: 'Select Hymnal',
    verse: '“Is anyone among you in trouble? Let them pray. Is anyone happy? Let them sing songs of praise.”',
    verseRef: 'James 5:13 (NIV)',
    english: 'SDA Hymnal — 1985 Edition',
    chinese505: 'Chinese Hymnal — 505 Edition',
    chinese506: 'Chinese Hymnal — 506 Edition',
    chinese707V1: 'Hymns of Praise — 707 New Simplified Notation',
    chinese707V2: 'Hymns of Praise — 707 Four-Part Harmony',
    chinese707V3: 'Hymns of Praise — 707 Standard Edition',
  },
  zh: {
    title: '選擇詩歌本',
    verse: '「你們中間有受苦的呢，他就該禱告；有喜樂的呢，他就該歌頌。」',
    verseRef: '雅各書 5:13 (CUV)',
    english: '英文 SDA 詩歌本 — 1985 年版',
    chinese505: '中文讚美詩 — 505 版',
    chinese506: '中文讚美詩 — 506 版',
    chinese707V1: '頌讚詩歌 — 707 新編簡譜版',
    chinese707V2: '頌讚詩歌 — 707 簡譜四聲部版',
    chinese707V3: '頌讚詩歌 — 707 標準版',
  },
  'zh-cn': {
    title: '选择诗歌本',
    verse: '“你们中间有受苦的呢，他就该祷告；有喜乐的呢，他就该歌颂。”',
    verseRef: '雅各书 5:13 (CUVS)',
    english: '英文 SDA 诗歌本 — 1985 年版',
    chinese505: '中文赞美诗 — 505 版',
    chinese506: '中文赞美诗 — 506 版',
    chinese707V1: '颂赞诗歌 — 707 新编简谱版',
    chinese707V2: '颂赞诗歌 — 707 简谱四声部版',
    chinese707V3: '颂赞诗歌 — 707 标准版',
  },
  es: {
    title: 'Seleccionar Himnario',
    verse: '“¿Está alguno entre vosotros afligido? Haga oración. ¿Está alguno alegre? Cante alabanzas.”',
    verseRef: 'Santiago 5:13 (RVR1960)',
    english: 'Himnario ASD — Edición 1985',
    chinese505: 'Himnario Chino — Edición 505',
    chinese506: 'Himnario Chino — Edición 506',
    chinese707V1: 'Himnos de Alabanza — Edición 707 de Notación Nueva',
    chinese707V2: 'Himnos de Alabanza — Edición 707 a Cuatro Voces',
    chinese707V3: 'Himnos de Alabanza — Edición 707 Estándar',
  },
};

type HymnalCardProps = {
  title: string;
  imageSource: ImageSourcePropType;
  onPress: () => void;
};

function HymnalCard({
  title,
  imageSource,
  onPress,
}: HymnalCardProps) {
  const theme = useAppTheme();
  const { textScale } = useTextSize();
  const styles = useMemo(() => createStyles(textScale), [textScale]);

  return (
    <Card
      accessibilityLabel={title}
      accessibilityRole="button"
      mode="outlined"
      onPress={onPress}
      style={[styles.hymnalCard, { backgroundColor: theme.colors.surface }]}
    >
      <View
        style={[
          styles.coverArea,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <Image
          accessible={false}
          source={imageSource}
          style={styles.hymnalCover}
          resizeMode="contain"
        />
      </View>
      <Card.Content style={styles.cardContent}>
        <View style={styles.cardDetailsRow}>
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
              {title}
            </Text>
          </View>
          <AppIcon
            pointerEvents="none"
            name="chevron-right"
            size={DESIGN_TOKENS.ICON_SIZE_STANDARD}
            color={theme.colors.onSurfaceVariant}
          />
        </View>
      </Card.Content>
    </Card>
  );
}

export default function HymnalSelectionScreen() {
  const theme = useAppTheme();
  const NavigationStyles = useNavigationStyles();
  const { language } = useContext(LanguageContext);
  const { backTo } = useLocalSearchParams();
  const selectionRoute = '/home/hymnal-selection';
  const labels = uiLabels[language as keyof typeof uiLabels] || uiLabels.en;
  const { showHeaderTitle, handleHeroScroll } = useHeroHeaderTitle();

  return (
    <>
      <Stack.Screen
        options={{ title: labels.title, backTo, showTitleChip: showHeaderTitle } as any}
      />
      <ScrollView
        style={NavigationStyles.container}
        onScroll={handleHeroScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 80 }}
      >
        <VerseHero
          title={labels.title}
          verse={labels.verse}
          reference={labels.verseRef}
          imageSource={{ uri: CHURCH_BUILDING_IMAGE_URL }}
          verseColors={
            theme.dark
              ? ['#242052', '#312B6B', '#3D3782']
              : ['#312E81', '#4338CA', '#6366F1']
          }
        />

        {/* Body */}
        <View style={styles.cardList}>
          <HymnalCard
            title={labels.english}
            imageSource={require('../../../public/SDAH1985.jpg')}
            onPress={() =>
              router.push({
                pathname: '/home/english-hymnal',
                params: {
                  backTo: selectionRoute,
                  refresh: Date.now().toString(),
                },
              } as any)
            }
          />

          <HymnalCard
            title={labels.chinese505}
            imageSource={require('../../../public/chinese_505_hymnal.jpg')}
            onPress={() =>
              router.push({
                pathname: '/home/chinese-505-hymnal',
                params: {
                  backTo: selectionRoute,
                },
              } as any)
            }
          />

          <HymnalCard
            title={labels.chinese506}
            imageSource={require('../../../public/chinese_506_hymnal.jpg')}
            onPress={() =>
              router.push({
                pathname: '/home/chinese-506-hymnal',
                params: {
                  backTo: selectionRoute,
                },
              } as any)
            }
          />

          <HymnalCard
            title={labels.chinese707V3}
            imageSource={require('../../../public/chinese_707_hymnal_leather_bound_version.jpg')}
            onPress={() =>
              router.push({
                pathname: '/home/chinese-707-standard-hymnal',
                params: { backTo: selectionRoute },
              } as any)
            }
          />

          <HymnalCard
            title={labels.chinese707V2}
            imageSource={require('../../../public/chinese_707_hymnal_simplified_four_part_harmony.jpg')}
            onPress={() =>
              router.push({
                pathname: '/home/chinese-707-four-part-hymnal',
                params: { backTo: selectionRoute },
              } as any)
            }
          />

          <HymnalCard
            title={labels.chinese707V1}
            imageSource={require('../../../public/chinese_707_hymnal_original_simplified_notation_version.jpg')}
            onPress={() =>
              router.push({
                pathname: '/home/chinese-707-new-simplified-hymnal',
                params: { backTo: selectionRoute },
              } as any)
            }
          />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  cardList: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
});

const createStyles = (
  textScale: Parameters<typeof scaleTypographyMetric>[1],
) =>
  StyleSheet.create({
    hymnalCard: {
      borderRadius: 16,
      marginBottom: 20,
      overflow: 'hidden',
    },
    coverArea: {
      height: 300,
      padding: 12,
    },
    hymnalCover: {
      width: '100%',
      height: '100%',
      borderRadius: 8,
    },
    cardContent: {
      paddingTop: 16,
      paddingBottom: 18,
    },
    cardDetailsRow: {
      alignItems: 'center',
      flexDirection: 'row',
    },
    cardText: {
      flex: 1,
      minWidth: 0,
      paddingRight: 12,
    },
    cardTitle: {
      fontSize: scaleTypographyMetric(18, textScale),
      lineHeight: scaleTypographyMetric(24, textScale),
      fontWeight: '700',
    },
  });
