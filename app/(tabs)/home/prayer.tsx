import { VerseHero } from '@/components/VerseHero';
import { CHURCH_BUILDING_IMAGE_URL } from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { useHeroHeaderTitle } from '@/hooks/useHeroHeaderTitle';
import { DocumentStyles } from '@/styles/DocumentStyles';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useContext } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

const allLabels = {
  en: {
    title: 'Prayer Wall',
    verse: '“Carry each other’s burdens, and in this way you will fulfill the law of Christ.”',
    verseRef: 'Galatians 6:2 (NIV)',
    submitButton: 'Submit Prayer Request',
    placeholder: 'Recent prayer requests from our community will appear here.',
  },
  zh: {
    title: '禱告牆',
    verse: '「你們各人的重擔要互相担当，如此就完全了基督的律法。」',
    verseRef: '加拉太書 6:2 (CUV)',
    submitButton: '提交代禱事項',
    placeholder: '來自社群的近期代禱事項將顯示在此。',
  },
  'zh-cn': {
    title: '祷告墙',
    verse: '“你们各人的重担要互相担当，如此就完全了基督的律法。”',
    verseRef: '加拉太书 6:2 (CUVS)',
    submitButton: '提交代祷事项',
    placeholder: '来自社区的近期代祷事项将显示在此。',
  },
  es: {
    title: 'Muro de Oración',
    verse: '“Sobrellevad los unos las cargas de los otros, y cumplid así la ley de Cristo.”',
    verseRef: 'Gálatas 6:2 (RVR1960)',
    submitButton: 'Enviar Petición de Oración',
    placeholder:
      'Las peticiones de oración recientes de nuestra comunidad aparecerán aquí.',
  },
};

export default function PrayerWallScreen() {
  const theme = useAppTheme();
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
            ? ['#4A1D35', '#642044', '#7A2853']
            : ['#7C2D4E', '#BE185D', '#DB2777']}
        />

        <View style={DocumentStyles.section}>
          <Button
            mode="contained"
            icon="plus"
            buttonColor={theme.colors.primary}
            onPress={() => {
              /* Link to a Google Form or internal submission tool */
            }}
          >
            {labels.submitButton}
          </Button>
        </View>

        <View style={DocumentStyles.section}>
          <Card
            style={{
              backgroundColor: theme.colors.surface,
              borderStyle: 'dashed',
              borderWidth: 1,
              borderColor: theme.colors.outlineVariant,
            }}
            mode="contained"
          >
            <Card.Content>
              <Text
                variant="bodyMedium"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  textAlign: 'center',
                  paddingVertical: 40,
                }}
              >
                {labels.placeholder}
              </Text>
            </Card.Content>
          </Card>
        </View>
      </ScrollView>
    </>
  );
}
