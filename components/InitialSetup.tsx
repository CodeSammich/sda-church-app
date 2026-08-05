import {
  isTextScale,
  TEXT_SCALE_OPTIONS,
  type TextScale,
} from '@/constants/AppPreferences';
import {
  LanguageContext,
  type SupportedLanguage,
} from '@/constants/LanguageContext';
import { useTextSize } from '@/constants/TextSizeContext';
import { ThemeContext, useAppTheme } from '@/constants/Themes';
import { AppIcon } from '@/components/AppIcon';
import { useContext, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Modal, Portal, Text } from 'react-native-paper';

interface InitialSetupProps {
  onComplete: () => void;
}

const setupLabels = {
  en: {
    title: 'Welcome',
    subtitle: "Let's personalize your experience",
    language: 'Language',
    appearance: 'Appearance',
    dark: 'Dark',
    light: 'Light',
    textSize: 'Text size',
    textSizeHelp: 'Choose a comfortable starting size. You can change it later.',
    percentLabel: (percent: number) => `${percent} percent text size`,
    saving: 'Saving text size…',
    saveError: (percent: number) =>
      `${percent}% text size could not be saved. Retry before continuing.`,
    retry: 'Retry',
    retryLabel: (percent: number) =>
      `Retry saving ${percent} percent text size`,
    start: 'Get Started',
  },
  zh: {
    title: '歡迎',
    subtitle: '自訂您的使用體驗',
    language: '語言設定',
    appearance: '外觀模式',
    dark: '深色',
    light: '淺色',
    textSize: '字體大小',
    textSizeHelp: '選擇舒適的起始大小，稍後仍可變更。',
    percentLabel: (percent: number) => `${percent}% 字體大小`,
    saving: '正在儲存字體大小…',
    saveError: (percent: number) =>
      `無法儲存 ${percent}% 字體大小。請重試後再繼續。`,
    retry: '重試',
    retryLabel: (percent: number) =>
      `重新嘗試儲存 ${percent}% 字體大小`,
    start: '開始使用',
  },
  'zh-cn': {
    title: '欢迎',
    subtitle: '自定义您的使用体验',
    language: '语言设置',
    appearance: '外观模式',
    dark: '深色',
    light: '浅色',
    textSize: '字体大小',
    textSizeHelp: '选择舒适的起始大小，稍后仍可更改。',
    percentLabel: (percent: number) => `${percent}% 字体大小`,
    saving: '正在保存字体大小…',
    saveError: (percent: number) =>
      `无法保存 ${percent}% 字体大小。请重试后再继续。`,
    retry: '重试',
    retryLabel: (percent: number) =>
      `重新尝试保存 ${percent}% 字体大小`,
    start: '开始使用',
  },
  es: {
    title: 'Bienvenido',
    subtitle: 'Personalicemos tu experiencia',
    language: 'Idioma',
    appearance: 'Apariencia',
    dark: 'Oscuro',
    light: 'Claro',
    textSize: 'Tamaño del texto',
    textSizeHelp: 'Elige un tamaño inicial cómodo. Puedes cambiarlo después.',
    percentLabel: (percent: number) =>
      `Tamaño del texto al ${percent} por ciento`,
    saving: 'Guardando el tamaño del texto…',
    saveError: (percent: number) =>
      `No se pudo guardar el tamaño del texto al ${percent}%. Reinténtalo antes de continuar.`,
    retry: 'Reintentar',
    retryLabel: (percent: number) =>
      `Reintentar guardar el tamaño del texto al ${percent} por ciento`,
    start: 'Comenzar',
  },
} as const;

interface SetupChoice {
  accessibilityLabel?: string;
  icon?: 'weather-night' | 'weather-sunny';
  label: string;
  value: string;
}

interface SetupChoiceGroupProps {
  disabled: boolean;
  onValueChange: (value: string) => void;
  options: SetupChoice[];
  twoColumn?: boolean;
  value: string;
}

export const shouldUseTwoColumnOnboardingChoices = (viewportWidth: number) =>
  !Number.isFinite(viewportWidth) || viewportWidth <= 430;

