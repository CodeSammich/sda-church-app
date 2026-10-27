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
import {
  THEME_DARK,
  THEME_LIGHT,
  THEME_SUNSET,
  THEME_SYSTEM,
  ThemeContext,
  useAppTheme,
  type ThemeMode,
} from '@/constants/Themes';
import { getPopupSurfaceStyle, usePopupMaxHeight } from '@/styles/PopupStyles';
import { AppIcon } from '@/components/AppIcon';
import { PopupScrollView } from '@/components/PopupScrollView';
import { useContext, useRef, useState } from 'react';
import {
  Pressable,
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
    system: 'System',
    sunset: 'Sunrise/Sunset',
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
    next: 'Next',
    back: 'Back',
    step: (step: number, steps: number) => `Step ${step} of ${steps}`,
  },
  zh: {
    title: '歡迎',
    subtitle: '自訂您的使用體驗',
    language: '語言設定',
    appearance: '外觀模式',
    dark: '深色',
    light: '淺色',
    system: '系統',
    sunset: '日出/日落',
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
    next: '下一步',
    back: '上一步',
    step: (step: number, steps: number) => `第 ${step} 步，共 ${steps} 步`,
  },
  'zh-cn': {
    title: '欢迎',
    subtitle: '自定义您的使用体验',
    language: '语言设置',
    appearance: '外观模式',
    dark: '深色',
    light: '浅色',
    system: '系统',
    sunset: '日出/日落',
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
    next: '下一步',
    back: '上一步',
    step: (step: number, steps: number) => `第 ${step} 步，共 ${steps} 步`,
  },
  es: {
    title: 'Bienvenido',
    subtitle: 'Personalicemos tu experiencia',
    language: 'Idioma',
    appearance: 'Apariencia',
    dark: 'Oscuro',
    light: 'Claro',
    system: 'Sistema',
    sunset: 'Amanecer/Atardecer',
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
    next: 'Siguiente',
    back: 'Atrás',
    step: (step: number, steps: number) => `Paso ${step} de ${steps}`,
  },
} as const;

interface SetupChoice {
  accessibilityLabel?: string;
  icon?:
    | 'monitor-cellphone'
    | 'weather-night'
    | 'weather-sunny'
    | 'weather-sunset-down';
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
              adjustsFontSizeToFit
              numberOfLines={1}
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
  /** stretch: the popup's width; fill: a share of a row of buttons. */
  placement?: 'start' | 'stretch' | 'fill';
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
        placement === 'fill' && styles.actionButtonFill,
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

// One question per step (#523), so each fits on a phone and the button to go
// on is always in view: the language first, so the rest shows in it, then the
// text size, so the last step shows at that size.
export const SETUP_STEPS = ['language', 'textSize', 'appearance'] as const;

export const InitialSetup = ({ onComplete }: InitialSetupProps) => {
  const { language, setLanguage } = useContext(LanguageContext);
  const { setThemeMode, themeMode } = useContext(ThemeContext);
  // The chosen size, which a very large phone text size can reduce when drawn.
  const { setTextScale, textScale: drawnTextScale, preferredTextScale } = useTextSize();
  const textScale = preferredTextScale ?? drawnTextScale;
  const theme = useAppTheme();
  // Setup can't be closed, so it needs no room around it for a tap outside.
  const popupMaxHeight = usePopupMaxHeight(0.9);
  const { width: viewportWidth } = useWindowDimensions();
  const [isSavingTextScale, setIsSavingTextScale] = useState(false);
  const [failedTextScale, setFailedTextScale] = useState<TextScale | null>(null);
  const textScaleWritePendingRef = useRef(false);
  const failedTextScaleRef = useRef<TextScale | null>(null);
  const labels = setupLabels[language] ?? setupLabels.en;
  const [step, setStep] = useState(0);
  const currentStep = SETUP_STEPS[step];
  const lastStep = step === SETUP_STEPS.length - 1;
  // A text size that's saving, or failed to save, has to settle first.
  const textScaleUnsettled = isSavingTextScale || failedTextScale !== null;
  // The tallest step so far, which the shorter ones keep, so Next stays where
  // the last tap was.
  const [tallestStep, setTallestStep] = useState(0);

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

  const goOn = () => {
    if (lastStep) completeSetup();
    else if (!textScaleWritePendingRef.current && failedTextScaleRef.current === null) setStep(step + 1);
  };

  return (
    <Portal>
      <Modal
        visible
        dismissable={false}
        contentContainerStyle={[
          styles.modal,
          { maxHeight: popupMaxHeight },
          getPopupSurfaceStyle(theme),
        ]}
      >
        <View
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            setTallestStep((tallest) => Math.max(tallest, Math.ceil(height)));
          }}
          style={[styles.steps, { minHeight: Math.min(tallestStep, popupMaxHeight) }]}
        >
          {/* Keyed by step, so each step opens at its top. */}
          <PopupScrollView key={currentStep} contentContainerStyle={styles.modalContent}>
            {currentStep === 'language' && (
              <>
                <Text variant="headlineMedium" style={styles.title}>
                  {labels.title}
                </Text>
                <Text variant="bodyMedium" style={styles.subtitle}>
                  {labels.subtitle}
                </Text>
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
              </>
            )}

