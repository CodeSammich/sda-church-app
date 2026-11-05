import { UpdateContext } from '@/app/_layout';
import { MenuCard } from '@/components/MenuCard';
import { LanguageDialog } from '@/components/LanguageDialog';
import { ShareAppDialog } from '@/components/ShareAppDialog';
import { ThemeDialog } from '@/components/ThemeDialog';
import { ContrastDialog } from '@/components/ContrastDialog';
import { getContrastCopy } from '@/components/ContrastChoice';
import { ThemeContext } from '@/constants/Themes';
import { TextSizeDialog } from '@/components/TextSizeDialog';
import { contentColumnStyle } from '@/constants/Layout';
import {
  CHURCH_BUILDING_IMAGE_URL,
  openLegalDisclaimer,
  openPrivacyPolicy,
  openSupportEmail,
} from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { getTextSizeMenuCopy } from '@/constants/TextSizeCopy';
import { formatDownloadSize } from '@/constants/DownloadCopy';
import { useDownloadedBibleAudioBytes } from '@/hooks/useBibleAudioDownloads';
import { useTextSize } from '@/constants/TextSizeContext';
import {
  useAppTheme,
} from '@/constants/Themes';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import { useHeroUnderStatusBar } from '@/hooks/useHeroUnderStatusBar';
import { useContentColumnScale } from '@/hooks/useContentColumnScale';
import packageJson from '@/package.json';
import { getScreenshotPopup } from '@/services/ScreenshotRoute';
import { useDocumentStyles } from '@/styles/DocumentStyles';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { ImageBackground } from '@/components/ImageBackground';
import { List, Text, TouchableRipple } from 'react-native-paper';
import { TabBarSpacer } from '@/constants/BottomTabHeightContext';

