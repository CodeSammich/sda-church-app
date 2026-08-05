import { VerseHero } from '@/components/VerseHero';
import { CHURCH_BUILDING_IMAGE_URL } from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { useHeroHeaderTitle } from '@/hooks/useHeroHeaderTitle';
import { useDocumentStyles } from '@/styles/DocumentStyles';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useContext } from 'react';
import { ScrollView } from 'react-native';
import { Card, List, Text } from 'react-native-paper';

const allLabels = {
  en: {
    title: 'Upcoming Events',
    verse: '“And let us consider how to spur one another on to love and good deeds. Let us not neglect meeting together, as some have made a habit, but let us encourage one another, and all the more as you see the Day approaching.”',
    verseRef: 'Hebrews 10:24–25 (BSB)',
    placeholder: 'Stay tuned for upcoming special events and programs!',
  },
  zh: {
    title: '近期活動',
    verse: '「又要彼此相顧，激發愛心，勉勵行善。你們不可停止聚會，好像那些停止慣了的人，倒要彼此勸勉；既知道那日子臨近，就更當如此。」',
    verseRef: '希伯來書 10:24–25 (CUV)',
    placeholder: '敬請關注即將舉行的特別活動和節目！',
  },
  'zh-cn': {
    title: '近期活动',
    verse: '“又要彼此相顾，激发爱心，勉励行善。你们不可停止聚会，好像那些停止惯了的人，倒要彼此劝勉；既知道那日子临近，就更当如此。”',
    verseRef: '希伯来书 10:24–25 (CUVS)',
    placeholder: '敬请关注即将举行的特别活动和节目！',
  },
  es: {
    title: 'Próximos Eventos',
    verse: '“Y considerémonos unos a otros para estimularnos al amor y a las buenas obras; no dejando de congregarnos, como algunos tienen por costumbre, sino exhortándonos; y tanto más, cuanto veis que aquel día se acerca.”',
    verseRef: 'Hebreos 10:24–25 (RVR1960)',
    placeholder: '¡Estén atentos a los próximos eventos y programas especiales!',
  },
};

export default function EventScreen() {
  const theme = useAppTheme();
  const DocumentStyles = useDocumentStyles();
  const { language } = useContext(LanguageContext);
  const { backTo } = useLocalSearchParams();
  const { showHeaderTitle, handleHeroScroll } = useHeroHeaderTitle();
  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;

  return (
    <>
      <Stack.Screen
        options={{ title: labels.title, backTo, showTitleChip: showHeaderTitle } as any}
      />
      <ScrollView
        style={DocumentStyles.container}
        onScroll={handleHeroScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: 0 }}
      >
        <VerseHero
          title={labels.title}
          verse={labels.verse}
          reference={labels.verseRef}
          imageSource={{ uri: CHURCH_BUILDING_IMAGE_URL }}
          verseColors={theme.dark
            ? ['#4A2517', '#63301A', '#7A3B1C']
            : ['#7C2D12', '#C2410C', '#EA580C']}
        />

        {/* Body */}
        <List.Section>
          <Card style={{ backgroundColor: theme.colors.surface }} mode="outlined">
            <Card.Content>
              <Text
                variant="bodyMedium"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  textAlign: 'center',
                  paddingVertical: 20,
                }}
              >
                {labels.placeholder}
              </Text>
            </Card.Content>
          </Card>
        </List.Section>
      </ScrollView>
    </>
  );
}
