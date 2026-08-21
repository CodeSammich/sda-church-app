import {
  DEFAULT_TEXT_SCALE,
  isTextScale,
  normalizeTextScale,
  scaleTypographyMetric,
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  TEXT_SCALE_STEP,
  type TextScale,
} from '@/constants/AppPreferences';
import { LanguageContext } from '@/constants/LanguageContext';
import { useTextSize } from '@/constants/TextSizeContext';
import { createElement, useContext, useEffect, useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Dialog, Portal, Text, useTheme } from 'react-native-paper';

interface TextSizeDialogProps {
  onDismiss: () => void;
  visible: boolean;
}

const labelsByLanguage = {
  en: {
    title: 'Text size',
    description: 'Adjust persistent app text from 100% to 200%.',
    current: (percent: number) => `Current selection: ${percent}%`,
    slider: 'Text size',
    percent: (percent: number) => `${percent} percent`,
    decrease: 'Decrease text size by five percent',
    increase: 'Increase text size by five percent',
    previewAt: (percent: number) =>
      `Text size preview at ${percent} percent`,
    previewText: '“I was blind, but now I see.” — John 9:25',
    saveError: 'Text size could not be saved. Please try again.',
    close: 'Close',
    reset: 'Reset to 100%',
    apply: 'Apply',
    retry: 'Retry',
  },
  zh: {
    title: '字體大小',
    description: '將應用程式文字永久調整為 100% 至 200%。',
    current: (percent: number) => `目前選擇：${percent}%`,
    slider: '字體大小',
    percent: (percent: number) => `${percent}%`,
    decrease: '將字體大小減少百分之五',
    increase: '將字體大小增加百分之五',
    previewAt: (percent: number) => `${percent}% 字體大小預覽`,
    previewText: '「我從前是眼瞎的，如今能看見了。」— 約翰福音 9:25',
    saveError: '無法儲存字體大小。請再試一次。',
    close: '關閉',
    reset: '重設為 100%',
    apply: '套用',
    retry: '重試',
  },
  'zh-cn': {
    title: '字体大小',
    description: '将应用文字永久调整为 100% 至 200%。',
    current: (percent: number) => `当前选择：${percent}%`,
    slider: '字体大小',
    percent: (percent: number) => `${percent}%`,
    decrease: '将字体大小减少百分之五',
    increase: '将字体大小增加百分之五',
    previewAt: (percent: number) => `${percent}% 字体大小预览`,
    previewText: '“我从前是眼瞎的，如今能看见了。”— 约翰福音 9:25',
    saveError: '无法保存字体大小。请再试一次。',
    close: '关闭',
    reset: '重置为 100%',
    apply: '应用',
    retry: '重试',
  },
  es: {
    title: 'Tamaño del texto',
    description:
      'Ajusta de forma permanente el texto de la aplicación del 100% al 200%.',
    current: (percent: number) => `Selección actual: ${percent}%`,
    slider: 'Tamaño del texto',
    percent: (percent: number) => `${percent} por ciento`,
    decrease: 'Reducir el tamaño del texto en cinco por ciento',
    increase: 'Aumentar el tamaño del texto en cinco por ciento',
    previewAt: (percent: number) =>
      `Vista previa del texto al ${percent} por ciento`,
    previewText: '“Yo era ciego y ahora veo.” — Juan 9:25',
    saveError: 'No se pudo guardar el tamaño del texto. Inténtalo de nuevo.',
    close: 'Cerrar',
    reset: 'Restablecer al 100%',
    apply: 'Aplicar',
    retry: 'Reintentar',
  },
} as const;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export const shouldStackTextSizeDialogControls = (
  windowWidth: number,
  effectiveTextScale: number,
) => {
  const safeWidth = Number.isFinite(windowWidth) ? Math.max(0, windowWidth) : 0;
  const safeScale = Number.isFinite(effectiveTextScale)
    ? Math.max(1, effectiveTextScale)
    : 1;
  return safeScale >= 1.5 || safeWidth < 280;
};

interface TextDialogActionProps {
  busy?: boolean;
  disabled?: boolean;
  kind?: 'contained' | 'plain';
  label: string;
  onPress: () => void;
  stacked: boolean;
}