const allLabels = {
  en: {
    title: 'You',
    settings: 'Settings',
    aboutSupport: 'About & Support',
    support: 'Help & Feedback',
    supportSub: 'Ask for help or suggest a feature, by email',
    shareApp: 'Share the App',
    shareAppSub: 'A QR code a friend can scan to download it',
    supportPrompt:
      'Is this a problem or an idea?\n\n\nWhat happened, or what would you like the app to do?\n\n\nIf something went wrong, what were you doing just before? A screenshot helps.',
    darkMode: 'Theme',
    darkModeSub: 'Choose a color theme',
    offlineAudio: 'Offline Bible Audio',
    offlineAudioSub: 'Download Bible audio to listen with no connection',
    offlineAudioSize: (size: string) => `Downloaded: ${size}`,
    language: 'Language',
    languageSub: 'Change app language',
    contact: 'Connect',
    contactSub: 'Contact information and locations',
    privacy: 'Privacy Policy',
    privacySub: 'Legal information (English only)',
    legal: 'Legal Disclaimer',
    legalSub: 'Terms of use and data attribution (English only)',
    licenses: 'Open-Source Licenses',
    licensesSub: 'Notices for software in the app (English only)',
  },
  zh: {
    title: '您',
    settings: '設定',
    aboutSupport: '關於與支援',
    support: '幫助與意見回饋',
    supportSub: '透過電子郵件尋求協助或建議新功能',
    shareApp: '分享應用程式',
    shareAppSub: '朋友掃描 QR 碼即可下載',
    supportPrompt:
      '這是問題回報，還是功能建議？\n\n\n發生了什麼事？或您希望 App 增加什麼功能？\n\n\n如果是問題：發生前您正在做什麼？附上截圖會很有幫助。',
    darkMode: '主題',
    darkModeSub: '選擇顏色主題',
    offlineAudio: '離線聖經音訊',
    offlineAudioSub: '下載聖經音訊，在沒有網路時收聽',
    offlineAudioSize: (size: string) => `已下載：${size}`,
    language: '語言',
    languageSub: '更改應用程式語言',
    contact: '聯繫',
    contactSub: '聯繫方式和地點',
    privacy: '隱私政策',
    privacySub: '法律資訊 (僅限英文)',
    legal: '法律聲明',
    legalSub: '使用條款與資料歸屬 (僅限英文)',
    licenses: '開放原始碼授權',
    licensesSub: '應用程式所含軟體的聲明 (僅限英文)',
  },
  'zh-cn': {
    title: '您',
    settings: '设置',
    aboutSupport: '关于与支持',
    support: '帮助与反馈',
    supportSub: '通过电子邮件寻求帮助或建议新功能',
    shareApp: '分享应用',
    shareAppSub: '朋友扫描二维码即可下载',
    supportPrompt:
      '这是问题反馈，还是功能建议？\n\n\n发生了什么？或您希望 App 增加什么功能？\n\n\n如果是问题：发生前您正在做什么？附上截图会很有帮助。',
    darkMode: '主题',
    darkModeSub: '选择颜色主题',
    offlineAudio: '离线圣经音频',
    offlineAudioSub: '下载圣经音频，在没有网络时收听',
    offlineAudioSize: (size: string) => `已下载：${size}`,
    language: '语言',
    languageSub: '更改应用语言',
    contact: '联系',
    contactSub: '联系方式和地点',
    privacy: '隐私政策',
    privacySub: '法律信息 (仅限英文)',
    legal: '法律声明',
    legalSub: '使用条款与数据归属 (仅限英文)',
    licenses: '开源许可',
    licensesSub: '应用所含软件的声明 (仅限英文)',
  },
  es: {
    title: 'Tú',
    settings: 'Ajustes',
    aboutSupport: 'Información y Ayuda',
    support: 'Ayuda y Sugerencias',
    supportSub: 'Pida ayuda o sugiera una función, por correo',
    shareApp: 'Compartir la App',
    shareAppSub: 'Un código QR para que un amigo la descargue',
    supportPrompt:
      '¿Es un problema o una idea?\n\n\n¿Qué pasó, o qué le gustaría que hiciera la app?\n\n\nSi algo falló, ¿qué estaba haciendo justo antes? Una captura de pantalla ayuda.',
    darkMode: 'Tema',
    darkModeSub: 'Elegir un tema de color',
    offlineAudio: 'Audio bíblico sin conexión',
    offlineAudioSub: 'Descarga audio bíblico para escuchar sin conexión',
    offlineAudioSize: (size: string) => `Descargado: ${size}`,
    language: 'Idioma',
    languageSub: 'Cambiar idioma de la aplicación',
    contact: 'Conectar',
    contactSub: 'Información de contacto y ubicaciones',
    privacy: 'Política de Privacidad',
    privacySub: 'Información legal (solo en inglés)',
    legal: 'Aviso Legal',
    legalSub: 'Términos de uso y atribución de datos (solo en inglés)',
    licenses: 'Licencias de Código Abierto',
    licensesSub: 'Avisos del software de la aplicación (solo en inglés)',
  },
};

