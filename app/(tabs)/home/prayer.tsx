import { CHURCH_BUILDING_IMAGE_URL } from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { DocumentStyles } from '@/styles/DocumentStyles';
import { NavigationStyles } from '@/styles/NavigationStyles';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useContext } from 'react';
import { ImageBackground, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const allLabels = {
  en: {
    title: 'Prayer Wall',
    description:
      '“Carry each other’s burdens, and in this way you will fulfill the law of Christ.” — Galatians 6:2',
    submitButton: 'Submit Prayer Request',
    placeholder: 'Recent prayer requests from our community will appear here.',
  },
  zh: {
    title: '禱告牆',
    description: '「你們各人的重擔要互相担当，如此就完全了基督的律法。」— 加拉太書 6:2',
    submitButton: '提交代禱事項',
    placeholder: '來自社群的近期代禱事項將顯示在此。',
  },
  'zh-cn': {
    title: '祷告墙',
    description: '“你们各人的重担要互相担当，如此就完全了基督的律法。”— 加拉太书 6:2',
    submitButton: '提交代祷事项',
    placeholder: '来自社区的近期代祷事项将显示在此。',
  },
  es: {
    title: 'Muro de Oración',
    description:
      '“Sobrellevad los unos las cargas de los otros, y cumplid así la ley de Cristo.” — Gálatas 6:2',
    submitButton: 'Enviar Petición de Oración',
    placeholder:
      'Las peticiones de oración recientes de nuestra comunidad aparecerán aquí.',
  },
};

export default function PrayerWallScreen() {
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

        <View style={DocumentStyles.section}>
          <Text
            variant="bodyMedium"
            style={[
              DocumentStyles.description,
              { color: theme.colors.onSurfaceVariant, fontStyle: 'italic' },
            ]}
          >
            {labels.description}
          </Text>

          <Button
            mode="contained"
            icon="plus"
            style={{ marginTop: 16 }}
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
