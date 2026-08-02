import { VerseHero } from '@/components/VerseHero';
import { WrappingButton as Button } from '@/components/WrappingButton';
import { CHURCH_BUILDING_IMAGE_URL, openBeliefs } from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { DESIGN_TOKENS, shouldUseStackedPillarLayout } from '@/constants/Layout';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import { useHeroHeaderTitle } from '@/hooks/useHeroHeaderTitle';
import { useDocumentStyles } from '@/styles/DocumentStyles';
import { AppIcon } from '@/components/AppIcon';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useContext } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AboutSDAScreen() {
  const { language } = useContext(LanguageContext);
  const { backTo } = useLocalSearchParams();
  const theme = useAppTheme();
  const DocumentStyles = useDocumentStyles();
  const { textScale } = useTextSize();
  const { fontScale, width } = useWindowDimensions();
  const stackPillars = shouldUseStackedPillarLayout(
    width,
    Math.max(1, fontScale * textScale),
  );
  const insets = useSafeAreaInsets();
  const { showHeaderTitle, handleHeroScroll } = useHeroHeaderTitle();

  const allLabels = {
    en: {
      title: 'About Denomination',
      churchName: 'Seventh-day Adventist Church',
      verse:
        'All Scripture is God-breathed and is useful for instruction, for conviction, for correction, and for training in righteousness, so that the man of God may be complete, fully equipped for every good work.',
      verseRef: '2 Timothy 3:16–17 (BSB)',
      aboutSDA: 'About the Denomination',
      sdaDescription:
        'Seventh-day Adventists are a global Protestant Christian community that regards the Bible as the supreme authority in their lives. We adhere to the principle of Sola Scriptura (By Scripture Alone), which means that the Bible is the sole infallible source of authority for Christian faith and practice, and the standard by which all teachings and experiences are measured.',
      pillarItems: [
        { title: 'Bible-Centered', icon: 'book-cross' },
        { title: 'Faith & Love', icon: 'heart-flash' },
        { title: 'Community', icon: 'account-group' },
      ],
      beliefs: 'Our Beliefs',
      learnMore: 'Read All 28 Beliefs',
      beliefsItems: [
        {
          title: 'Creation',
          description:
            'We believe God is the Creator of all things, revealing His love through the beautiful world He made for us.',
          icon: 'creation',
        },
        {
          title: 'The Nature of Humanity',
          description:
            "Created in God's image, we have the power to choose, yet we often struggle with our own brokenness and need for redemption.",
          icon: 'account',
        },
        {
          title: 'The Great Controversy',
          description:
            'We are part of a universal conflict between good and evil that explains the suffering we see in our world.',
          icon: 'sword-cross',
        },
        {
          title: 'God the Son',
          description:
            'Jesus is truly God, who became human to live among us and reconcile us to the Father.',
          icon: 'crown',
        },
        {
          title: 'Life, Death, and Resurrection of Christ',
          description:
            "Through Jesus' perfect life and sacrifice on the cross, He provided the only way for us to be forgiven and restored.",
          icon: 'heart',
        },
        {
          title: 'Experience of Salvation',
          description:
            "By faith in Jesus, we are adopted into God's family and delivered from the power of our past mistakes.",
          icon: 'gift',
        },
        {
          title: 'Growing in Christ',
          description:
            'Through the Holy Spirit, we are empowered to live a life of peace, spiritual growth, and service to others.',
          icon: 'sprout',
        },
        {
          title: 'The Sabbath',
          description:
            'The seventh-day Sabbath is a weekly gift from God, a time for rest, worship, and community.',
          icon: 'calendar-heart',
        },
        {
          title: 'The Second Coming of Christ',
          description:
            'The return of Jesus is our "blessed hope," marking the day when He will finally restore all things.',
          icon: 'trumpet',
        },
        {
          title: 'The New Earth',
          description:
            'God will create a home where righteousness dwells, and there will be no more pain, suffering, or death.',
          icon: 'earth',
        },
      ],
    },
    zh: {
      title: '關於教派',
      churchName: '基督復臨安息日會',
      verse:
        '聖經都是神所默示的（或作：凡神所默示的聖經），於教訓、督責、使人歸正、教導人學義都是有益的，叫屬神的人得以完全，預備行各樣的善事。',
      verseRef: '提摩太後書 3:16–17 (CUV)',
      aboutSDA: '關於教派',
      sdaDescription:
        '基督復臨安息日會是一個全球性的新教徒團體, 將聖經視為生活的最高權威。我們堅持「唯獨聖經」(Sola Scriptura) 的原則, 這意味著聖經是基督徒信仰和實踐的唯一無誤權威來源, 也是衡量所有教導和經驗的標準。',
      pillarItems: [
        { title: '以聖經為中心', icon: 'book-cross' },
        { title: '信仰與愛', icon: 'heart-flash' },
        { title: '社群', icon: 'account-group' },
      ],
      beliefs: '我們的信仰',
      learnMore: '閱讀全部 28 條基本信仰',
      beliefsItems: [
        {
          title: '創造',
          description:
            '我們相信上帝是萬物的創造主, 通過祂為我們創造的美麗世界展現了祂的愛。',
          icon: 'creation',
        },
        {
          title: '人性的本質',
          description:
            '我們是按上帝的形象創造的, 具有選擇的力量, 但我們常在自身的破碎中掙扎, 需要救贖。',
          icon: 'account',
        },
        {
          title: '善惡之爭',
          description:
            '我們參與了一場善與惡之間的普世衝突, 這解釋了我們在世上所見的苦難。',
          icon: 'sword-cross',
        },
        {
          title: '聖子上帝',
          description: '耶穌是真實的上帝, 祂降世為人生活在我們中間, 使我們與天父和好。',
          icon: 'crown',
        },
        {
          title: '基督的生、死與復活',
          description:
            '通過耶穌完美的生命和在十字架上的犧牲, 祂提供了我們獲得寬恕與復興的唯一途徑。',
          icon: 'heart',
        },
        {
          title: '得救經驗',
          description:
            '藉著對耶穌的信仰, 我們被接納進入上帝的家, 並從過去錯誤的權勢中得到釋放。',
          icon: 'gift',
        },
        {
          title: '在基督裡成長',
          description: '通過聖靈, 我們得到授權, 過著平安, 靈命成長和服事他人的生活。',
          icon: 'sprout',
        },
        {
          title: '安息日',
          description: '第七日的安息日是上帝賜予的每週禮物, 一個安息, 崇拜和團契的時間。',
          icon: 'calendar-heart',
        },
        {
          title: '基督復臨',
          description: '耶穌的復臨是我們「蒙福的指望」, 標誌著祂最終復興萬物的那一天。',
          icon: 'trumpet',
        },
        {
          title: '新地',
          description: '上帝將創造一個公義居住的家園, 那裡將不再有痛苦, 哀傷或死亡。',
          icon: 'earth',
        },
      ],
    },
    'zh-cn': {
      title: '关于教派',
      churchName: '基督复临安息日会',
      verse:
        '圣经都是神所默示的（或作：凡神所默示的圣经），于教训、督责、使人归正、教导人学义都是有益的，叫属神的人得以完全，预备行各样的善事。',
      verseRef: '提摩太后书 3:16–17 (CUVS)',
      aboutSDA: '关于教派',
      sdaDescription:
        '基督复临安息日会是一个全球性的新教徒团体, 将圣经视为生活的最高权威。我们坚持“唯独圣经”(Sola Scriptura) 的原则, 这意味着圣经是基督徒信仰和实践的唯一无误权威来源, 也是衡量所有教导和经验的标准。',
      pillarItems: [
        { title: '以圣经为中心', icon: 'book-cross' },
        { title: '信仰与爱', icon: 'heart-flash' },
        { title: '社区', icon: 'account-group' },
      ],
      beliefs: '我们的信仰',
      learnMore: '阅读全部 28 条基本信仰',
      beliefsItems: [
        {
          title: '创造',
          description:
            '我们相信上帝是万物的创造主, 通过祂为我们创造的美丽世界展现了祂的爱。',
          icon: 'creation',
        },
        {
          title: '人性的本质',
          description:
            '我们是按上帝的形象创造的, 具有选择的力量, 但我们常在自身的破碎中挣扎, 需要救赎。',
          icon: 'account',
        },
        {
          title: '善恶之争',
          description:
            '我们参与了一场善与恶之间的普世冲突, 这解释了我们在世上所见的苦难。',
          icon: 'sword-cross',
        },
        {
          title: '圣子上帝',
          description: '耶稣是真实的上帝, 祂降世为人生活在我们中间, 使我们与天父和好。',
          icon: 'crown',
        },
        {
          title: '基督的生、死与复活',
          description:
            '通过耶稣完美的生命和在十字架上的牺牲, 祂提供了我们获得宽恕与复兴的唯一途径。',
          icon: 'heart',
        },
        {
          title: '得救经验',
          description:
            '藉着对耶稣的信仰, 我们被接纳进入上帝的家, 并从过去错误的权势中得到释放。',
          icon: 'gift',
        },
        {
          title: '在基督里成长',
          description: '通过圣灵, 我们得到授权, 过着平安, 灵命成长和服事他人的生活。',
          icon: 'sprout',
        },
        {
          title: '安息日',
          description: '第七日的安息日是上帝赐予的每周礼物, 一个安息, 崇拜和团契的时间。',
          icon: 'calendar-heart',
        },
        {
          title: '基督复临',
          description: '耶稣的复临是我们“蒙福”的指望,标志着祂最终复兴万物的那一天。',
          icon: 'trumpet',
        },
        {
          title: '新地',
          description: '上帝将创造一个公义居住的家园, 那里将不再有痛苦, 哀伤或死亡。',
          icon: 'earth',
        },
      ],
    },
    es: {
      title: 'Sobre la Denominación',
      churchName: 'Iglesia Adventista\ndel Séptimo Día',
      verse:
        'Toda la Escritura es inspirada por Dios, y útil para enseñar, para redargüir, para corregir, para instruir en justicia, a fin de que el hombre de Dios sea perfecto, enteramente preparado para toda buena obra.',
      verseRef: '2 Timoteo 3:16–17 (RVR1960)',
      aboutSDA: 'Acerca de la Denominación',
      sdaDescription:
        'Los Adventistas del Séptimo Día son una comunidad Cristiana Protestante global que considera la Biblia como la autoridad suprema en sus vidas. Nos adherimos al principio de Sola Scriptura (Solo por la Escritura), lo que significa que la Biblia es la única fuente infalible de autoridad para la fe y la práctica cristiana, y el estándar por el cual se miden todas las enseñanzas y experiencias.',
      pillarItems: [
        { title: 'Biblia', icon: 'book-cross' },
        { title: 'Fe y Amor', icon: 'heart-flash' },
        { title: 'Comunidad', icon: 'account-group' },
      ],
      beliefs: 'Nuestras Creencias',
      learnMore: 'Leer las 28 Creencias Fundamentales',
      beliefsItems: [
        {
          title: 'La Creación',
          description:
            'Creemos que Dios es el Creador de todas las cosas, revelando Su amor a través del hermoso mundo que hizo para nosotros.',
          icon: 'creation',
        },
        {
          title: 'La Naturaleza de la Humanidad',
          description:
            'Creados a imagen de Dios, tenemos el poder de elegir, pero a menudo luchamos con nuestra propia fragilidad y necesidad de redención.',
          icon: 'account',
        },
        {
          title: 'El Gran Conflicto',
          description:
            'Somos parte de un conflicto universal entre el bien y el mal que explica el sufrimiento que vemos en nuestro mundo.',
          icon: 'sword-cross',
        },
        {
          title: 'Dios el Hijo',
          description:
            'Jesús es verdaderamente Dios, quien se hizo humano para vivir entre nosotros y reconciliarnos con el Padre.',
          icon: 'crown',
        },
        {
          title: 'Vida, Muerte y Resurrección de Cristo',
          description:
            'A través de la vida perfecta de Jesús y su sacrificio en la cruz, Él proporcionó el único camino para que seamos perdonados y restaurados.',
          icon: 'heart',
        },
        {
          title: 'Experiencia de la Salvación',
          description:
            'Por la fe en Jesús, somos adoptados en la familia de Dios y librados del poder de nuestros errores pasados.',
          icon: 'gift',
        },
        {
          title: 'Crecer en Cristo',
          description:
            'A través del Espíritu Santo, somos fortalecidos para vivir una vida de paz, crecimiento espiritual y servicio a los demás.',
          icon: 'sprout',
        },
        {
          title: 'El Sábado',
          description:
            'El sábado del séptimo día es un regalo semanal de Dios, un tiempo para el descanso, la adoración y la comunidad.',
          icon: 'calendar-heart',
        },
        {
          title: 'La Segunda Venida de Cristo',
          description:
            'El regreso de Jesús es nuestra "esperanza bienaventurada", marcando el día en que Él finalmente restaurará todas las cosas.',
          icon: 'trumpet',
        },
        {
          title: 'La Tierra Nueva',
          description:
            'Dios creará un hogar donde mora la justicia, y ya no habrá más dolor, sufrimiento ni muerte.',
          icon: 'earth',
        },
      ],
    },
  };

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
        contentContainerStyle={{
          paddingTop: 0,
          paddingBottom: insets.bottom + 50,
        }}
      >
        <VerseHero
          title={labels.churchName}
          verse={labels.verse}
          reference={labels.verseRef}
          imageSource={{ uri: CHURCH_BUILDING_IMAGE_URL }}
          verseColors={
            theme.dark
              ? ['#4A1717', '#632020', '#7A2929']
              : ['#7F1D1D', '#B91C1C', '#DC2626']
          }
        />

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
            {labels.aboutSDA}
          </Text>
          <Text
            variant="bodyMedium"
            style={[DocumentStyles.description, { color: theme.colors.onSurface }]}
          >
            {labels.sdaDescription}
          </Text>
          <View
            style={[
              styles.pillarContainer,
              stackPillars && styles.stackedPillarContainer,
            ]}
          >
            {(labels as any).pillarItems.map((item: any, index: number) => (
              <Card
                key={index}
                style={[
                  styles.pillarCard,
                  stackPillars && styles.stackedPillarCard,
                  { borderWidth: 1, borderColor: theme.colors.outlineVariant },
                ]}
                mode="contained"
              >
                <View style={styles.pillarContent}>
                  <AppIcon
                    name={item.icon as any}
                    size={DESIGN_TOKENS.ICON_SIZE_FEATURED}
                    color={theme.colors.tertiary}
                  />
                  <Text
                    variant="labelSmall"
                    style={[styles.pillarText, { color: theme.colors.onSurface }]}
                  >
                    {item.title}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
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
            {labels.beliefs}
          </Text>

          <View style={styles.cardContainer}>
            {labels.beliefsItems.map((item, index) => (
              <Card
                key={index}
                style={[
                  DocumentStyles.card,
                  { borderWidth: 1, borderColor: theme.colors.outlineVariant },
                ]}
                mode="contained"
              >
                <View style={styles.cardHeader}>
                  <AppIcon
                    name={item.icon as any}
                    size={DESIGN_TOKENS.ICON_SIZE_STANDARD}
                    color={theme.colors.tertiary}
                  />
                  <Text
                    variant="titleMedium"
                    style={[styles.cardTitleText, { color: theme.colors.onSurface }]}
                  >
                    {item.title}
                  </Text>
                </View>
                <View style={styles.cardContent}>
                  <Text
                    variant="bodyMedium"
                    style={[
                      DocumentStyles.description,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    {item.description}
                  </Text>
                </View>
              </Card>
            ))}
          </View>

          <Button
            mode="contained"
            onPress={openBeliefs}
            buttonColor={theme.colors.primary}
            textColor={theme.colors.onPrimary}
            style={DocumentStyles.button}
            icon="open-in-new"
          >
            {labels.learnMore}
          </Button>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginVertical: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  cardTitleText: {
    marginLeft: 12,
    fontWeight: 'bold',
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  pillarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  pillarCard: {
    flex: 1,
    marginHorizontal: 4,
  },
  stackedPillarContainer: {
    flexDirection: 'column',
    gap: 12,
  },
  stackedPillarCard: {
    flexBasis: 'auto',
    flexGrow: 0,
    flexShrink: 0,
    marginHorizontal: 0,
    width: '100%',
  },
  pillarContent: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarText: {
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
});