export default function YouScreen() {
  const theme = useAppTheme();
  const DocumentStyles = useDocumentStyles();
  const NavigationStyles = useNavigationStyles();
  const { language } = useContext(LanguageContext);
  const { onManualCheck, updateStatus } = useContext(UpdateContext);
  const { contrastModes } = useContext(ThemeContext);
  const contrastCopy = getContrastCopy(language);
  // The chosen size, which a very large phone text size can reduce when drawn.
  const { textScale: drawnTextScale, preferredTextScale } = useTextSize();
  const columnScale = useContentColumnScale();
  const textScale = preferredTextScale ?? drawnTextScale;
  const [showTextSize, setShowTextSize] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [showThemeDialog, setShowThemeDialog] = useState(false);
  const [showContrast, setShowContrast] = useState(false);
  const [showShareApp, setShowShareApp] = useState(false);
  const headerHeight = useGlobalHeaderHeight();
  const { popup } = useLocalSearchParams<{ popup?: string }>();

  // The key-screen capture can't tap, so its build opens a dialog from the
  // path, such as you?popup=text-size (#372).
  useEffect(() => {
    const screenshotPopup = getScreenshotPopup(popup, ['language', 'text-size', 'theme', 'contrast', 'share-app']);
    if (screenshotPopup === 'language') setShowLanguage(true);
    if (screenshotPopup === 'text-size') setShowTextSize(true);
    if (screenshotPopup === 'theme') setShowThemeDialog(true);
    if (screenshotPopup === 'contrast') setShowContrast(true);
    if (screenshotPopup === 'share-app') setShowShareApp(true);
  }, [popup]);
  const { heroUnderStatusBar, onHeroLayout, onScroll } = useHeroUnderStatusBar();
  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;
  // Phones only: the web streams Bible audio (#556).
  const offlineAudioBytes = useDownloadedBibleAudioBytes();
  const textSizeCopy = getTextSizeMenuCopy(language, textScale);

  return (
    <>
      <Stack.Screen options={{ title: labels.title, heroUnderStatusBar } as any} />
      <ScrollView
        style={NavigationStyles.container}
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <ImageBackground
          onLayout={onHeroLayout}
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

        <View style={[styles.body, contentColumnStyle(columnScale)]}>
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
              description={labels.darkModeSub}
              icon="theme-light-dark"
              iconColor={theme.colors.primary}
              onPress={() => setShowThemeDialog(true)}
            />
            <MenuCard
              title={contrastCopy.title}
              description={
                // One label when both themes match; otherwise each theme's.
                contrastModes.light === contrastModes.dark
                  ? contrastCopy.options[contrastModes.light].label
                  : `${contrastCopy.sections.light}: ${contrastCopy.options[contrastModes.light].label} · ${contrastCopy.sections.dark}: ${contrastCopy.options[contrastModes.dark].label}`
              }
              icon="contrast-circle"
              iconColor={theme.colors.primary}
              onPress={() => setShowContrast(true)}
            />
            {Platform.OS !== 'web' && (
              <MenuCard
                title={labels.offlineAudio}
                description={
                  offlineAudioBytes
                    ? labels.offlineAudioSize(formatDownloadSize(offlineAudioBytes, language))
                    : labels.offlineAudioSub
                }
                icon="download-circle-outline"
                iconColor={theme.colors.primary}
                onPress={() =>
                  router.push({
                    pathname: '/you/audio-downloads',
                    params: { backTo: '/you' },
                  } as any)
                }
              />
            )}
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
              title={labels.shareApp}
              description={labels.shareAppSub}
              icon="qrcode"
              iconColor={theme.colors.secondary}
              onPress={() => setShowShareApp(true)}
            />
            <MenuCard
              title={labels.support}
              description={labels.supportSub}
              icon="email-outline"
              iconColor={theme.colors.secondary}
              onPress={() => openSupportEmail(labels.supportPrompt, packageJson.version)}
            />
            <MenuCard
              title={labels.privacy}
              description={labels.privacySub}
              icon="shield-account"
              iconColor={theme.colors.secondary}
              onPress={openPrivacyPolicy}
            />
            <MenuCard
              title={labels.legal}
              description={labels.legalSub}
              icon="file-document-outline"
              iconColor={theme.colors.secondary}
              onPress={openLegalDisclaimer}
            />
            <MenuCard
              title={labels.licenses}
              description={labels.licensesSub}
              icon="open-source-initiative"
              iconColor={theme.colors.secondary}
              onPress={() =>
                router.push({
                  pathname: '/you/licenses',
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
        <TabBarSpacer />
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
      <ContrastDialog visible={showContrast} onDismiss={() => setShowContrast(false)} />
      <ShareAppDialog visible={showShareApp} onDismiss={() => setShowShareApp(false)} />
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
