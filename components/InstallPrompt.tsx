import { LanguageContext } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { useContext } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Modal, Portal, Text } from 'react-native-paper';

interface InstallPromptProps {
  onDismiss: () => void;
  onInstall: () => Promise<void>;
}

const allLabels = {
  en: {
    title: 'Install the app',
    sub: 'Add NY Chinese SDA to your device for quick access.',
    install: 'Install App',
    later: 'Not now',
  },
  zh: {
    title: '安裝應用程式',
    sub: '將紐約華人基督復臨安息日會新增到您的裝置，以便快速開啟。',
    install: '安裝應用程式',
    later: '暫時不要',
  },
  'zh-cn': {
    title: '安装应用',
    sub: '将纽约华人基督复临安息日会添加到您的设备，以便快速打开。',
    install: '安装应用',
    later: '暂时不要',
  },
  es: {
    title: 'Instalar la aplicación',
    sub: 'Añade NY Chinese SDA a tu dispositivo para acceder rápidamente.',
    install: 'Instalar aplicación',
    later: 'Ahora no',
  },
};

export const InstallPrompt = ({ onDismiss, onInstall }: InstallPromptProps) => {
  const { language } = useContext(LanguageContext);
  const theme = useAppTheme();
  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;

  return (
    <Portal>
      <Modal
        visible
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modal,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <Text variant="headlineSmall" style={styles.title}>
          {labels.title}
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          {labels.sub}
        </Text>
        <Button mode="contained" icon="download" onPress={onInstall}>
          {labels.install}
        </Button>
        <Button mode="text" onPress={onDismiss} style={styles.laterButton}>
          {labels.later}
        </Button>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: 20,
    padding: 24,
    borderRadius: 16,
    maxWidth: 500,
    alignSelf: 'center',
    width: '90%',
  },
  title: {
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  laterButton: {
    marginTop: 8,
  },
});