            {currentStep === 'textSize' && (
              <>
                <Text variant="headlineMedium" style={styles.title}>
                  {labels.textSize}
                </Text>
                <Text variant="bodyMedium" style={styles.subtitle}>
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
              </>
            )}

            {currentStep === 'appearance' && (
              <>
                <Text variant="headlineMedium" style={styles.title}>
                  {labels.appearance}
                </Text>
                <SetupChoiceGroup
                  value={themeMode}
                  disabled={isSavingTextScale}
                  twoColumn
                  onValueChange={(value) => {
                    if (!textScaleWritePendingRef.current) {
                      void setThemeMode(value as ThemeMode);
                    }
                  }}
                  options={[
                    {
                      value: THEME_SYSTEM,
                      label: labels.system,
                      icon: 'monitor-cellphone',
                    },
                    {
                      value: THEME_SUNSET,
                      label: labels.sunset,
                      icon: 'weather-sunset-down',
                    },
                    { value: THEME_LIGHT, label: labels.light, icon: 'weather-sunny' },
                    { value: THEME_DARK, label: labels.dark, icon: 'weather-night' },
                  ]}
                />
              </>
            )}
          </PopupScrollView>

          {/* Outside the scrolling part, so the way on is always in view. */}
          <View style={styles.footer}>
            <View
              accessible
              accessibilityLabel={labels.step(step + 1, SETUP_STEPS.length)}
              style={styles.dots}
            >
              {SETUP_STEPS.map((name, index) => (
                <View
                  key={name}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        index === step ? theme.colors.primary : theme.colors.outlineVariant,
                      width: index === step ? 20 : 8,
                    },
                  ]}
                />
              ))}
            </View>
            <View style={styles.actions}>
              {step > 0 && (
                <SetupAction
                  disabled={isSavingTextScale}
                  kind="outlined"
                  label={labels.back}
                  onPress={() => setStep(step - 1)}
                  placement="fill"
                />
              )}
              <SetupAction
                disabled={textScaleUnsettled}
                label={lastStep ? labels.start : labels.next}
                onPress={goOn}
                placement="fill"
              />
            </View>
          </View>
        </View>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: {
    alignSelf: 'center',
    marginVertical: 20,
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
    marginBottom: 24,
    opacity: 0.7,
    textAlign: 'center',
  },
  label: {
    fontWeight: '600',
    marginBottom: 8,
  },
  steps: {
    flexShrink: 1,
    justifyContent: 'space-between',
    minHeight: 0,
  },
  footer: {
    gap: 12,
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  dots: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    borderRadius: 4,
    height: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
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
  actionButtonFill: {
    flex: 1,
    marginTop: 0,
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
