import { VerseHero } from '@/components/VerseHero';
import { WrappingButton as Button } from '@/components/WrappingButton';
import { CHURCH_BUILDING_IMAGE_URL, openAdventistGiving } from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { useHeroHeaderTitle } from '@/hooks/useHeroHeaderTitle';
import { useDocumentStyles } from '@/styles/DocumentStyles';
import { Stack } from 'expo-router';
import { useContext } from 'react';
import { ScrollView, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

export default function GiveScreen() {
  const { language } = useContext(LanguageContext);
  const theme = useAppTheme();
  const DocumentStyles = useDocumentStyles();
  const { showHeaderTitle, handleHeroScroll } = useHeroHeaderTitle();

  const allLabels = {
    en: {
      title: 'Tithe & Offering',
      cashSection: 'In-Person Giving',
      cashLabel: 'Sabbath Service',
      cashTitle: 'Cash',
      cashDesc:
        'We welcome cash donations during our weekly meetings. Envelopes are provided for your convenience to specify tithe or designate your gift to various offering categories and local ministries.',
      zelleSection: 'Electronic Transfer',
      zelleLabel: 'Direct Bank Transfer',
      zelleTitle: 'Zelle',
      zelleDesc:
        'Electronic transfers via Zelle are currently being established. Please check back soon for the official church handle.',
      zelleButton: 'Zelle (TBD)',
      onlineSection: 'Online Portal',
      onlineLabel: 'Official Platform',
      onlineTitle: 'AdventistGiving',
      onlineDesc:
        'AdventistGiving allows you to return your tithe and give your offerings online while you are at home or on the go.',
      onlineButton: 'AdventistGiving',
      quote:
        'Bring the full tithe into the storehouse, so that there may be food in My house. Test Me in this,” says the Lord of Hosts. “See if I will not open the windows of heaven and pour out for you blessing without measure.',
      quoteRef: 'Malachi 3:10 (BSB)',
      taxNote:
        'All donations are tax-deductible. As a registered 501(c)(3) non-profit organization, we issue tax receipts for all contributions at the end of the fiscal year.',
    },
    zh: {
      title: '奉獻',
      cashSection: '現場奉獻',
      cashLabel: '安息日聚會',
      cashTitle: '現金',
      cashDesc:
        '我們歡迎在每週聚會期間進行現金捐款。我們提供奉獻袋，方便您註明什一奉獻或將捐款指定用於特定的事工類別或在地項目。',
      zelleSection: '電子轉賬',
      zelleLabel: '直接銀行轉賬',
      zelleTitle: 'Zelle',
      zelleDesc: 'Zelle 電子轉賬正在建立中。請稍後查看教會賬號。',
      zelleButton: 'Zelle (待定)',
      onlineSection: '網上平台',
      onlineLabel: '官方平台',
      onlineTitle: 'AdventistGiving',
      onlineDesc:
        'AdventistGiving 讓您無論是在家或在外，都能在線歸還什一奉獻並進行捐款。',
      onlineButton: 'AdventistGiving',
      quote:
        '萬軍之耶和華說：你們要將當納的十分之一全然送入倉庫，使我家有糧，以此試試我，是否為你們敞開天上的窗戶，傾福與你們，甚至無處可容。',
      quoteRef: '瑪拉基書 3:10 (CUV)',
      taxNote:
        '所有捐款均可扣稅。作為註冊的 501(c)(3) 非營利組織，我們會在財政年度結束時為所有捐款提供報稅收據。',
    },
    'zh-cn': {
      title: '奉献',
      cashSection: '现场奉献',
      cashLabel: '安息日聚会',
      cashTitle: '现金',
      cashDesc:
        '我们欢迎在每周聚会期间进行现金捐款。我们提供奉献袋，方便您注明什一奉献或将捐款指定用于特定的事工类别或本地项目。',
      zelleSection: '电子转账',
      zelleLabel: '直接银行转账',
      zelleTitle: 'Zelle',
      zelleDesc: 'Zelle 电子转账正在建立中。请稍后查看教会账号。',
      zelleButton: 'Zelle (待定)',
      onlineSection: '网上平台',
      onlineLabel: '官方平台',
      onlineTitle: 'AdventistGiving',
      onlineDesc:
        'AdventistGiving 让您无论是在家或在外，都能在线归还什一奉献并进行捐款。',
      onlineButton: 'AdventistGiving',
      quote:
        '万军之耶和华说：你们要将当纳的十分之一全然送入仓库，使我家有粮，以此试试我，是否为你们敞开天上的窗户，倾福与你们，甚至无处可容。',
      quoteRef: '玛拉基书 3:10 (CUVS)',
      taxNote:
        '所有捐款均可扣税。作为注册的 501(c)(3) 非营利组织，我们会在财政年度结束时为所有捐款提供报税收据。',
    },
    es: {
      title: 'Diezmos y Ofrendas',
      cashSection: 'Donaciones en Persona',
      cashLabel: 'Servicio Sabático',
      cashTitle: 'Efectivo',
      cashDesc:
        'Aceptamos donaciones en efectivo durante nuestras reuniones semanales. Se proporcionan sobres para su conveniencia, permitiéndole especificar el diezmo o asignar su donación a diversas categorías de ofrendas y ministerios locales.',
      zelleSection: 'Transferencia Electrónica',
      zelleLabel: 'Transferencia Directa',
      zelleTitle: 'Zelle',
      zelleDesc:
        'Las transferencias electrónicas a través de Zelle se están estableciendo actualmente. Vuelva pronto para ver el identificador.',
      zelleButton: 'Zelle (TBD)',
      onlineSection: 'Portal en Línea',
      onlineLabel: 'Plataforma Oficial',
      onlineTitle: 'AdventistGiving',
      onlineDesc:
        'AdventistGiving le permite devolver su diezmo y dar sus ofrendas en línea mientras está en casa o fuera.',
      onlineButton: 'AdventistGiving',
      quote:
        'Traed todos los diezmos al alfolí, y haya alimento en mi casa; y probadme ahora en esto, dice Jehová de los ejércitos, si no os abriré las ventanas de los cielos, y vaciaré sobre vosotros bendición hasta que sobreabunde.',
      quoteRef: 'Malaquías 3:10 (RVR1960)',
      taxNote:
        'Todas las donaciones son deducibles de impuestos. Como organización sin fines de lucro 501(c)(3) registrada, emitimos recibos de impuestos por todas las contribuciones al final del año fiscal.',
    },
  };

  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;

  return (
    <>
      <Stack.Screen options={{ title: labels.title, showTitleChip: showHeaderTitle } as any} />
      <ScrollView
        style={DocumentStyles.container}
        onScroll={handleHeroScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: 0 }}
      >
        <VerseHero
          title={labels.title}
          verse={labels.quote}
          reference={labels.quoteRef}
          imageSource={{ uri: CHURCH_BUILDING_IMAGE_URL }}
          verseColors={theme.dark
            ? ['#123831', '#164C43', '#1B5E52']
            : ['#064E3B', '#0F766E', '#0D9488']}
        />

        {/* Body */}
        <View style={DocumentStyles.section}>
          <Text
            variant="bodySmall"
            style={[
              DocumentStyles.note,
              { color: theme.colors.onSurfaceVariant, marginTop: 0 },
            ]}
          >
            {labels.taxNote}
          </Text>
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
            {labels.onlineSection}
          </Text>
          <Card style={[DocumentStyles.card, DocumentStyles.orgCard]} mode="outlined">
            <Card.Content>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {labels.onlineLabel}
              </Text>
              <Text
                variant="titleLarge"
                style={[DocumentStyles.orgName, { color: theme.colors.onSurface }]}
              >
                {labels.onlineTitle}
              </Text>
              <Text
                style={[
                  DocumentStyles.description,
                  DocumentStyles.orgDesc,
                  { color: theme.colors.onSurface },
                ]}
                variant="bodyMedium"
              >
                {labels.onlineDesc}
              </Text>
            </Card.Content>
            <Card.Actions>
              <Button
                mode="contained"
                icon="open-in-new"
                buttonColor={theme.colors.primary}
                textColor={theme.colors.onPrimary}
                onPress={openAdventistGiving}
              >
                {labels.onlineButton}
              </Button>
            </Card.Actions>
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
            {labels.zelleSection}
          </Text>
          <Card style={[DocumentStyles.card, DocumentStyles.orgCard]} mode="outlined">
            <Card.Content>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {labels.zelleLabel}
              </Text>
              <Text
                variant="titleLarge"
                style={[DocumentStyles.orgName, { color: theme.colors.onSurface }]}
              >
                {labels.zelleTitle}
              </Text>
              <Text
                style={[
                  DocumentStyles.description,
                  DocumentStyles.orgDesc,
                  { color: theme.colors.onSurface },
                ]}
                variant="bodyMedium"
              >
                {labels.zelleDesc}
              </Text>
            </Card.Content>
            <Card.Actions>
              <Button
                mode="contained"
                icon="bank-transfer"
                disabled
                buttonColor={theme.colors.surfaceVariant}
                textColor={theme.colors.onSurfaceVariant}
              >
                {labels.zelleButton}
              </Button>
            </Card.Actions>
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
            {labels.cashSection}
          </Text>
          <Card style={[DocumentStyles.card, DocumentStyles.orgCard]} mode="outlined">
            <Card.Content>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {labels.cashLabel}
              </Text>
              <Text
                variant="titleLarge"
                style={[DocumentStyles.orgName, { color: theme.colors.onSurface }]}
              >
                {labels.cashTitle}
              </Text>
              <Text
                style={[
                  DocumentStyles.description,
                  DocumentStyles.orgDesc,
                  { color: theme.colors.onSurface },
                ]}
                variant="bodyMedium"
              >
                {labels.cashDesc}
              </Text>
            </Card.Content>
          </Card>
        </View>
      </ScrollView>
    </>
  );
}