const SetupChoiceGroup = ({
  disabled,
  onValueChange,
  options,
  twoColumn = false,
  value,
}: SetupChoiceGroupProps) => {
  const theme = useAppTheme();

  return (
    <View accessibilityRole="radiogroup" style={styles.choiceGroup}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityLabel={option.accessibilityLabel}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            onPress={() => onValueChange(option.value)}
            style={({ pressed }) => [
              styles.choiceButton,
              twoColumn && styles.twoColumnChoiceButton,
              {
                backgroundColor: selected
                  ? theme.colors.secondaryContainer
                  : theme.colors.surface,
                borderColor: selected
                  ? theme.colors.primary
                  : theme.colors.outline,
                opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
              },
            ]}
          >
            {option.icon && (
              <AppIcon
                color={
                  selected
                    ? theme.colors.onSecondaryContainer
                    : theme.colors.onSurface
                }
                name={option.icon}
                size={20}
              />
            )}
            <Text
              style={[
                styles.choiceButtonText,
                {
                  color: selected
                    ? theme.colors.onSecondaryContainer
                    : theme.colors.onSurface,
                },
              ]}
              variant="labelLarge"
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

interface SetupActionProps {
  accessibilityLabel?: string;
  disabled?: boolean;
  kind?: 'contained' | 'outlined';
  label: string;
  onPress: () => void;
  placement?: 'start' | 'stretch';
}

const SetupAction = ({
  accessibilityLabel,
  disabled = false,
  kind = 'contained',
  label,
  onPress,
  placement = 'stretch',
}: SetupActionProps) => {
  const theme = useAppTheme();
  const contained = kind === 'contained';

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        placement === 'start' && styles.actionButtonAtStart,
        {
          backgroundColor: contained ? theme.colors.primary : 'transparent',
          borderColor: contained ? theme.colors.primary : theme.colors.outline,
          opacity: disabled ? 0.5 : pressed ? 0.78 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.actionButtonText,
          {
            color: contained
              ? theme.colors.onPrimary
              : theme.colors.primary,
          },
        ]}
        variant="labelLarge"
      >
        {label}
      </Text>
    </Pressable>
  );
};

