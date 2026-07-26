import { VerseHero } from '@/components/VerseHero';
import {
  BAPTISM_MEANING_DATA,
  BAPTISMAL_VOWS,
  CHURCH_LIFE_PILLARS,
  DIETARY_PRINCIPLES,
  JOINING_CHURCH,
  TEN_COMMANDMENTS,
} from '@/constants/DoctrineData';
import { CHURCH_BUILDING_IMAGE_URL } from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { useHeroHeaderTitle } from '@/hooks/useHeroHeaderTitle';
import { DocumentStyles } from '@/styles/DocumentStyles';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useContext, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Card, List, Text } from 'react-native-paper';

export default function BaptismScreen() {
  const { language } = useContext(LanguageContext);
  const { backTo } = useLocalSearchParams();
  const theme = useAppTheme();
  const { showHeaderTitle, handleHeroScroll } = useHeroHeaderTitle();

  const [expanded, setExpanded] = useState<string | null>(null);

  const allLabels = {
    en: {
      title: 'Joining the Church',
      baptismQuote: '“Whoever believes and is baptized will be saved.”',
      baptismRef: 'Mark 16:16 (BSB)',
      vowsTitle: 'Baptismal Vows',
      commandmentsTitle: 'The Ten Commandments',
      lifestyleTitle: 'Adventist Lifestyle',
      commitmentsHeader: 'Fundamental Resources',
    },
    zh: {
      title: '加入教會',
      baptismQuote: '「信而受洗的必然得救。」',
      baptismRef: '馬可福音 16:16 (CUV)',
      baptismIntro: '受洗之時，需信奉持守耶穌所傳的真道。',
      vowsTitle: '浸禮約言',
      commandmentsTitle: '十條誡命',
      lifestyleTitle: '安息日會的生活方式',
      commitmentsHeader: '信仰與生活根基',
    },
    'zh-cn': {
      title: '加入教会',
      baptismQuote: '“信而受洗的必然得救。”',
      baptismRef: '马可福音 16:16 (CUVS)',
      baptismIntro: '受洗之时，需信奉持守耶稣所传的真道。',
      vowsTitle: '浸礼约言',
      commandmentsTitle: '十条诫命',
      lifestyleTitle: '安息日会的生活方式',
      commitmentsHeader: '信仰与生活根基',
    },
    es: {
      title: 'Unirse a la Iglesia',
      baptismQuote: '“El que creyere y fuere bautizado, será salvo.”',
      baptismRef: 'Marcos 16:16 (RVR1960)',
      baptismIntro:
        'Al ser bautizado, uno debe creer, confesar, mantener y observar el verdadero camino enseñado por Jesús.',
      pillarsTitle: 'Cuatro Pilares de la Vida Eclesial',
      vowsTitle: 'Votos Bautismales',
      commandmentsTitle: 'Los Diez Mandamientos',
      lifestyleTitle: 'Estilo de Vida Adventista',
      commitmentsHeader: 'Fundamental Resources',
    },
  };

  const langKey = (language as keyof typeof allLabels) || 'en';
  const labels = allLabels[langKey];

  const joining =
    JOINING_CHURCH[langKey as keyof typeof JOINING_CHURCH] || JOINING_CHURCH.en;
  const pillars =
    CHURCH_LIFE_PILLARS[langKey as keyof typeof CHURCH_LIFE_PILLARS] ||
    CHURCH_LIFE_PILLARS.en;
  const vows =
    BAPTISMAL_VOWS[langKey as keyof typeof BAPTISMAL_VOWS] || BAPTISMAL_VOWS.en;
  const commandments =
    TEN_COMMANDMENTS[langKey as keyof typeof TEN_COMMANDMENTS] || TEN_COMMANDMENTS.en;
  const diet =
    DIETARY_PRINCIPLES[langKey as keyof typeof DIETARY_PRINCIPLES] ||
    DIETARY_PRINCIPLES.en;
  const meaning =
    BAPTISM_MEANING_DATA[langKey as keyof typeof BAPTISM_MEANING_DATA] ||
    BAPTISM_MEANING_DATA.en;

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
          verse={labels.baptismQuote}
          reference={labels.baptismRef}
          imageSource={{ uri: CHURCH_BUILDING_IMAGE_URL }}
          verseColors={theme.dark
            ? ['#172554', '#1E3A70', '#244B8F']
            : ['#1E3A8A', '#1D4ED8', '#2563EB']}
        />

        {/* Body */}
        <View style={DocumentStyles.section}>
          <Text
            variant="bodyMedium"
            style={{
              color: theme.colors.onSurface,
              marginBottom: 12,
              fontWeight: 'bold',
            }}
          >
            {meaning.intro}
          </Text>

          <Card style={DocumentStyles.card} mode="outlined">
            {meaning.points.map((point: any, index: number) => (
              <View key={index}>
                <List.Item
                  title={point.title}
                  titleStyle={{ fontWeight: 'bold', color: theme.colors.onSurface }}
                  description={() => (
                    <View style={{ marginTop: 4 }}>
                      <Text variant="bodyMedium" style={{ marginBottom: 4 }}>
                        {point.desc}
                      </Text>
                      <Text
                        variant="labelSmall"
                        style={{
                          fontStyle: 'italic',
                          color: theme.colors.onSurfaceVariant,
                        }}
                      >
                        {point.ref}
                      </Text>
                    </View>
                  )}
                  left={(props) => (
                    <List.Icon
                      {...props}
                      color={theme.colors.primary}
                      icon={point.icon}
                    />
                  )}
                  descriptionNumberOfLines={10}
                />
                {index < meaning.points.length - 1 && (
                  <List.Icon
                    icon="minus"
                    color={theme.colors.primary}
                    style={{ alignSelf: 'center', height: 10, opacity: 0.1 }}
                  />
                )}
              </View>
            ))}
          </Card>
        </View>

        <View style={DocumentStyles.section}>
          <Text
            variant="titleLarge"
            style={[
              DocumentStyles.sectionTitle,
              {
                color: theme.colors.onSurface,
                borderBottomColor: theme.colors.outlineVariant,
              },
            ]}
          >
            {pillars.title}
          </Text>
          <Text
            variant="bodyMedium"
            style={{ marginBottom: 16, color: theme.colors.onSurface }}
          >
            {pillars.intro}
          </Text>
          {pillars.items.map((pillar: any, index: number) => (
            <Card
              key={index}
              style={[DocumentStyles.card, { marginBottom: 12 }]}
              mode="outlined"
            >
              <Card.Content>
                <Text
                  variant="titleMedium"
                  style={{ fontWeight: 'bold', color: theme.colors.onSurface }}
                >
                  {pillar.title}
                </Text>
                <Text variant="bodyMedium" style={{ marginTop: 4 }}>
                  {pillar.desc}
                </Text>
              </Card.Content>
            </Card>
          ))}
          {pillars.footer && (
            <Text
              variant="bodyMedium"
              style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}
            >
              {pillars.footer}
            </Text>
          )}
        </View>

        <View style={DocumentStyles.section}>
          <Text
            variant="titleLarge"
            style={[
              DocumentStyles.sectionTitle,
              {
                color: theme.colors.onSurface,
                borderBottomColor: theme.colors.outlineVariant,
              },
            ]}
          >
            {joining.title}
          </Text>
          <Text
            variant="bodyMedium"
            style={{ marginBottom: 16, color: theme.colors.onSurface }}
          >
            {joining.intro}
          </Text>

          {joining.methods.map((method: any, idx: number) => (
            <Card
              key={idx}
              style={[DocumentStyles.card, { marginTop: idx > 0 ? 12 : 0 }]}
              mode="outlined"
            >
              <Card.Content>
                <Text
                  variant="titleMedium"
                  style={{ color: theme.colors.primary, fontWeight: 'bold' }}
                >
                  {method.title}
                </Text>
                <Text
                  style={{ color: theme.colors.onSurface, marginTop: 8 }}
                  variant="bodyMedium"
                >
                  {method.desc}
                </Text>
              </Card.Content>
            </Card>
          ))}
        </View>

        <View style={DocumentStyles.section}>
          <Text
            variant="titleLarge"
            style={[
              DocumentStyles.sectionTitle,
              {
                color: theme.colors.onSurface,
                borderBottomColor: theme.colors.outlineVariant,
              },
            ]}
          >
            {labels.commitmentsHeader}
          </Text>

          <List.Accordion
            title={labels.vowsTitle}
            expanded={expanded === 'vows'}
            onPress={() => setExpanded(expanded === 'vows' ? null : 'vows')}
            left={(props) => (
              <List.Icon {...props} color={theme.colors.primary} icon="check-decagram" />
            )}
            style={{ backgroundColor: theme.colors.surface }}
          >
            <Card style={DocumentStyles.card} mode="outlined">
              <Card.Content>
                {vows.map((vow, idx) => (
                  <Text key={idx} style={{ marginBottom: 8 }}>
                    {idx + 1}. {vow}
                  </Text>
                ))}
              </Card.Content>
            </Card>
          </List.Accordion>

          <List.Accordion
            title={labels.commandmentsTitle}
            expanded={expanded === 'commandments'}
            onPress={() =>
              setExpanded(expanded === 'commandments' ? null : 'commandments')
            }
            left={(props) => (
              <List.Icon {...props} color={theme.colors.primary} icon="script-text" />
            )}
            style={{ backgroundColor: theme.colors.surface }}
          >
            <Card style={DocumentStyles.card} mode="outlined">
              <Card.Content>
                {commandments.intro && (
                  <Text
                    variant="bodyMedium"
                    style={{ marginBottom: 16, fontWeight: 'bold' }}
                  >
                    {commandments.intro}
                  </Text>
                )}
                {commandments.items.map((cmd: string, idx: number) => (
                  <Text key={idx} style={{ marginBottom: 12 }}>
                    {cmd}
                  </Text>
                ))}
                {commandments.citation && (
                  <Text
                    variant="labelSmall"
                    style={{
                      textAlign: 'right',
                      marginTop: 8,
                      fontStyle: 'italic',
                      color: theme.colors.onSurfaceVariant,
                    }}
                  >
                    {commandments.citation}
                  </Text>
                )}
              </Card.Content>
            </Card>
          </List.Accordion>

          <List.Accordion
            title={labels.lifestyleTitle}
            expanded={expanded === 'lifestyle'}
            onPress={() => setExpanded(expanded === 'lifestyle' ? null : 'lifestyle')}
            left={(props) => (
              <List.Icon {...props} color={theme.colors.primary} icon="heart-pulse" />
            )}
            style={{ backgroundColor: theme.colors.surface }}
          >
            <Card style={DocumentStyles.card} mode="outlined">
              <Card.Content>
                <Text
                  variant="titleMedium"
                  style={{
                    fontWeight: 'bold',
                    marginBottom: 8,
                    color: theme.colors.onSurface,
                  }}
                >
                  {diet.title}
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ marginBottom: 16, color: theme.colors.onSurfaceVariant }}
                >
                  {diet.scripture}
                </Text>
                <Text
                  variant="labelLarge"
                  style={{ fontWeight: 'bold', marginBottom: 8 }}
                >
                  {diet.summaryTitle}
                </Text>
                <List.Item title={diet.land} titleNumberOfLines={3} />
                <List.Item title={diet.water} titleNumberOfLines={3} />
                <List.Item title={diet.insects} titleNumberOfLines={3} />
                <List.Item title={diet.birds} titleNumberOfLines={3} />
                <View
                  style={{
                    marginTop: 8,
                    padding: 12,
                    backgroundColor: theme.colors.surfaceVariant,
                    borderRadius: 8,
                  }}
                >
                  <Text variant="bodyMedium" style={{ fontStyle: 'italic' }}>
                    {diet.lifestyle}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          </List.Accordion>
        </View>
      </ScrollView>
    </>
  );
}
