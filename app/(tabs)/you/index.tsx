import { UpdateContext } from '@/app/_layout';
import { MenuCard } from '@/components/MenuCard';
import { LanguageDialog } from '@/components/LanguageDialog';
import { ThemeDialog } from '@/components/ThemeDialog';
import { TextSizeDialog } from '@/components/TextSizeDialog';
import { CHURCH_BUILDING_IMAGE_URL } from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { getTextSizeMenuCopy } from '@/constants/TextSizeCopy';
import { useTextSize } from '@/constants/TextSizeContext';
import {
  THEME_DARK,
  THEME_LIGHT,
  THEME_SUNSET,
  THEME_SYSTEM,
  ThemeContext,
  useAppTheme,
  type ThemeMode,
} from '@/constants/Themes';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import packageJson from '@/package.json';
import { useDocumentStyles } from '@/styles/DocumentStyles';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useContext, useState } from 'react';
import { ImageBackground, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { List, Text, TouchableRipple } from 'react-native-paper';

const allLabels = {
  en: {
    title: 'You',
    settings: 'Settings',
    aboutSupport: 'About & Support',
    darkMode: 'Theme',
    darkModeSub: 'Choose a color theme',
    language: 'Language',
    languageSub: 'Change app language',
    contact: 'Connect',
    contactSub: 'Contact information and locations',
    privacy: 'Privacy Policy',
    privacySub: 'Legal information (English only)',
    legal: 'Legal Disclaimer',
    legalSub: 'Terms of use and data attribution (English only)',
  },
  zh: {
    title: '您',
    settings: '設定',
    aboutSupport: '關於與支援',
    darkMode: '主題',
    darkModeSub: '選擇顏色主題',
    language: '語言',
    languageSub: '更改應用程式語言',
    contact: '聯繫',
    contactSub: '聯繫方式和地點',
    privacy: '隱私政策',
    privacySub: '法律資訊 (僅限英文)',
    legal: '法律聲明',
    legalSub: '使用條款與資料歸屬 (僅限英文)',
  },
  'zh-cn': {
    title: '您',
    settings: '设置',
    aboutSupport: '关于与支持',
    darkMode: '主题',
    darkModeSub: '选择颜色主题',
    language: '语言',
    languageSub: '更改应用语言',
    contact: '联系',
    contactSub: '联系方式和地点',
    privacy: '隐私政策',
    privacySub: '法律信息 (仅限英文)',
    legal: '法律声明',
    legalSub: '使用条款与数据归属 (仅限英文)',
  },
  es: {
    title: 'Tú',
    settings: 'Ajustes',
    aboutSupport: 'Información y Ayuda',
    darkMode: 'Tema',
    darkModeSub: 'Elegir un tema de color',
    language: 'Idioma',
    languageSub: 'Cambiar idioma de la aplicación',
    contact: 'Conectar',
    contactSub: 'Información de contacto y ubicaciones',
    privacy: 'Política de Privacidad',
    privacySub: 'Información legal (solo en inglés)',
    legal: 'Aviso Legal',
    legalSub: 'Términos de uso y atribución de datos (solo en inglés)',
  },
};

export default function YouScreen() {
  const theme = useAppTheme();
  const DocumentStyles = useDocumentStyles();
  const NavigationStyles = useNavigationStyles();
  const { language } = useContext(LanguageContext);
  const { themeMode } = useContext(ThemeContext);
  const { onManualCheck, updateStatus } = useContext(UpdateContext);
  const { textScale } = useTextSize();
  const [showTextSize, setShowTextSize] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [showThemeDialog, setShowThemeDialog] = useState(false);
  const headerHeight = useGlobalHeaderHeight();
  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;
  const textSizeCopy = getTextSizeMenuCopy(language, textScale);

  const themeLabels: Record<ThemeMode, string> = {
    [THEME_LIGHT]: 'Light',
    [THEME_DARK]: 'Dark',
    [THEME_SUNSET]: 'Sunset',
    [THEME_SYSTEM]: 'System',
  };

  return (
    <>
      <Stack.Screen options={{ title: labels.title }} />
      <ScrollView
        style={NavigationStyles.container}
        contentContainerStyle={styles.content}
      >
        <ImageBackground
          source={{ uri: CHURCH_BUILDING_IMAGE_URL }}
          style={[
            NavigationStyles.heroHeader,
            { paddingTop: headerHeight + 6, paddingBottom: 24 },
          ]}
          resizeMode="cover"
        >
          <LinearGradient
            colors={theme.gradients.heroOverlay}
            style={StyleSheet.absoluteFill}
          />
          <Text
            variant="headlineSmall"
            style={[
              NavigationStyles.heroTitle,
              { color: theme.dark ? theme.colors.onSurface : theme.colors.onSecondary },
            ]}
          >
            {labels.title}
          </Text>
        </ImageBackground>

        <View style={styles.body}>
          <List.Section>
            <Text
              variant="titleLarge"
              numberOfLines={0}
              style={[
                DocumentStyles.sectionTitle,
                {
                  color: theme.colors.onSurface,
                  borderBottomColor: theme.colors.outlineVariant,
                },
              ]}
            >
              {labels.settings}
            </Text>
            <MenuCard
              title={labels.language}
              description={labels.languageSub}
              icon="translate"
              iconColor={theme.colors.tertiary}
              onPress={() => setShowLanguage(true)}
            />
            <MenuCard
              title={textSizeCopy.title}
              description={textSizeCopy.description}
              icon="format-size"
              iconColor={theme.colors.tertiary}
              onPress={() => setShowTextSize(true)}
            />
            <MenuCard
              title={labels.darkMode}
              description={`${labels.darkModeSub} · ${themeLabels[themeMode]}`}
              icon="theme-light-dark"
              iconColor={theme.colors.primary}
              onPress={() => setShowThemeDialog(true)}
            />
          </List.Section>

          <List.Section>
            <Text
              variant="titleLarge"
              numberOfLines={0}
              style={[
                DocumentStyles.sectionTitle,
                {
                  color: theme.colors.onSurface,
                  borderBottomColor: theme.colors.outlineVariant,
                },
              ]}
            >
              {labels.aboutSupport}
            </Text>
            <MenuCard
              title={labels.privacy}
              description={labels.privacySub}
              icon="shield-account"
              iconColor={theme.colors.secondary}
              onPress={() =>
                router.push({
                  pathname: '/you/privacy',
                  params: { backTo: '/you' },
                } as any)
              }
            />
            <MenuCard
              title={labels.legal}
              description={labels.legalSub}
              icon="file-document-outline"
              iconColor={theme.colors.secondary}
              onPress={() =>
                router.push({
                  pathname: '/you/legal',
                  params: { backTo: '/you' },
                } as any)
              }
            />

            <View style={styles.footer}>
              <TouchableRipple
                onPress={Platform.OS === 'web' ? () => onManualCheck() : undefined}
                disabled={updateStatus === 'checking' || updateStatus === 'updating'}
                style={styles.versionRipple}
              >
                <Text
                  variant="labelSmall"
                  style={[
                    styles.versionText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  Version {packageJson.version}
                </Text>
              </TouchableRipple>
            </View>
          </List.Section>
        </View>
      </ScrollView>
      <TextSizeDialog
        visible={showTextSize}
        onDismiss={() => setShowTextSize(false)}
      />
      <LanguageDialog
        visible={showLanguage}
        onDismiss={() => setShowLanguage(false)}
      />
      <ThemeDialog
        visible={showThemeDialog}
        onDismiss={() => setShowThemeDialog(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 16,
  },
  body: {
    paddingHorizontal: 20,
  },
  footer: {
    marginTop: 32,
    marginBottom: 16,
    alignItems: 'center',
  },
  versionRipple: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  versionText: {
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
