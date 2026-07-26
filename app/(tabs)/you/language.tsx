import { MenuCard } from '@/components/MenuCard';
import { VerseHero } from '@/components/VerseHero';
import { CHURCH_BUILDING_IMAGE_URL } from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { useHeroHeaderTitle } from '@/hooks/useHeroHeaderTitle';
import { NavigationStyles } from '@/styles/NavigationStyles';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useContext } from 'react';
import { ScrollView } from 'react-native';
import { List } from 'react-native-paper';

const allLabels = {
  en: {
    title: 'Language',
    verse:
      'And when this sound rang out, a crowd came together in bewilderment, because each one heard them speaking his own language. How is it then that each of us hears them in his own native language?',
    verseRef: 'Acts 2:6, 8 (BSB)',
  },
  zh: {
    title: '語言',
    verse:
      '這聲音一響，眾人都來聚集，各人聽見門徒用眾人的鄉談說話，就甚納悶。我們各人怎麼聽見他們說我們生來所用的鄉談呢？',
    verseRef: '使徒行傳 2:6, 8 (CUV)',
  },
  'zh-cn': {
    title: '语言',
    verse:
      '这声音一响，众人都来聚集，各人听见门徒用众人的乡谈说话，就甚纳闷。我们各人怎么听见他们说我们生来所用的乡谈呢？',
    verseRef: '使徒行传 2:6, 8 (CUVS)',
  },
  es: {
    title: 'Idioma',
    verse:
      'Y hecho este estruendo, juntóse la multitud; y estaban confusos, porque cada uno les oía hablar su propia lengua. ¿Cómo, pues, les oímos nosotros hablar cada uno en nuestra lengua en que somos nacidos?',
    verseRef: 'Hechos 2:6, 8 (RVA)',
  },
};

export default function LanguageScreen() {
  const { language, setLanguage } = useContext(LanguageContext);
  const { backTo } = useLocalSearchParams();
  const theme = useAppTheme();
  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;
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

        <List.Section style={{ paddingHorizontal: 20 }}>
          <MenuCard
            title="English"
            icon="translate"
            onPress={() => setLanguage('en')}
            rightIcon={language === 'en' ? 'radiobox-marked' : 'radiobox-blank'}
          />
          <MenuCard
            title="繁體中文 (Traditional Chinese)"
            icon="translate"
            onPress={() => setLanguage('zh')}
            rightIcon={language === 'zh' ? 'radiobox-marked' : 'radiobox-blank'}
          />
          <MenuCard
            title="简体中文 (Simplified Chinese)"
            icon="translate"
            onPress={() => setLanguage('zh-cn')}
            rightIcon={language === 'zh-cn' ? 'radiobox-marked' : 'radiobox-blank'}
          />
          <MenuCard
            title="Español (Spanish)"
            icon="translate"
            onPress={() => setLanguage('es')}
            rightIcon={language === 'es' ? 'radiobox-marked' : 'radiobox-blank'}
          />
        </List.Section>
      </ScrollView>
    </>
  );
}
