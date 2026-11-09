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
import { AppIcon } from '@/components/AppIcon';
import { ContrastStep } from '@/components/ContrastChoice';
import { ChoiceCard, TabBarPreview, THEME_ICONS, THEME_PREVIEW_KINDS, ThemePreview } from '@/components/SettingChoices';
import { isKeyScreensBuild, SCREENSHOT_SETUP_STEP_KEY } from '@/services/ScreenshotRoute';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SetupAction } from '@/components/SetupAction';
import { getSetupWords, SetupHeading, SetupScreen } from '@/components/SetupScreen';
import { useContext, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';

interface InitialSetupProps {
  onComplete: () => void;
}

const setupLabels = {
  en: {
    title: 'Welcome',
    subtitle: "Let's personalize your experience",
    language: 'Language',
    appearance: 'Appearance',
    appearanceHelp: 'Choose how the app looks. You can change it any time under You → Theme.',
    dark: 'Dark',
    light: 'Light',
    system: 'System',
    sunset: 'Sunrise/Sunset',
    textSize: 'Text size',
    textSizeHelp: 'Choose a comfortable starting size. You can fine-tune it any time under You → Text size.',
    percentLabel: (percent: number) => `${percent} percent text size`,
    saving: 'Saving text size…',
    saveError: (percent: number) =>
      `${percent}% text size could not be saved. Retry before continuing.`,
    retry: 'Retry',
    retryLabel: (percent: number) =>
      `Retry saving ${percent} percent text size`,
  },
  zh: {
    title: '歡迎',
    subtitle: '自訂您的使用體驗',
    language: '語言設定',
    appearance: '外觀模式',
    appearanceHelp: '選擇應用程式的外觀，隨時可在「您」→「主題」中變更。',
    dark: '深色',
    light: '淺色',
    system: '系統',
    sunset: '日出/日落',
    textSize: '文字大小',
    textSizeHelp: '選擇舒適的起始大小，隨時可在「您」→「文字大小」中微調。',
    percentLabel: (percent: number) => `${percent}% 文字大小`,
    saving: '正在儲存文字大小…',
    saveError: (percent: number) =>
      `無法儲存 ${percent}% 文字大小。請重試後再繼續。`,
    retry: '重試',
    retryLabel: (percent: number) =>
      `重新嘗試儲存 ${percent}% 文字大小`,
  },
  'zh-cn': {
    title: '欢迎',
    subtitle: '自定义您的使用体验',
    language: '语言设置',
    appearance: '外观模式',
    appearanceHelp: '选择应用的外观，随时可在“您”→“主题”中更改。',
    dark: '深色',
    light: '浅色',
    system: '系统',
    sunset: '日出/日落',
    textSize: '文字大小',
    textSizeHelp: '选择舒适的起始大小，随时可在“您”→“文字大小”中微调。',
    percentLabel: (percent: number) => `${percent}% 文字大小`,
    saving: '正在保存文字大小…',
    saveError: (percent: number) =>
      `无法保存 ${percent}% 文字大小。请重试后再继续。`,
    retry: '重试',
    retryLabel: (percent: number) =>
      `重新尝试保存 ${percent}% 文字大小`,
  },
  es: {
    title: 'Bienvenido',
    subtitle: 'Personalicemos tu experiencia',
    language: 'Idioma',
    appearance: 'Apariencia',
    appearanceHelp: 'Elige cómo se ve la app. Puedes cambiarlo cuando quieras en Tú → Tema.',
    dark: 'Oscuro',
    light: 'Claro',
    system: 'Sistema',
    sunset: 'Amanecer/Atardecer',
    textSize: 'Tamaño del texto',
    textSizeHelp: 'Elige un tamaño inicial cómodo. Puedes ajustarlo cuando quieras en Tú → Tamaño del texto.',
    percentLabel: (percent: number) =>
      `Tamaño del texto al ${percent} por ciento`,
    saving: 'Guardando el tamaño del texto…',
    saveError: (percent: number) =>
      `No se pudo guardar el tamaño del texto al ${percent}%. Reinténtalo antes de continuar.`,
    retry: 'Reintentar',
    retryLabel: (percent: number) =>
      `Reintentar guardar el tamaño del texto al ${percent} por ciento`,
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

// One question per step (#523), so each fits on a phone and the button to go
// on is always in view: the language first, so the rest shows in it, then the
// text size, so the last steps show at that size, and last the contrast for
// light mode and for dark mode (#669), each asked, since a member may switch,
// or the System or Sunrise/Sunset theme switches for them.
export const SETUP_STEPS = ['language', 'textSize', 'appearance', 'contrastLight', 'contrastDark'] as const;

export const InitialSetup = ({ onComplete }: InitialSetupProps) => {
  const { language, setLanguage } = useContext(LanguageContext);
  const { contrastModes, setContrastMode, setThemeMode, themeMode } = useContext(ThemeContext);
  // The chosen size, which a very large phone text size can reduce when drawn.
  const { setTextScale, textScale: drawnTextScale, preferredTextScale } = useTextSize();
  const textScale = preferredTextScale ?? drawnTextScale;
  const theme = useAppTheme();
  const { width: viewportWidth } = useWindowDimensions();
  const [isSavingTextScale, setIsSavingTextScale] = useState(false);
  const [failedTextScale, setFailedTextScale] = useState<TextScale | null>(null);
  const textScaleWritePendingRef = useRef(false);
  const failedTextScaleRef = useRef<TextScale | null>(null);
  const labels = setupLabels[language] ?? setupLabels.en;
  const words = getSetupWords(language);
  const [step, setStep] = useState(0);
  // A key-screens build opens the step the capture saved, since it can't tap
  // Next, so each step has its own screenshot.
  useEffect(() => {
    if (!isKeyScreensBuild()) return;
    void AsyncStorage.getItem(SCREENSHOT_SETUP_STEP_KEY).then((saved) => {
      const index = SETUP_STEPS.indexOf(saved as (typeof SETUP_STEPS)[number]);
      if (index > 0) setStep(index);
    });
  }, []);
  const currentStep = SETUP_STEPS[step];
  const lastStep = step === SETUP_STEPS.length - 1;
  const contrastKind = currentStep === 'contrastDark' ? 'dark' : 'light';
  // A text size that's saving, or failed to save, has to settle first.
  const textScaleUnsettled = isSavingTextScale || failedTextScale !== null;

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
    // The whole screen (#681), in the page's colour, so each step has room for
    // its pictures and the way on sits at the bottom, where a thumb finds it.
    <SetupScreen
      scrollKey={currentStep}
      step={step}
      steps={SETUP_STEPS.length}
      actions={
        <>
          {step > 0 && (
            <SetupAction
              disabled={isSavingTextScale}
              kind="outlined"
              label={words.back}
              onPress={() => setStep(step - 1)}
              placement="fill"
            />
          )}
          <SetupAction
            disabled={textScaleUnsettled}
            label={lastStep ? words.start : words.next}
            onPress={goOn}
            placement="fill"
          />
        </>
      }
    >
      {currentStep === 'language' && (
        <>
          <SetupHeading title={labels.title} subtitle={labels.subtitle} />
          <Text variant="titleMedium" style={styles.label}>
            {labels.language}
          </Text>
          <View accessibilityRole="radiogroup" style={styles.cards}>
            {SETUP_LANGUAGES.map((option) => (
              <ChoiceCard
                key={option.value}
                disabled={isSavingTextScale}
                label={option.label}
                onPress={() => {
                  if (!textScaleWritePendingRef.current) setLanguage(option.value);
                }}
                selected={option.value === language}
                testID={`setup-language-${option.value}`}
              >
                <TabBarPreview language={option.value} />
              </ChoiceCard>
            ))}
          </View>
        </>
      )}

      {currentStep === 'textSize' && (
        <>
          <SetupHeading title={labels.textSize} subtitle={labels.textSizeHelp} />
          <TextSizeSample language={language} />
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
          <SetupHeading title={labels.appearance} subtitle={labels.appearanceHelp} />
          {/* One card a row, as the language step's are. */}
          <View accessibilityRole="radiogroup" style={styles.cards}>
            {(
              [
                { value: THEME_SYSTEM, label: labels.system },
                { value: THEME_SUNSET, label: labels.sunset },
                { value: THEME_LIGHT, label: labels.light },
                { value: THEME_DARK, label: labels.dark },
              ] as const
            ).map((option) => (
              <ChoiceCard
                key={option.value}
                disabled={isSavingTextScale}
                icon={THEME_ICONS[option.value]}
                label={option.label}
                onPress={() => {
                  if (!textScaleWritePendingRef.current) void setThemeMode(option.value as ThemeMode);
                }}
                selected={option.value === themeMode}
                testID={`setup-appearance-${option.value}`}
              >
                <ThemePreview contrastModes={contrastModes} kinds={THEME_PREVIEW_KINDS[option.value]} />
              </ChoiceCard>
            ))}
          </View>
        </>
      )}

      {/* High contrast stays chosen unless the member picks standard. */}
      {(currentStep === 'contrastLight' || currentStep === 'contrastDark') && (
        <ContrastStep
          key={contrastKind}
          kind={contrastKind}
          language={language}
          onChoose={(mode) => void setContrastMode(contrastKind, mode)}
          value={contrastModes[contrastKind]}
        />
      )}
    </SetupScreen>
  );
};


// Each language by its own name, with a picture of the tab bar in it.
const SETUP_LANGUAGES: readonly { value: SupportedLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '繁體中文' },
  { value: 'zh-cn', label: '简体中文' },
  { value: 'es', label: 'Español' },
];

// John 3:16 in each language's Bible that the app bundles: the BSB, the 1919
// Chinese Union Version in Traditional and Simplified characters, and the
// Reina-Valera 1909.
const SAMPLE_VERSE: Record<SupportedLanguage, { reference: string; text: string }> = {
  en: {
    reference: 'John 3:16',
    text: 'For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.',
  },
  zh: { reference: '約翰福音 3:16', text: '神愛世人、甚至將他的獨生子賜給他們、叫一切信他的、不至滅亡、反得永生。' },
  'zh-cn': { reference: '约翰福音 3:16', text: '神爱世人、甚至将他的独生子赐给他们、叫一切信他的、不至灭亡、反得永生。' },
  es: {
    reference: 'Juan 3:16',
    text: 'Porque de tal manera amó Dios al mundo, que ha dado á su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.',
  },
};

/** A verse at the chosen size, which grows and shrinks as the member picks one. */
function TextSizeSample({ language }: Readonly<{ language: SupportedLanguage }>) {
  const theme = useAppTheme();
  const verse = SAMPLE_VERSE[language] ?? SAMPLE_VERSE.en;
  return (
    <View style={[styles.sample, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
      <Text style={{ color: theme.colors.onSurfaceVariant }} variant="labelLarge">
        {verse.reference}
      </Text>
      <Text style={{ color: theme.colors.onSurface }} variant="bodyLarge">
        {verse.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontWeight: '600',
    marginBottom: 8,
  },
  cards: {
    gap: 12,
  },
  sample: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    marginBottom: 20,
    padding: 16,
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
