import { MenuCard } from '@/components/MenuCard';
import { VerseHero } from '@/components/VerseHero';
import {
  CHURCH_EMAIL,
  CHURCH_PHONE,
  ELMHURST_SABBATH_URLS,
  FELLOWSHIP_IMAGES_URLS,
  FOOD_BANK_IMAGE_URL,
  openEmail,
  openPhone,
  openZoomClass,
} from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { useHeroHeaderTitle } from '@/hooks/useHeroHeaderTitle';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useContext } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Divider, List, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const allLabels = {
  en: {
    title: 'Fellowships & Food',
    expansionVerse: '“For I was hungry and you gave me something to eat, I was thirsty and you gave me something to drink, I was a stranger and you invited me in, I needed clothes and you clothed me, I was sick and you looked after me, I was in prison and you came to visit me.”',
    expansionRef: 'Matthew 25:35-36 (NIV)',
    foodBankTitle: 'Food Bank Partnership',
    foodBankDesc: 'We are actively seeking partnerships to expand our food bank program, with the goal of providing free meals to our neighbors and local communities. If you are interested in partnering with us, please don’t hesitate to reach out!',
    elmhurstHeader: 'Elmhurst, Queens',
    elmhurstVerse: '“These commandments that I give you today are to be on your hearts. Impress them on your children. Talk about them when you sit at home and when you walk along the road, when you lie down and when you get up.”',
    elmhurstRef: 'Deuteronomy 6:6-7 (NIV)',
    elmhurstDesc: 'In Elmhurst, we offer vibrant in-person ministries for young adults, providing opportunities for spiritual growth, fellowship, and community engagement. Our young adult’s ministry focuses on nurturing faith through interactive learning and activities, deepening our relationship with God. All services at this location are offered in Chinese and English.',
    elmhurstWorshipTitle: 'Sabbath Worship',
    elmhurstWorshipDesc: 'Saturday: 10:00 AM - 1:00 PM • Join us for song service, Sabbath school, and our weekly main worship service.',
    viewSchedule: 'Schedule',
    elmhurstEventsTitle: 'Seasonal Events & Activities',
    elmhurstEventsDesc: 'In addition to Bible study and spiritual growth, we host seasonal events for young adults, such as summer & winter camps, skiing trips, camping outings, barbecues, and various other fun activities that foster bonding and personal development.',
    elmhurstOnlineTitle: 'Weekday Mandarin Ministries',
    elmhurstOnlineDesc: 'Throughout the week, we provide Mandarin online ministries through WeChat and Zoom for adults, offering a virtual space for Bible study, prayer, and community connection for those who cannot attend in person.',
    elmhurstBaptismTitle: 'Baptism Classes',
    elmhurstBaptismDesc: 'We also offer baptism classes for those who are willing and ready to give their life to Christ, guiding you through the steps of faith and commitment.',
    elmhurstOutreach: 'We encourage you to reach out if you have any questions or would like to get involved. We are here to support you on your spiritual journey.',
    flushingHeader: 'Flushing, Queens',
    flushingVerse: '“That each of them may eat and drink, and find satisfaction in all their toil — this is the gift of God.”',
    flushingRef: 'Ecclesiastes 3:13 (NIV)',
    flushingDesc: 'In Flushing, we hold a Mandarin-only gathering. This gathering offers a space for fellowship, Bible study, and spiritual growth in a Mandarin-speaking environment.',
    flushingWeeklyTitle: 'Mandarin-Only Gathering',
    flushingWeeklyDesc: 'Thursday: 6:30 - 9:00 PM • Basement',
    flushingMealTitle: 'Fellowship Meal',
    flushingMealDesc: 'Thursday: 6:30 - 7:30 PM • Basement',
    flushingTestimonyTitle: 'Testimony & Sharing',
    flushingTestimonyDesc: 'Thursday: 7:30 - 8:00 PM • Basement',
    flushingSermonTitle: 'Sermon & Bible Study',
    flushingSermonDesc: 'Thursday: 8:00 - 9:00 PM • Basement',
    flushingMealsTitle: 'Free Fellowship Meals',
    flushingMealsDesc: 'We provide individual meals free of charge during the gathering, but preregistration is required to ensure we order enough catering for everyone. Please connect with us if you would like to join us or have any questions.',
    contactUs: 'Contact Us',
    partnerWithUs: 'Partner With Us',
    joinZoom: 'Join on Zoom',
    emailUs: 'Email Us',
    callUs: 'Call Us',
  },
  zh: {
    title: '團契與食品事工',
    expansionVerse: '「因為我餓了，你們給我吃；渴了，你們給我喝；我作客旅，你們留我住；我赤身露體，你們給我穿；我病了，你們看顧我；我在監裡，你們來看我。」',
    expansionRef: '馬太福音 25:35-36 (CUV)',
    foodBankTitle: '食品庫夥伴關係',
    foodBankDesc: '我們正積極尋求合作夥伴以擴大我們的食品庫計劃，目標是向鄰里和當地社區提供免費膳食。如果您有興趣與我們合作，請隨時與我們聯繫！',
    elmhurstHeader: '艾姆赫斯特 (Queens)',
    elmhurstVerse: '「我今日所吩咐你的話都要記在心上，也要慇勤教訓你的兒女。無論你坐在家裡，行在路上，躺下，起來，都要談論。」',
    elmhurstRef: '申命記 6:6-7 (CUV)',
    elmhurstDesc: '在艾姆赫斯特，我們為年輕人提供充滿活力的實體事工，提供屬靈成長、團契和社區參與的機會。我們的青年事工專注於透過互動學習和活動來培育信仰，深化我們與上帝的關係。該地點的所有服務均提供中文和英文。',
    elmhurstWorshipTitle: '安息日崇拜',
    elmhurstWorshipDesc: '星期六上午 10:00 - 下午 1:00 • 歡迎參加我們的讚美詩歌、安息日學與每週的主日崇拜服務。',
    viewSchedule: '時間表',
    elmhurstEventsTitle: '季節性活動與項目',
    elmhurstEventsDesc: '除了查經和屬靈成長外，我們還為年輕人舉辦季節性活動，例如夏令營和冬令營、滑雪之旅、野營活動、燒烤以及其他各種有助於促進情感聯繫和個人發展的趣味活動。',
    elmhurstOnlineTitle: '線上與週間事工',
    elmhurstOnlineDesc: '在整個星期中，我們透過微信和 Zoom 為成人提供國語線上事工，為無法親自前來的人提供查經、禱告和社區聯結的虛擬空間。',
    elmhurstBaptismTitle: '洗禮班',
    elmhurstBaptismDesc: '我們也為願意並準備好將生命獻給基督的人提供洗禮班，引導您走過信仰與承諾的步驟。',
    elmhurstOutreach: '如果您有任何問題或想參與其中，我們鼓勵您與我們聯繫。我們在這裡支持您的屬靈旅程。',
    flushingHeader: '法拉盛 (Queens)',
    flushingVerse: '「並且人人吃喝，在他一切勞碌中享福，這也是神的恩賜。」',
    flushingRef: '傳道書 3:13 (CUV)',
    flushingDesc: '在法拉盛，我們舉辦僅限國語的聚會。此聚會在國語環境中為團契、查經和屬靈成長提供空間。',
    flushingWeeklyTitle: '國語聚會',
    flushingWeeklyDesc: '星期四晚上 6:30 - 9:00 • 地下室',
    flushingMealTitle: '團契晚餐',
    flushingMealDesc: '星期四晚上 6:30 - 7:30 • 地下室',
    flushingTestimonyTitle: '見證分享',
    flushingTestimonyDesc: '星期四晚上 7:30 - 8:00 • 地下室',
    flushingSermonTitle: '證道與查經',
    flushingSermonDesc: '星期四晚上 8:00 - 9:00 • 地下室',
    flushingMealsTitle: '免費團契晚餐',
    flushingMealsDesc: '我們在聚會期間免費提供個人膳食，但需要提前登記，以確保我們為大家訂購足夠的餐飲。如果您想加入我們或有任何疑問，請與我們聯繫。',
    contactUs: '聯繫我們',
    partnerWithUs: '成為合作夥伴',
    joinZoom: '加入 Zoom 線上聚會',
    emailUs: '發送電子郵件',
    callUs: '撥打電話',
  },
  'zh-cn': {
    title: '团契与食品事工',
    expansionVerse: '“因为我饿了，你们给我吃；渴了，你们给我喝；我作客旅，你们留我住；我赤身露体，你们给我穿；我病了，你们看顾我；我在监里，你们来看我。”',
    expansionRef: '马太福音 25:35-36 (CUVS)',
    foodBankTitle: '食品库合作伙伴关系',
    foodBankDesc: '我们正积极寻求合作伙伴以扩大我们的食品库计划，目标是向邻里和当地社区提供免费膳食。如果您有兴趣与我们合作，请随时与我们联系！',
    elmhurstHeader: '艾姆赫斯特 (Queens)',
    elmhurstVerse: '“我今日所吩咐你的话都要记在心上，也要殷勤教训你的儿女。无论你坐在家里，行在路上，躺下，起来，都要谈论。”',
    elmhurstRef: '申命记 6:6-7 (CUVS)',
    elmhurstDesc: '在艾姆赫斯特，我们为年轻人提供充满活力的实体事工，提供属灵成长、团契 and 社区参与的机会。我们的青年事工专注于通过互动学习和活动来培育信仰，深化我们与上帝的关系。该地点的所有服务均提供中文和英文。',
    elmhurstWorshipTitle: '安息日崇拜',
    elmhurstWorshipDesc: '星期六上午 10:00 - 下午 1:00 • 欢迎参加我们的赞美诗歌、安息日学与每周的主日崇拜服务。',
    viewSchedule: '时间表',
    elmhurstEventsTitle: '季节性活动与项目',
    elmhurstEventsDesc: '除了查经和属灵成长外，我们还为年轻人举办季节性活动，例如夏令营和冬令营、滑雪之旅、野营活动、烧烤以及其他各种有助于促进情感联系和个人发展的趣味活动。',
    elmhurstOnlineTitle: '线上与周间事工',
    elmhurstOnlineDesc: '在整个星期中，我们通过微信和 Zoom 为成人提供国语线上事工，为无法亲自前来的人提供虚拟空间。',
    elmhurstBaptismTitle: '洗礼班',
    elmhurstBaptismDesc: '我们也为愿意并准备好将生命献给基督的人提供洗礼班，引导您走过信仰与承诺的步骤。',
    elmhurstOutreach: '如果您有任何问题或想参与其中，我们鼓励您与我们联系。我们在这里支持您的属灵旅程。',
    flushingHeader: '法拉盛 (Queens)',
    flushingVerse: '“并且人人吃喝，在他一切劳碌中享福，这也是神的赐予。”',
    flushingRef: '传道书 3:13 (CUVS)',
    flushingDesc: '在法拉盛，我们举办仅限国语的聚会。此聚会在国语环境中为团契、查经和属灵成长提供空间。',
    flushingWeeklyTitle: '国语聚会',
    flushingWeeklyDesc: '星期四晚上 6:30 - 9:00 • 地下室',
    flushingMealTitle: '团契晚餐',
    flushingMealDesc: '星期四晚上 6:30 - 7:30 • 地下室',
    flushingTestimonyTitle: '见证分享',
    flushingTestimonyDesc: '星期四晚上 7:30 - 8:00 • 地下室',
    flushingSermonTitle: '证道与查经',
    flushingSermonDesc: '星期四晚上 8:00 - 9:00 • 地下室',
    flushingMealsTitle: '免费团契晚餐',
    flushingMealsDesc: '我们在聚会期间免费提供个人膳食，但需要提前登记，以确保为大家订购足够的餐饮。如果您想加入我们或有任何疑问，请与我们联系。',
    contactUs: '联系我们',
    partnerWithUs: '成为合作伙伴',
    joinZoom: '加入 Zoom 线上聚会',
    emailUs: '发送电子邮件',
    callUs: '拨打电话',
  },
  es: {
    title: 'Compañerismo y Alimentos',
    expansionVerse: '“Porque tuve hambre, y me disteis de comer; tuve sed, y me disteis de beber; fui forastero, y me recogisteis; estuve desnudo, y me cubristeis; enfermo, y me visitasteis; en la cárcel, y vinisteis a mí.”',
    expansionRef: 'Mateo 25:35-36 (RVR1960)',
    foodBankTitle: 'Asociación del Banco de Alimentos',
    foodBankDesc: 'Buscamos activamente asociaciones para expandir nuestro programa de banco de alimentos, con el objetivo de proporcionar comidas gratuitas a nuestros vecinos y comunidades locales. Si está interesado en asociarse con nosotros, ¡no dude en contactarnos!',
    elmhurstHeader: 'Elmhurst, Queens',
    elmhurstVerse: '“Y estas palabras que yo te mando hoy, estarán sobre tu corazón; y las repetirás a tus hijos, y hablarás de ellas estando en tu casa, y andando por el camino, y al acostarte, y cuando te levantes.”',
    elmhurstRef: 'Deuteronomio 6:6-7 (RVR1960)',
    elmhurstDesc: 'En Elmhurst, ofrecemos ministerios presenciales vibrantes para jóvenes adultos, brindando oportunidades para el crecimiento espiritual, el compañerismo y el compromiso comunitario. Nuestro ministerio de jóvenes adultos se enfoca en nutrir la fe a través del aprendizaje interactivo y actividades, profundizando nuestra relación con Dios. Todos los servicios en esta ubicación se ofrecen en chino e inglés.',
    elmhurstWorshipTitle: 'Adoración Sabática',
    elmhurstWorshipDesc: 'Sábado: 10:00 AM - 1:00 PM • Únase a nosotros para el servicio de canto, escuela sabática y nuestro servicio principal de adoración semanal.',
    viewSchedule: 'Horario',
    elmhurstEventsTitle: 'Eventos y Actividades Estacionales',
    elmhurstEventsDesc: 'Además del estudio bíblico y el crecimiento espiritual, organizamos eventos estacionales para jóvenes adultos, como campamentos de verano e invierno, viajes de esquí, salidas de campamento, barbacoas y otras actividades divertidas que fomentan la unión y el desarrollo personal.',
    elmhurstOnlineTitle: 'Ministerios en Línea de Entresemana',
    elmhurstOnlineDesc: 'A lo largo de la semana, ofrecemos ministerios en línea en mandarín a través de WeChat y Zoom para adultos, brindando un espacio virtual para el estudio de la Biblia, la oración y la conexión comunitaria para aquellos que no pueden asistir en persona.',
    elmhurstBaptismTitle: 'Clases de Bautismo',
    elmhurstBaptismDesc: 'También ofrecemos clases de bautismo para aquellos que están dispuestos y listos para entregar su vida a Cristo, guiándolos a través de los pasos de la fe y el compromiso.',
    elmhurstOutreach: 'Le animamos a ponerse en contacto si tiene alguna pregunta o desea participar. Estamos aquí para apoyarle en su camino espiritual.',
    flushingHeader: 'Flushing, Queens',
    flushingVerse: '“Y también que es don de Dios que todo hombre coma y beba, y goce el bien de toda su labor.”',
    flushingRef: 'Eclesiastés 3:13 (RVR1960)',
    flushingDesc: 'En Flushing, llevamos a cabo una reunión exclusiva en mandarín. Esta reunión ofrece un espacio para el compañerismo, el estudio de la Biblia y el crecimiento espiritual en un ambiente de habla mandarín.',
    flushingWeeklyTitle: 'Reunión en Mandarín',
    flushingWeeklyDesc: 'Jueves: 6:30 - 9:00 PM • Sótano',
    flushingMealTitle: 'Comida de Compañerismo',
    flushingMealDesc: 'Jueves: 6:30 - 7:30 PM • Sótano',
    flushingTestimonyTitle: 'Testimonio y Compartir',
    flushingTestimonyDesc: 'Jueves: 7:30 - 8:00 PM • Sótano',
    flushingSermonTitle: 'Sermón y Estudio Bíblico',
    flushingSermonDesc: 'Jueves: 8:00 - 9:00 PM • Sótano',
    flushingMealsTitle: 'Comidas Gratuitas de Compañerismo',
    flushingMealsDesc: 'Ofrecemos comidas individuales de forma gratuita durante la reunión, pero se requiere inscripción previa para garantizar que ordenemos suficiente comida para todos. Por favor, comuníquese con nosotros si desea unirse o si tiene alguna pregunta.',
    contactUs: 'Contáctenos',
    partnerWithUs: 'Asóciese con Nosotros',
    joinZoom: 'Unirse a Zoom',
    emailUs: 'Enviar Correo',
    callUs: 'Llamar por Teléfono',
  },
};