const TextDialogAction = ({
  busy = false,
  disabled = false,
  kind = 'plain',
  label,
  onPress,
  stacked,
}: TextDialogActionProps) => {
  const theme = useTheme();
  const contained = kind === 'contained';

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.dialogAction,
        stacked && styles.stackedDialogAction,
        {
          backgroundColor: contained ? theme.colors.primary : 'transparent',
          borderColor: contained ? theme.colors.primary : theme.colors.outline,
          opacity: disabled ? 0.5 : pressed ? 0.78 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.dialogActionText,
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

interface TextScaleStepActionProps {
  accessibilityLabel: string;
  disabled: boolean;
  label: string;
  onPress: () => void;
  stacked: boolean;
}

const TextScaleStepAction = ({
  accessibilityLabel,
  disabled,
  label,
  onPress,
  stacked,
}: TextScaleStepActionProps) => {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepAction,
        stacked && styles.stackedStepAction,
        {
          borderColor: theme.colors.outline,
          opacity: disabled ? 0.5 : pressed ? 0.78 : 1,
        },
      ]}
    >
      <Text
        style={[styles.stepActionText, { color: theme.colors.primary }]}
        variant="labelLarge"
      >
        {label}
      </Text>
    </Pressable>
  );
};

export const TextSizeDialog = ({ onDismiss, visible }: TextSizeDialogProps) => {
  const { language } = useContext(LanguageContext);
  const { setTextScale, textScale } = useTextSize();
  const theme = useTheme();
  const labels = labelsByLanguage[language] ?? labelsByLanguage.en;
  const [draftScale, setDraftScale] = useState<TextScale>(textScale);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const { fontScale, width: windowWidth } = useWindowDimensions();
  const stackControls = shouldStackTextSizeDialogControls(
    windowWidth,
    fontScale * textScale,
  );

  useEffect(() => {
    if (visible) {
      setDraftScale(textScale);
      setApplyError(null);
    }
  }, [textScale, visible]);

  const currentPercent = Math.round(draftScale * 100);
  const stepPercent = Math.round(TEXT_SCALE_STEP * 100);
  const progress =
    (draftScale - TEXT_SCALE_MIN) / (TEXT_SCALE_MAX - TEXT_SCALE_MIN);

  const setPercent = (percent: number) => {
    const snappedPercent = clamp(
      Math.round(percent / stepPercent) * stepPercent,
      TEXT_SCALE_MIN * 100,
      TEXT_SCALE_MAX * 100,
    );
    const nextScale = Number((snappedPercent / 100).toFixed(2));
    if (isTextScale(nextScale)) {
      setApplyError(null);
      setDraftScale(normalizeTextScale(nextScale));
    }
  };

  const adjustBySteps = (steps: number) =>
    setPercent(currentPercent + steps * stepPercent);

  const updateFromTouch = (event: GestureResponderEvent) => {
    if (isApplying || trackWidth <= 0) return;
    setPercent(
      (TEXT_SCALE_MIN +
        clamp(event.nativeEvent.locationX / trackWidth, 0, 1) *
          (TEXT_SCALE_MAX - TEXT_SCALE_MIN)) *
        100,
    );
  };

  const handleTrackLayout = (event: LayoutChangeEvent) =>
    setTrackWidth(event.nativeEvent.layout.width);

  const dismissWithoutApplying = () => {
    if (isApplying) return;
    setDraftScale(textScale);
    setApplyError(null);
    onDismiss();
  };

  const applyDraft = async () => {
    if (isApplying || !isTextScale(draftScale)) return;
    setIsApplying(true);
    setApplyError(null);
    try {
      await setTextScale(draftScale);
      onDismiss();
    } catch {
      setApplyError(labels.saveError);
    } finally {
      setIsApplying(false);
    }
  };

  const handleWebSliderKeyDown = (event: {
    key: string;
    preventDefault: () => void;
  }) => {
    const nextPercent = {
      ArrowDown: currentPercent - stepPercent,
      ArrowLeft: currentPercent - stepPercent,
      ArrowRight: currentPercent + stepPercent,
      ArrowUp: currentPercent + stepPercent,
      End: TEXT_SCALE_MAX * 100,
      Home: TEXT_SCALE_MIN * 100,
    }[event.key];
    if (nextPercent === undefined) return;
    event.preventDefault();
    setPercent(nextPercent);
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={dismissWithoutApplying}
        dismissable={!isApplying}
        dismissableBackButton={!isApplying}
        style={styles.dialog}
      >
        <Dialog.Title>{labels.title}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text variant="bodyMedium">{labels.description}</Text>
            <Text
              variant="titleMedium"
              accessibilityLiveRegion="polite"
              style={styles.currentValue}
            >
              {labels.current(currentPercent)}
            </Text>

            {Platform.OS === 'web' ? (
              <View
                style={[
                  styles.nativeSliderRow,
                  stackControls && styles.stackedNativeSliderRow,
                ]}
              >
                <TextScaleStepAction
                  accessibilityLabel={labels.decrease}
                  disabled={isApplying || draftScale === TEXT_SCALE_MIN}
                  label="−5%"
                  onPress={() => adjustBySteps(-1)}
                  stacked={stackControls}
                />
                <View
                  style={[
                    styles.webSlider,
                    stackControls && styles.stackedNativeSlider,
                  ]}
                >
                  {createElement('input', {
                    'aria-label': labels.slider,
                    'aria-valuemax': TEXT_SCALE_MAX * 100,
                    'aria-valuemin': TEXT_SCALE_MIN * 100,
                    'aria-valuenow': currentPercent,
                    'aria-valuetext': labels.percent(currentPercent),
                    disabled: isApplying,
                    max: TEXT_SCALE_MAX * 100,
                    min: TEXT_SCALE_MIN * 100,
                    onInput: (event: { currentTarget: { value: string } }) =>
                      setPercent(Number(event.currentTarget.value)),
                    onKeyDown: handleWebSliderKeyDown,
                    step: stepPercent,
                    style: {
                      accentColor: theme.colors.primary,
                      cursor: isApplying ? 'default' : 'pointer',
                      height: 44,
                      width: '100%',
                    },
                    type: 'range',
                    value: currentPercent,
                  })}
                </View>
                <TextScaleStepAction
                  accessibilityLabel={labels.increase}
                  disabled={isApplying || draftScale === TEXT_SCALE_MAX}
                  label="+5%"
                  onPress={() => adjustBySteps(1)}
                  stacked={stackControls}
                />
              </View>
            ) : (
              <View
                style={[
                  styles.nativeSliderRow,
                  stackControls && styles.stackedNativeSliderRow,
                ]}
              >
                <TextScaleStepAction
                  accessibilityLabel={labels.decrease}
                  disabled={isApplying || draftScale === TEXT_SCALE_MIN}
                  label="−5%"
                  onPress={() => adjustBySteps(-1)}
                  stacked={stackControls}
                />
                <View
                  accessible
                  accessibilityActions={[
                    { name: 'increment', label: labels.increase },
                    { name: 'decrement', label: labels.decrease },
                  ]}
                  accessibilityLabel={labels.slider}
                  accessibilityRole="adjustable"
                  accessibilityValue={{
                    max: TEXT_SCALE_MAX * 100,
                    min: TEXT_SCALE_MIN * 100,
                    now: currentPercent,
                    text: labels.percent(currentPercent),
                  }}
                  focusable
                  onAccessibilityAction={(event) => {
                    if (isApplying) return;
                    if (event.nativeEvent.actionName === 'increment') {
                      adjustBySteps(1);
                    } else if (event.nativeEvent.actionName === 'decrement') {
                      adjustBySteps(-1);
                    }
                  }}
                  onLayout={handleTrackLayout}
                  onMoveShouldSetResponder={() => !isApplying}
                  onResponderGrant={updateFromTouch}
                  onResponderMove={updateFromTouch}
                  onStartShouldSetResponder={() => !isApplying}
                  style={[
                    styles.nativeSlider,
                    stackControls && styles.stackedNativeSlider,
                  ]}
                >
                  <View
                    pointerEvents="none"
                    style={[
                      styles.nativeTrack,
                      { backgroundColor: theme.colors.surfaceVariant },
                    ]}
                  >
                    <View
                      style={[
                        styles.nativeTrackFill,
                        {
                          backgroundColor: theme.colors.primary,
                          width: `${progress * 100}%`,
                        },
                      ]}
                    />
                  </View>
                  <View
                    pointerEvents="none"
                    style={[
                      styles.nativeThumb,
                      {
                        backgroundColor: theme.colors.primary,
                        left: clamp(
                          trackWidth * progress - 10,
                          0,
                          Math.max(0, trackWidth - 20),
                        ),
                      },
                    ]}
                  />
                </View>
                <TextScaleStepAction
                  accessibilityLabel={labels.increase}
                  disabled={isApplying || draftScale === TEXT_SCALE_MAX}
                  label="+5%"
                  onPress={() => adjustBySteps(1)}
                  stacked={stackControls}
                />
              </View>
            )}

            <View style={styles.rangeLabels} accessible={false}>
              <Text variant="labelMedium">100%</Text>
              <Text variant="labelMedium">200%</Text>
            </View>
            <View
              accessibilityLabel={labels.previewAt(currentPercent)}
              style={[
                styles.preview,
                {
                  backgroundColor: theme.colors.surfaceVariant,
                  borderColor: theme.colors.outlineVariant,
                },
              ]}
            >
              <Text
                style={{
                  color: theme.colors.onSurface,
                  fontFamily: 'PlusJakartaSans-Regular',
                  fontSize: scaleTypographyMetric(16, draftScale),
                  lineHeight: scaleTypographyMetric(24, draftScale),
                }}
              >
                {labels.previewText}
              </Text>
            </View>
            {applyError && (
              <Text
                accessibilityLiveRegion="assertive"
                role="alert"
                style={[styles.errorText, { color: theme.colors.error }]}
                variant="bodyMedium"
              >
                {applyError}
              </Text>
            )}
          </ScrollView>
        </Dialog.ScrollArea>
        <View
          style={[styles.actions, stackControls && styles.stackedActions]}
        >
          <TextDialogAction
            disabled={isApplying}
            label={labels.close}
            onPress={dismissWithoutApplying}
            stacked={stackControls}
          />
          <TextDialogAction
            disabled={isApplying || draftScale === DEFAULT_TEXT_SCALE}
            label={labels.reset}
            onPress={() => setDraftScale(DEFAULT_TEXT_SCALE)}
            stacked={stackControls}
          />
          <TextDialogAction
            busy={isApplying}
            kind="contained"
            disabled={isApplying || draftScale === textScale}
            label={applyError ? labels.retry : labels.apply}
            onPress={() => void applyDraft()}
            stacked={stackControls}
          />
        </View>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  actions: {
    alignItems: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
    paddingBottom: 16,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  currentValue: {
    marginTop: 20,
    textAlign: 'center',
  },
  dialog: {
    alignSelf: 'center',
    maxHeight: '90%',
    maxWidth: 560,
    width: '90%',
  },
  dialogAction: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    flexGrow: 1,
    flexShrink: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 96,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dialogActionText: {
    flexShrink: 1,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 12,
  },
  nativeSlider: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    minWidth: 100,
  },
  nativeSliderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 8,
  },
  stackedActions: {
    flexDirection: 'column',
  },
  stackedDialogAction: {
    alignSelf: 'stretch',
    width: '100%',
  },
  stackedNativeSlider: {
    alignSelf: 'stretch',
    flexGrow: 0,
    flexShrink: 0,
    width: '100%',
  },
  stackedNativeSliderRow: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: 8,
  },
  stackedStepAction: {
    alignSelf: 'stretch',
    width: '100%',
  },
  webSlider: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 100,
  },
  stepAction: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  stepActionText: {
    flexShrink: 1,
    fontWeight: '700',
    textAlign: 'center',
  },
  nativeThumb: {
    borderRadius: 10,
    height: 20,
    position: 'absolute',
    width: 20,
  },
  nativeTrack: {
    borderRadius: 2,
    height: 4,
    overflow: 'hidden',
    width: '100%',
  },
  nativeTrackFill: {
    height: '100%',
  },
  preview: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
    padding: 16,
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  scrollArea: {
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
});
