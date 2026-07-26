import { CHURCH_BUILDING_IMAGE_URL } from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { DocumentStyles } from '@/styles/DocumentStyles';
import { NavigationStyles } from '@/styles/NavigationStyles';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useContext } from 'react';
import { ImageBackground, ScrollView, StyleSheet } from 'react-native';
import { Card, List, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const allLabels = {
  en: {
    title: 'Upcoming Events',
    placeholder: 'Stay tuned for upcoming special events and programs!',
  },
  zh: {
    title: '近期活動',
    placeholder: '敬請關注即將舉行的特別活動和節目！',
  },
  'zh-cn': {
    title: '近期活动',
    placeholder: '敬请关注即将举行的特别活动和节目！',
  },
  es: {
    title: 'Próximos Eventos',
    placeholder: '¡Estén atentos a los próximos eventos y programas especiales!',
  },
};

export default function EventScreen() {
  const theme = useAppTheme();
  const { language } = useContext(LanguageContext);
  const { backTo } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;

  return (
    <>
      <Stack.Screen options={{ title: labels.title, backTo } as any} />
      <ScrollView
        style={DocumentStyles.container}
        contentContainerStyle={{ paddingTop: 0 }}
      >
        {/* Hero */}
        <ImageBackground
          source={{ uri: CHURCH_BUILDING_IMAGE_URL }}
          style={[NavigationStyles.heroHeader, { paddingTop: insets.top + 70, paddingBottom: 24 }]}
          resizeMode="cover"
        >
          <LinearGradient
            colors={theme.gradients.heroOverlay}
            style={StyleSheet.absoluteFill}
          />
          <Text
            variant="headlineSmall"
            style={[NavigationStyles.heroTitle, { color: theme.colors.onSecondary }]}
          >
            {labels.title}
          </Text>
        </ImageBackground>

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