export const InitialSetup = ({ onComplete }: InitialSetupProps) => {
  const { language, setLanguage } = useContext(LanguageContext);
  const { toggleTheme } = useContext(ThemeContext);
  const { setTextScale, textScale } = useTextSize();
  const theme = useAppTheme();
  const { width: viewportWidth } = useWindowDimensions();
  const [isSavingTextScale, setIsSavingTextScale] = useState(false);
  const [failedTextScale, setFailedTextScale] = useState<TextScale | null>(null);
  const textScaleWritePendingRef = useRef(false);
  const failedTextScaleRef = useRef<TextScale | null>(null);
  const labels = setupLabels[language] ?? setupLabels.en;

  const persistTextScale = async (nextScale: TextScale) => {
    if (textScaleWritePendingRef.current) return;

    textScaleWritePendingRef.current = true;
    setIsSavingTextScale(true);
    try {
      await setTextScale(nextScale);
      failedTextScaleRef.current = null;
      setFailedTextScale(null);
    } catch {
      failedTextScaleRef.current = nextScale;
      setFailedTextScale(nextScale);
    } finally {
      textScaleWritePendingRef.current = false;
      setIsSavingTextScale(false);
    }
  };

  const completeSetup = () => {
    if (textScaleWritePendingRef.current || failedTextScaleRef.current !== null) {
      return;
    }
    onComplete();
  };

  return (
    <Portal>
      <Modal
        visible
        dismissable={false}
        contentContainerStyle={[
          styles.modal,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <ScrollView contentContainerStyle={styles.modalContent}>
          <Text variant="headlineMedium" style={styles.title}>
            {labels.title}
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {labels.subtitle}
          </Text>

          <View style={styles.section}>
            <Text variant="labelLarge" style={styles.label}>
              {labels.language}
            </Text>
            <SetupChoiceGroup
              value={language}
              disabled={isSavingTextScale}
              twoColumn={shouldUseTwoColumnOnboardingChoices(viewportWidth)}
              onValueChange={(value) => {
                if (!textScaleWritePendingRef.current) {
                  setLanguage(value as SupportedLanguage);
                }
              }}
              options={[
                { value: 'en', label: 'EN' },
                { value: 'zh', label: '繁體' },
                { value: 'zh-cn', label: '简体' },
                { value: 'es', label: 'ES' },
              ]}
            />
          </View>

          <View style={styles.section}>
            <Text variant="labelLarge" style={styles.label}>
              {labels.appearance}
            </Text>
            <SetupChoiceGroup
              value={theme.dark ? 'dark' : 'light'}
              disabled={isSavingTextScale}
              onValueChange={(value) => {
                if (!textScaleWritePendingRef.current) toggleTheme(value);
              }}
              options={[
                { value: 'light', label: labels.light, icon: 'weather-sunny' },
                { value: 'dark', label: labels.dark, icon: 'weather-night' },
              ]}
            />
          </View>

          <View style={styles.section}>
            <Text variant="labelLarge" style={styles.label}>
              {labels.textSize}
            </Text>
            <Text variant="bodySmall" style={styles.textSizeHelp}>
              {labels.textSizeHelp}
            </Text>
            <SetupChoiceGroup
              value={String(textScale)}
              disabled={isSavingTextScale}
              twoColumn={shouldUseTwoColumnOnboardingChoices(viewportWidth)}
              onValueChange={(value) => {
                const nextScale = Number(value);
                if (isTextScale(nextScale)) void persistTextScale(nextScale);
              }}
              options={TEXT_SCALE_OPTIONS.map((scale) => {
                const percent = Math.round(scale * 100);
                return {
                  accessibilityLabel: labels.percentLabel(percent),
                  label: `${percent}%`,
                  value: String(scale),
                };
              })}
            />
            {isSavingTextScale && (
              <Text
                accessibilityLiveRegion="polite"
                style={styles.textScaleStatus}
                variant="bodyMedium"
              >
                {labels.saving}
              </Text>
            )}
            {failedTextScale !== null && !isSavingTextScale && (
              <View style={styles.textScaleError}>
                <Text
                  accessibilityLiveRegion="assertive"
                  role="alert"
                  style={{ color: theme.colors.error }}
                  variant="bodyMedium"
                >
                  {labels.saveError(Math.round(failedTextScale * 100))}
                </Text>
                <SetupAction
                  accessibilityLabel={labels.retryLabel(
                    Math.round(failedTextScale * 100),
                  )}
                  kind="outlined"
                  label={labels.retry}
                  onPress={() => void persistTextScale(failedTextScale)}
                  placement="start"
                />
              </View>
            )}
          </View>

          <SetupAction
            disabled={isSavingTextScale || failedTextScale !== null}
            label={labels.start}
            onPress={completeSetup}
          />
        </ScrollView>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: {
    alignSelf: 'center',
    borderRadius: 16,
    marginVertical: 20,
    maxHeight: '90%',
    maxWidth: 500,
    width: '90%',
  },
  modalContent: {
    padding: 24,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: 32,
    opacity: 0.7,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontWeight: '600',
    marginBottom: 8,
  },
  textSizeHelp: {
    marginBottom: 12,
    opacity: 0.75,
  },
  actionButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  actionButtonAtStart: {
    alignSelf: 'flex-start',
  },
  actionButtonText: {
    flexShrink: 1,
    fontWeight: '700',
    textAlign: 'center',
  },
  choiceButton: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    flexBasis: 72,
    flexDirection: 'row',
    flexGrow: 1,
    flexShrink: 1,
    gap: 6,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  choiceButtonText: {
    flexShrink: 1,
    fontWeight: '700',
    textAlign: 'center',
  },
  twoColumnChoiceButton: {
    flexBasis: '45%',
  },
  choiceGroup: {
    alignItems: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  textScaleError: {
    marginTop: 12,
  },
  textScaleStatus: {
    marginTop: 12,
    opacity: 0.75,
  },
});