export default function FellowshipsAndFoodScreen() {
  const theme = useAppTheme();
  const { language } = useContext(LanguageContext);
  const { backTo } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { showHeaderTitle, handleHeroScroll } = useHeroHeaderTitle();

  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;

  return (
    <>
      <Stack.Screen
        options={{ title: labels.title, backTo, showTitleChip: showHeaderTitle } as any}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        onScroll={handleHeroScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 40,
        }}
      >
        <VerseHero
          title={labels.title}
          verse={labels.expansionVerse}
          reference={labels.expansionRef}
          imageSource={{ uri: FELLOWSHIP_IMAGES_URLS[0] }}
          verseColors={theme.dark
            ? ['#241C3D', '#38245E', '#44306B']
            : ['#312E81', '#5B21B6', '#7C3AED']}
        />

        {/* Content Body */}
        <View style={styles.body}>
          {/* Food Bank Program */}
          <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} mode="outlined">
            <Card.Cover source={{ uri: FOOD_BANK_IMAGE_URL }} style={styles.cardCover} />
            <Card.Content style={styles.cardContent}>
              <Text
                variant="titleMedium"
                style={[styles.cardSectionTitle, { color: theme.colors.onSurface }]}
              >
                {labels.foodBankTitle}
              </Text>
              <Text
                variant="bodyMedium"
                style={[styles.cardDescription, { color: theme.colors.onSurfaceVariant }]}
              >
                {labels.foodBankDesc}
              </Text>
            </Card.Content>
            <Card.Actions style={styles.actionsRow}>
              <Button
                icon="email-outline"
                mode="contained"
                onPress={() => openEmail(CHURCH_EMAIL)}
                style={[styles.actionButton, { backgroundColor: theme.colors.tertiary }]}
                labelStyle={{ color: theme.colors.onSecondary }}
              >
                {labels.emailUs}
              </Button>
              <Button
                icon="phone"
                mode="outlined"
                onPress={() => openPhone(CHURCH_PHONE)}
                style={[styles.actionButton, { borderColor: theme.colors.tertiary }]}
                textColor={theme.colors.tertiary}
              >
                {labels.callUs}
              </Button>
            </Card.Actions>
          </Card>

          {/* Section 2: Elmhurst, Queens */}
          <View style={styles.sectionHeaderContainer}>
            <Text variant="titleLarge" style={[styles.sectionHeading, { color: theme.colors.onBackground }]}>
              {labels.elmhurstHeader}
            </Text>
            <Divider style={styles.headingDivider} />
          </View>

          <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} mode="outlined">
            <Card.Cover source={{ uri: ELMHURST_SABBATH_URLS[0] }} style={styles.cardCover} />
            <Card.Content style={styles.cardContent}>
              {/* Verse Card */}
              <View style={[styles.verseCard, { backgroundColor: theme.colors.surfaceVariant, borderLeftColor: theme.colors.tertiary }]}>
                <Text variant="bodyMedium" style={[styles.verseText, { color: theme.colors.onSurfaceVariant }]}>
                  {labels.elmhurstVerse}
                </Text>
                <Text variant="labelSmall" style={[styles.verseRef, { color: theme.colors.onSurfaceVariant }]}>
                  — {labels.elmhurstRef}
                </Text>
              </View>

              <Text variant="bodyMedium" style={[styles.cardDescription, { color: theme.colors.onSurfaceVariant, marginBottom: 16 }]}>
                {labels.elmhurstDesc}
              </Text>

              {/* Elmhurst Details */}
              <List.Section style={{ marginVertical: 0 }}>
                <List.Item
                  title={labels.elmhurstWorshipTitle}
                  titleStyle={styles.listItemTitle}
                  description={() => (
                    <View style={styles.listItemDescContainer}>
                      <Text style={[styles.listItemDesc, { color: theme.colors.onSurfaceVariant }]}>
                        {labels.elmhurstWorshipDesc}
                      </Text>
                    </View>
                  )}
                  descriptionNumberOfLines={20}
                  left={(props) => <List.Icon {...props} icon="church" color={theme.colors.tertiary} />}
                  onPress={() => router.push({
                    pathname: '/community/worship',
                    params: { backTo: '/community/fellowship' },
                  } as any)}
                />
                <Divider style={styles.listItemDivider} />
                <List.Item
                  title={labels.elmhurstEventsTitle}
                  titleStyle={styles.listItemTitle}
                  description={labels.elmhurstEventsDesc}
                  descriptionStyle={styles.listItemDesc}
                  descriptionNumberOfLines={10}
                  left={(props) => <List.Icon {...props} icon="compass-outline" color={theme.colors.tertiary} />}
                />
                <Divider style={styles.listItemDivider} />
                <List.Item
                  title={labels.elmhurstOnlineTitle}
                  titleStyle={styles.listItemTitle}
                  description={() => (
                    <View style={styles.listItemDescContainer}>
                      <Text style={[styles.listItemDesc, { color: theme.colors.onSurfaceVariant }]}>
                        {labels.elmhurstOnlineDesc}
                      </Text>
                      <Button 
                        mode="contained" 
                        onPress={openZoomClass}
                        buttonColor={theme.colors.brandZoom}
                        textColor={theme.colors.onSecondary}
                        style={styles.descriptionButton}
                        labelStyle={styles.descriptionButtonLabel}
                      >
                        Zoom
                      </Button>
                    </View>
                  )}
                  descriptionNumberOfLines={10}
                  left={(props) => <List.Icon {...props} icon="laptop" color={theme.colors.tertiary} />}
                />
                <Divider style={styles.listItemDivider} />
                <List.Item
                  title={labels.elmhurstBaptismTitle}
                  titleStyle={styles.listItemTitle}
                  description={labels.elmhurstBaptismDesc}
                  descriptionStyle={styles.listItemDesc}
                  descriptionNumberOfLines={10}
                  left={(props) => <List.Icon {...props} icon="water-outline" color={theme.colors.tertiary} />}
                />
              </List.Section>

              <Text variant="bodyMedium" style={[styles.outreachText, { color: theme.colors.onSurface }]}>
                {labels.elmhurstOutreach}
              </Text>
            </Card.Content>
            <Card.Actions style={styles.actionsRow}>
              <Button
                icon="email-outline"
                mode="contained"
                onPress={() => openEmail(CHURCH_EMAIL)}
                style={[styles.actionButton, { backgroundColor: theme.colors.tertiary }]}
                labelStyle={{ color: theme.colors.onSecondary }}
              >
                {labels.emailUs}
              </Button>
              <Button
                icon="phone"
                mode="outlined"
                onPress={() => openPhone(CHURCH_PHONE)}
                style={[styles.actionButton, { borderColor: theme.colors.tertiary }]}
                textColor={theme.colors.tertiary}
              >
                {labels.callUs}
              </Button>
            </Card.Actions>
          </Card>

          {/* Section 3: Flushing, Queens */}
          <View style={styles.sectionHeaderContainer}>
            <Text variant="titleLarge" style={[styles.sectionHeading, { color: theme.colors.onBackground }]}>
              {labels.flushingHeader}
            </Text>
            <Divider style={styles.headingDivider} />
          </View>

          <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} mode="outlined">
            <Card.Cover source={{ uri: FELLOWSHIP_IMAGES_URLS[1] }} style={styles.cardCover} />
            <Card.Content style={styles.cardContent}>
              {/* Verse Card */}
              <View style={[styles.verseCard, { backgroundColor: theme.colors.surfaceVariant, borderLeftColor: theme.colors.tertiary }]}>
                <Text variant="bodyMedium" style={[styles.verseText, { color: theme.colors.onSurfaceVariant }]}>
                  {labels.flushingVerse}
                </Text>
                <Text variant="labelSmall" style={[styles.verseRef, { color: theme.colors.onSurfaceVariant }]}>
                  — {labels.flushingRef}
                </Text>
              </View>

              <Text variant="bodyMedium" style={[styles.cardDescription, { color: theme.colors.onSurfaceVariant, marginBottom: 16 }]}>
                {labels.flushingDesc}
              </Text>

              {/* Flushing Gathering Blocks */}
              <View style={{ gap: 10, marginBottom: 16 }}>
                <MenuCard
                  title={labels.flushingMealTitle}
                  description={labels.flushingMealDesc}
                  icon="silverware-fork-knife"
                  iconColor={theme.colors.tertiary}
                  rightIcon={null}
                />
                <MenuCard
                  title={labels.flushingTestimonyTitle}
                  description={labels.flushingTestimonyDesc}
                  icon="account-group"
                  iconColor={theme.colors.tertiary}
                  rightIcon={null}
                />
                <MenuCard
                  title={labels.flushingSermonTitle}
                  description={labels.flushingSermonDesc}
                  icon="book-open-page-variant"
                  iconColor={theme.colors.tertiary}
                  rightIcon={null}
                />
              </View>

              <View style={[styles.mealsNotice, { backgroundColor: theme.colors.primaryContainer, borderColor: theme.colors.outlineVariant }]}>
                <Text variant="titleMedium" style={{ fontWeight: 'bold', color: theme.colors.onPrimaryContainer, marginBottom: 4 }}>
                  {labels.flushingMealsTitle}
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 20 }}>
                  {labels.flushingMealsDesc}
                </Text>
              </View>
            </Card.Content>
            <Card.Actions style={styles.actionsRow}>
              <Button
                icon="email-outline"
                mode="contained"
                onPress={() => openEmail(CHURCH_EMAIL)}
                style={[styles.actionButton, { backgroundColor: theme.colors.tertiary }]}
                labelStyle={{ color: theme.colors.onSecondary }}
              >
                {labels.emailUs}
              </Button>
              <Button
                icon="phone"
                mode="outlined"
                onPress={() => openPhone(CHURCH_PHONE)}
                style={[styles.actionButton, { borderColor: theme.colors.tertiary }]}
                textColor={theme.colors.tertiary}
              >
                {labels.callUs}
              </Button>
            </Card.Actions>
          </Card>

        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    minHeight: 250,
    justifyContent: 'center',
  },
  heroContent: {
    zIndex: 1,
  },
  heroTitle: {
    fontWeight: 'bold',
    fontSize: 28,
    lineHeight: 36,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  quoteContainer: {
    marginTop: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 12,
    borderRadius: 8,
  },
  heroQuote: {
    fontStyle: 'italic',
    lineHeight: 20,
    fontSize: 14,
  },
  heroRef: {
    textAlign: 'right',
    marginTop: 6,
    fontWeight: 'bold',
    fontSize: 12,
  },
  body: {
    padding: 16,
  },
  sectionCard: {
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardCover: {
    height: 180,
  },
  cardContent: {
    paddingTop: 16,
  },
  cardSectionTitle: {
    fontWeight: 'bold',
    fontSize: 20,
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 15,
    lineHeight: 22,
  },
  verseCard: {
    borderLeftWidth: 4,
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  verseText: {
    fontStyle: 'italic',
    lineHeight: 20,
  },
  verseRef: {
    textAlign: 'right',
    marginTop: 6,
    fontWeight: 'bold',
  },
  listItemTitle: {
    fontWeight: '700',
    fontSize: 15,
  },
  listItemDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  listItemDivider: {
    marginVertical: 4,
    opacity: 0.5,
  },
  listItemDescContainer: {
    marginTop: 6,
  },
  descriptionButton: {
    marginTop: 10,
    alignSelf: 'stretch',
    borderRadius: 8,
  },
  descriptionButtonLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  outreachText: {
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
    marginTop: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  mealsNotice: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  actionsRow: {
    justifyContent: 'space-between',
    padding: 12,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
  },
  sectionHeaderContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  heroImage: { height: 250, width: '100%' },
  heroQuoteBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  headingDivider: {
    height: 3,
    marginTop: 6,
    width: 60,
    borderRadius: 2,
    backgroundColor: '#3EA6FF',
  },
});
