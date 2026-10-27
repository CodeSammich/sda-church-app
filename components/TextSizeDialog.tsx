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
import { PopupHeader } from '@/components/PopupHeader';
import { PopupScrollView } from '@/components/PopupScrollView';
import { LanguageContext } from '@/constants/LanguageContext';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import { getPopupSurfaceStyle, usePopupMaxHeight } from '@/styles/PopupStyles';
import { createElement, useContext, useEffect, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';

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
    reset: 'Reset to 125%',
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
    reset: '重設為 125%',
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
    reset: '重置为 125%',
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
    reset: 'Restablecer al 125%',
  },
} as const;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

interface TextDialogActionProps {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}

const TextDialogAction = ({
  disabled = false,
  label,
  onPress,
}: TextDialogActionProps) => {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.dialogAction,
        {
          borderColor: theme.colors.outline,
          opacity: disabled ? 0.5 : pressed ? 0.78 : 1,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[styles.dialogActionText, { color: theme.colors.primary }]}
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
}

const TextScaleStepAction = ({
  accessibilityLabel,
  disabled,
  label,
  onPress,
}: TextScaleStepActionProps) => {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepAction,
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
  // The chosen size, not the one drawn, which a very large phone text size can
  // reduce (MAX_COMBINED_TEXT_SCALE).
  const { setTextScale, textScale: drawnTextScale, preferredTextScale } = useTextSize();
  const textScale = preferredTextScale ?? drawnTextScale;
  const theme = useAppTheme();
  const popupMaxHeight = usePopupMaxHeight();
  const labels = labelsByLanguage[language] ?? labelsByLanguage.en;
  // The size the slider shows. While a finger drags the slider, it runs ahead
  // of the app's size, which changes when the finger lifts.
  const [draftScale, setDraftScale] = useState<TextScale>(textScale);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const appliedScale = useRef<TextScale | null>(textScale);

  // Only on opening: while it's open, a save that finishes late mustn't move
  // the slider back.
  useEffect(() => {
    if (visible) {
      setDraftScale(textScale);
      setApplyError(null);
      appliedScale.current = textScale;
    }
  }, [visible]);

  const currentPercent = Math.round(draftScale * 100);
  const stepPercent = Math.round(TEXT_SCALE_STEP * 100);
  const progress =
    (draftScale - TEXT_SCALE_MIN) / (TEXT_SCALE_MAX - TEXT_SCALE_MIN);

  // There's no Apply button: a new size takes effect for the whole app at
  // once, so the app behind the dialog shows it.
  const applyScale = (scale: TextScale) => {
    setDraftScale(scale);
    if (scale === appliedScale.current) return;
    appliedScale.current = scale;
    setApplyError(null);
    setTextScale(scale).catch(() => {
      // Let the same size be tried again.
      appliedScale.current = null;
      setApplyError(labels.saveError);
    });
  };

  const setPercent = (percent: number, apply = true) => {
    const snappedPercent = clamp(
      Math.round(percent / stepPercent) * stepPercent,
      TEXT_SCALE_MIN * 100,
      TEXT_SCALE_MAX * 100,
    );
    const nextScale = Number((snappedPercent / 100).toFixed(2));
    if (!isTextScale(nextScale)) return;
    const scale = normalizeTextScale(nextScale);
    if (apply) {
      applyScale(scale);
    } else {
      setDraftScale(scale);
    }
  };

  const adjustBySteps = (steps: number) =>
    setPercent(currentPercent + steps * stepPercent);

  // Resizing the whole app on every step of a drag would be slow, so a drag
  // moves only the slider and the preview until the finger lifts.
  const updateFromTouch = (event: GestureResponderEvent, apply = false) => {
    if (trackWidth <= 0) return;
    setPercent(
      (TEXT_SCALE_MIN +
        clamp(event.nativeEvent.locationX / trackWidth, 0, 1) *
          (TEXT_SCALE_MAX - TEXT_SCALE_MIN)) *
        100,
      apply,
    );
  };

  const handleTrackLayout = (event: LayoutChangeEvent) =>
    setTrackWidth(event.nativeEvent.layout.width);

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
        testID="text-size-dialog"
        visible={visible}
        onDismiss={onDismiss}
        style={[
          styles.dialog,
          { maxHeight: popupMaxHeight },
          getPopupSurfaceStyle(theme),
        ]}
      >
        <PopupHeader
          closeLabel={labels.close}
          onClose={onDismiss}
          style={styles.header}
          title={labels.title}
          variant="headlineSmall"
        />
        <Dialog.ScrollArea
          style={styles.scrollArea}
          testID="text-size-dialog-scroll-area"
        >
          <PopupScrollView contentContainerStyle={styles.scrollContent}>
            <Text variant="bodyMedium">{labels.description}</Text>
            <Text
              variant="titleMedium"
              accessibilityLiveRegion="polite"
              style={styles.currentValue}
            >
              {labels.current(currentPercent)}
            </Text>

            {Platform.OS === 'web' ? (
              <View style={styles.nativeSliderRow}>
                <View style={styles.webSlider}>
                  {createElement('input', {
                    'aria-label': labels.slider,
                    'aria-valuemax': TEXT_SCALE_MAX * 100,
                    'aria-valuemin': TEXT_SCALE_MIN * 100,
                    'aria-valuenow': currentPercent,
                    'aria-valuetext': labels.percent(currentPercent),
                    max: TEXT_SCALE_MAX * 100,
                    min: TEXT_SCALE_MIN * 100,
                    onInput: (event: { currentTarget: { value: string } }) =>
                      setPercent(Number(event.currentTarget.value)),
                    onKeyDown: handleWebSliderKeyDown,
                    step: stepPercent,
                    style: {
                      accentColor: theme.colors.primary,
                      cursor: 'pointer',
                      height: 44,
                      width: '100%',
                    },
                    type: 'range',
                    value: currentPercent,
                  })}
                </View>
              </View>
            ) : (
              <View style={styles.nativeSliderRow}>
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
                    if (event.nativeEvent.actionName === 'increment') {
                      adjustBySteps(1);
                    } else if (event.nativeEvent.actionName === 'decrement') {
                      adjustBySteps(-1);
                    }
                  }}
                  onLayout={handleTrackLayout}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={(event) => updateFromTouch(event)}
                  onResponderMove={(event) => updateFromTouch(event)}
                  onResponderRelease={(event) => updateFromTouch(event, true)}
                  // Keep the drag from the dialog's scrolling, and apply the
                  // size if the system takes the touch anyway.
                  onResponderTerminationRequest={() => false}
                  onResponderTerminate={() => applyScale(draftScale)}
                  onStartShouldSetResponder={() => true}
                  style={styles.nativeSlider}
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
              </View>
            )}

            <View style={styles.rangeLabels} accessible={false}>
              <Text variant="labelMedium">100%</Text>
              <Text variant="labelMedium">200%</Text>
            </View>
            <View style={styles.stepActionsRow}>
              <TextScaleStepAction
                accessibilityLabel={labels.decrease}
                disabled={draftScale === TEXT_SCALE_MIN}
                label="−5%"
                onPress={() => adjustBySteps(-1)}
              />
              <TextScaleStepAction
                accessibilityLabel={labels.increase}
                disabled={draftScale === TEXT_SCALE_MAX}
                label="+5%"
                onPress={() => adjustBySteps(1)}
              />
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
          </PopupScrollView>
        </Dialog.ScrollArea>
        <View style={styles.actions}>
          <TextDialogAction
            disabled={draftScale === DEFAULT_TEXT_SCALE}
            label={labels.reset}
            onPress={() => applyScale(DEFAULT_TEXT_SCALE)}
          />
        </View>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  actions: {
    paddingBottom: 16,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  currentValue: {
    marginTop: 20,
    textAlign: 'center',
  },
  dialog: {
    alignSelf: 'center',
    maxWidth: 560,
    width: '90%',
  },
  dialogAction: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 8,
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
  // Paper gives a dialog's first child a 24-point top margin; with the X's
  // 48-point row, 16 keeps the title where Paper's own title sits.
  header: {
    marginBottom: 8,
    marginTop: 16,
    paddingLeft: 24,
    paddingRight: 12,
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
  webSlider: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 100,
  },
  stepAction: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  stepActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
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
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingBottom: 4,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
});
