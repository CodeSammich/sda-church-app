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
        'We welcome cash donations during our weekly meetings. Please write your name in English on the envelope. Envelopes are provided for your convenience to specify tithe or designate your gift to various offering categories and local ministries.',
      zelleSection: 'Electronic Transfer',
      zelleLabel: 'Direct Bank Transfer',
      zelleTitle: 'Zelle',
      zelleDesc:
        'Send your Zelle donation to zelle@nyccsda.org.',
      onlineSection: 'Online Portal',
      onlineLabel: 'Official Platform',
      onlineTitle: 'Online Giving',
      onlineDesc:
        'Our online giving portal lets you return tithe and give offerings by ACH bank transfer or by credit/debit card from home or on the go. Payment details are entered on the external website, not in this app.',
      onlineButton: 'Give Online',
      externalNote: 'External donation portal',
      dafSection: 'Donor-Advised Fund',
      dafLabel: 'Fidelity Charitable',
      dafTitle: 'Stocks/Equities',
      dafDesc:
        'We prefer Fidelity Charitable. If you already know how to recommend a grant, direct it to New York Chinese Seventh-day Adventist Church using EIN 11-3004814. For Charles Schwab Charitable, Vanguard Charitable, or another charitable sponsor or brokerage, please contact church staff in advance.',
      quote:
        'Bring the full tithe into the storehouse, so that there may be food in My house. Test Me in this,” says the Lord of Hosts. “See if I will not open the windows of heaven and pour out for you blessing without measure.',
      quoteRef: 'Malachi 3:10 (BSB)',
    },
    zh: {
      title: '奉獻',
      cashSection: '現場奉獻',
      cashLabel: '安息日聚會',
      cashTitle: '現金',
      cashDesc:
        '我們歡迎在每週聚會期間進行現金捐款。請在奉獻袋上用英文寫下您的姓名。我們提供奉獻袋，方便您註明什一奉獻或將捐款指定用於特定的事工類別或在地項目。',
      zelleSection: '電子轉賬',
      zelleLabel: '直接銀行轉賬',
      zelleTitle: 'Zelle',
      zelleDesc: '請將 Zelle 奉獻發送至 zelle@nyccsda.org。',
      onlineSection: '網上平台',
      onlineLabel: '官方平台',
      onlineTitle: '網上奉獻',
      onlineDesc:
        '我們的網上奉獻平台讓您可以在家中或外出時，透過 ACH 銀行轉賬或信用卡／扣賬卡歸還什一奉獻及進行其他奉獻。付款資料會在外部網站輸入，而不是在本應用程式中輸入。',
      onlineButton: '網上奉獻',
      externalNote: '外部捐款平台',
      dafSection: '捐贈者建議基金',
      dafLabel: 'Fidelity Charitable',
      dafTitle: '股票／證券',
      dafDesc:
        '本教會較偏好使用 Fidelity Charitable。如您已知道如何建議撥款，請將撥款指定給紐約華人基督復臨安息日會，並使用 EIN 11-3004814。如要使用 Charles Schwab Charitable、Vanguard Charitable 或其他慈善贊助機構或券商，請提前聯絡教會同工。',
      quote:
        '萬軍之耶和華說：你們要將當納的十分之一全然送入倉庫，使我家有糧，以此試試我，是否為你們敞開天上的窗戶，傾福與你們，甚至無處可容。',
      quoteRef: '瑪拉基書 3:10 (CUV)',
    },
    'zh-cn': {
      title: '奉献',
      cashSection: '现场奉献',
      cashLabel: '安息日聚会',
      cashTitle: '现金',
      cashDesc:
        '我们欢迎在每周聚会期间进行现金捐款。请在奉献袋上用英文写下您的姓名。我们提供奉献袋，方便您注明什一奉献或将捐款指定用于特定的事工类别或本地项目。',
      zelleSection: '电子转账',
      zelleLabel: '直接银行转账',
      zelleTitle: 'Zelle',
      zelleDesc: '请将 Zelle 奉献发送至 zelle@nyccsda.org。',
      onlineSection: '网上平台',
      onlineLabel: '官方平台',
      onlineTitle: '网上奉献',
      onlineDesc:
        '我们的网上奉献平台让您可以在家中或外出时，通过 ACH 银行转账或信用卡／借记卡归还什一奉献及进行其他奉献。付款资料会在外部网站输入，而不是在本应用程序中输入。',
      onlineButton: '网上奉献',
      externalNote: '外部捐款平台',
      dafSection: '捐赠者建议基金',
      dafLabel: 'Fidelity Charitable',
      dafTitle: '股票／证券',
      dafDesc:
        '本教会更倾向使用 Fidelity Charitable。如您已知道如何建议拨款，请将拨款指定给纽约华人基督复临安息日会，并使用 EIN 11-3004814。如要使用 Charles Schwab Charitable、Vanguard Charitable 或其他慈善赞助机构或券商，请提前联系教会同工。',
      quote:
        '万军之耶和华说：你们要将当纳的十分之一全然送入仓库，使我家有粮，以此试试我，是否为你们敞开天上的窗户，倾福与你们，甚至无处可容。',
      quoteRef: '玛拉基书 3:10 (CUVS)',
    },
    es: {
      title: 'Diezmos y Ofrendas',
      cashSection: 'Donaciones en Persona',
      cashLabel: 'Servicio Sabático',
      cashTitle: 'Efectivo',
      cashDesc:
        'Aceptamos donaciones en efectivo durante nuestras reuniones semanales. Escriba su nombre en inglés en el sobre. Se proporcionan sobres para su conveniencia, permitiéndole especificar el diezmo o asignar su donación a diversas categorías de ofrendas y ministerios locales.',
      zelleSection: 'Transferencia Electrónica',
      zelleLabel: 'Transferencia Directa',
      zelleTitle: 'Zelle',
      zelleDesc:
        'Envíe su donación por Zelle a zelle@nyccsda.org.',
      onlineSection: 'Portal en Línea',
      onlineLabel: 'Plataforma Oficial',
      onlineTitle: 'Donaciones en línea',
      onlineDesc:
        'Nuestro portal de donaciones en línea le permite devolver el diezmo y hacer ofrendas mediante transferencia bancaria ACH o tarjeta de crédito/débito desde casa o mientras está fuera. Los datos de pago se introducen en el sitio web externo, no en esta aplicación.',
      onlineButton: 'Donar en línea',
      externalNote: 'Portal externo de donaciones',
      dafSection: 'Fondo asesorado por donantes',
      dafLabel: 'Fidelity Charitable',
      dafTitle: 'Acciones/Valores',
      dafDesc:
        'Preferimos Fidelity Charitable. Si ya sabe cómo recomendar una donación, diríjala a New York Chinese Seventh-day Adventist Church usando el EIN 11-3004814. Para Charles Schwab Charitable, Vanguard Charitable u otra organización patrocinadora o casa de corretaje, comuníquese con el personal de la iglesia con anticipación.',
      quote:
        'Traed todos los diezmos al alfolí, y haya alimento en mi casa; y probadme ahora en esto, dice Jehová de los ejércitos, si no os abriré las ventanas de los cielos, y vaciaré sobre vosotros bendición hasta que sobreabunde.',
      quoteRef: 'Malaquías 3:10 (RVR1960)',
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
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
              >
                {labels.externalNote}
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
            {labels.dafSection}
          </Text>
          <Card style={[DocumentStyles.card, DocumentStyles.orgCard]} mode="outlined">
            <Card.Content>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {labels.dafLabel}
              </Text>
              <Text
                variant="titleLarge"
                style={[DocumentStyles.orgName, { color: theme.colors.onSurface }]}
              >
                {labels.dafTitle}
              </Text>
              <Text
                style={[
                  DocumentStyles.description,
                  DocumentStyles.orgDesc,
                  { color: theme.colors.onSurface },
                ]}
                variant="bodyMedium"
              >
                {labels.dafDesc}
              </Text>
            </Card.Content>
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
