import { TextSizeDialog, textSizeStepsFitBesideSlider } from '@/components/TextSizeDialog';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { createElement } from 'react';
import { customDarkTheme, customLightTheme } from '@/constants/Themes';
import { renderWithPreferences } from './helpers/render-preferences';
import { getSheetColor } from './helpers/sheets';

// React Native's test window, which the other tests here see, until a test
// sets a phone's.
const TEST_WINDOW = { fontScale: 2, height: 1334, scale: 2, width: 750 };
let mockWindow = TEST_WINDOW;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));
afterEach(() => {
  mockWindow = TEST_WINDOW;
});

const languageCases = [
  {
    language: 'en' as const,
    title: 'Text size',
    description: 'Adjust persistent app text from 100% to 200%.',
    current: 'Current selection: 125%',
    increase: 'Increase text size by five percent',
    reset: 'Reset to 125%',
    removedPreviewLabel: 'Live preview',
    preview: '“I was blind, but now I see.” — John\u00a09:25',
  },
  {
    language: 'zh' as const,
    title: '字體大小',
    description: '將應用程式文字永久調整為 100% 至 200%。',
    current: '目前選擇：125%',
    increase: '將字體大小增加百分之五',
    reset: '重設為 125%',
    removedPreviewLabel: '即時預覽',
    preview: '「我從前是眼瞎的，如今能看見了。」— 約\u2060翰\u2060福\u2060音\u00a09:25',
  },
  {
    language: 'zh-cn' as const,
    title: '字体大小',
    description: '将应用文字永久调整为 100% 至 200%。',
    current: '当前选择：125%',
    increase: '将字体大小增加百分之五',
    reset: '重置为 125%',
    removedPreviewLabel: '实时预览',
    preview: '“我从前是眼瞎的，如今能看见了。”— 约\u2060翰\u2060福\u2060音\u00a09:25',
  },
  {
    language: 'es' as const,
    title: 'Tamaño del texto',
    description:
      'Ajusta de forma permanente el texto de la aplicación del 100% al 200%.',
    current: 'Selección actual: 125%',
    increase: 'Aumentar el tamaño del texto en cinco por ciento',
    reset: 'Restablecer al 125%',
    removedPreviewLabel: 'Vista previa en vivo',
    preview: '“Yo era ciego y ahora veo.” — Juan\u00a09:25',
  },
];

describe('TextSizeDialog', () => {
  it.each([customLightTheme, customDarkTheme])(
    'is a sheet the colour of the $dark theme\'s floating bars (#867)',
    async (theme) => {
      const screen = await renderWithPreferences(
        createElement(TextSizeDialog, {
          onDismiss: jest.fn(),
          visible: true,
        }),
        { theme },
      );

      expect(getSheetColor(screen)).toBe(theme.colors.floatingSurface);
      expect(screen.getByTestId('text-size-dialog-scroll')).toBeTruthy();
    },
  );

  it.each(languageCases)(
    'renders complete localized controls for $language',
    async ({
      language,
      title,
      description,
      current,
      increase,
      reset,
      preview,
      removedPreviewLabel,
    }) => {
      const screen = await renderWithPreferences(
        createElement(TextSizeDialog, { onDismiss: jest.fn(), visible: true }),
        { language },
      );

      expect(screen.getByText(title)).toBeTruthy();
      expect(screen.getByText(description)).toBeTruthy();
      expect(screen.getByText(current)).toBeTruthy();
      expect(screen.getByLabelText(increase)).toBeTruthy();
      expect(screen.getByRole('button', { name: reset })).toBeTruthy();
      expect(screen.getByText(preview)).toBeTruthy();
      expect(screen.queryByText(removedPreviewLabel)).toBeNull();
    },
  );

  it('applies each 5% change at once and stays open', async () => {
    const setTextScale = jest.fn().mockResolvedValue(undefined);
    const onDismiss = jest.fn();
    const screen = await renderWithPreferences(
      createElement(TextSizeDialog, { onDismiss, visible: true }),
      { setTextScale },
    );

    await fireEvent.press(
      screen.getByLabelText('Increase text size by five percent'),
    );
    expect(screen.getByText('Current selection: 130%')).toBeTruthy();
    expect(setTextScale).toHaveBeenLastCalledWith(1.3);

    await fireEvent(
      screen.getByRole('adjustable'),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } },
    );
    expect(screen.getByText('Current selection: 135%')).toBeTruthy();
    expect(setTextScale).toHaveBeenLastCalledWith(1.35);
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
  });

  it('applies a slider drag when the finger lifts', async () => {
    const setTextScale = jest.fn().mockResolvedValue(undefined);
    const screen = await renderWithPreferences(
      createElement(TextSizeDialog, { onDismiss: jest.fn(), visible: true }),
      { setTextScale },
    );
    const slider = screen.getByRole('adjustable');

    await fireEvent(slider, 'layout', { nativeEvent: { layout: { width: 200 } } });
    await fireEvent(slider, 'responderGrant', { nativeEvent: { locationX: 100 } });
    await fireEvent(slider, 'responderMove', { nativeEvent: { locationX: 200 } });
    expect(screen.getByText('Current selection: 200%')).toBeTruthy();
    expect(setTextScale).not.toHaveBeenCalled();

    await fireEvent(slider, 'responderRelease', { nativeEvent: { locationX: 200 } });
    expect(setTextScale).toHaveBeenCalledTimes(1);
    expect(setTextScale).toHaveBeenCalledWith(2);
  });

  it('resets a smaller selection to the 125% default at once', async () => {
    const setTextScale = jest.fn().mockResolvedValue(undefined);
    const screen = await renderWithPreferences(
      createElement(TextSizeDialog, { onDismiss: jest.fn(), visible: true }),
      { setTextScale, textScale: 1 },
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Reset to 125%' }));

    expect(screen.getByText('Current selection: 125%')).toBeTruthy();
    expect(setTextScale).toHaveBeenCalledWith(1.25);
  });

  it("resets to a tablet's 150% default, and names it (#324)", async () => {
    const setTextScale = jest.fn().mockResolvedValue(undefined);
    const screen = await renderWithPreferences(
      createElement(TextSizeDialog, { onDismiss: jest.fn(), visible: true }),
      { setTextScale, textScale: 1.25, defaultTextScale: 1.5 },
    );

    expect(screen.queryByRole('button', { name: 'Reset to 125%' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Reset to 150%' }));

    expect(screen.getByText('Current selection: 150%')).toBeTruthy();
    expect(setTextScale).toHaveBeenCalledWith(1.5);
  });

  it('announces a localized failure and clears it when the next size saves', async () => {
    const onDismiss = jest.fn();
    const setTextScale = jest
      .fn()
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce(undefined);
    const screen = await renderWithPreferences(
      createElement(TextSizeDialog, { onDismiss, visible: true }),
      { language: 'zh-cn', setTextScale },
    );

    await fireEvent.press(screen.getByLabelText('将字体大小增加百分之五'));
    await waitFor(() => {
      expect(
        screen.getByText('无法保存字体大小。请再试一次。'),
      ).toBeTruthy();
    });

    await fireEvent.press(screen.getByLabelText('将字体大小增加百分之五'));
    expect(setTextScale).toHaveBeenCalledTimes(2);
    expect(setTextScale).toHaveBeenLastCalledWith(1.35);
    expect(screen.queryByText('无法保存字体大小。请再试一次。')).toBeNull();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('keeps the sample in view at 150% on a phone, with the steps beside the slider (#797)', async () => {
    // The two rows of steps and 100%/200% below the slider pushed the sample
    // past the height limit at 150%, cut off at 9:25. The steps sit either
    // side of the slider wherever it keeps 120 points: a phone at 150%, and
    // the 384-point Android phone's full-width sheet at 200% (#867), but not
    // a 320-point iPad window at 200%.
    expect(textSizeStepsFitBesideSlider(345.6 - 48, 1.5)).toBe(true);
    expect(textSizeStepsFitBesideSlider(362 - 48, 1.5)).toBe(true);
    expect(textSizeStepsFitBesideSlider(288 - 48, 1.5)).toBe(false);
    expect(textSizeStepsFitBesideSlider(345.6 - 48, 2)).toBe(false);
    expect(textSizeStepsFitBesideSlider(384 - 48, 2)).toBe(true);
    expect(textSizeStepsFitBesideSlider(320 - 48, 2)).toBe(false);
    expect(textSizeStepsFitBesideSlider(504 - 48, 2)).toBe(true);

    // The Android phone the key screens use.
    mockWindow = { fontScale: 1, height: 853, scale: 2, width: 384 };
    const beside = await renderWithPreferences(
      createElement(TextSizeDialog, { onDismiss: jest.fn(), visible: true }),
      { language: 'zh', textScale: 1.5 },
    );
    expect(beside.queryByText('100%')).toBeNull();
    expect(beside.getByLabelText('將字體大小減少百分之五')).toBeTruthy();
    expect(beside.getByLabelText('將字體大小增加百分之五')).toBeTruthy();
    // 約翰福音 9:25 moves to the next line whole, never with 9:25 alone.
    expect(beside.getByText('「我從前是眼瞎的，如今能看見了。」— 約\u2060翰\u2060福\u2060音\u00a09:25')).toBeTruthy();
    beside.unmount();

    // A 320-point iPad window (Slide Over).
    mockWindow = { fontScale: 1, height: 853, scale: 2, width: 320 };
    const below = await renderWithPreferences(
      createElement(TextSizeDialog, { onDismiss: jest.fn(), visible: true }),
      { textScale: 2 },
    );
    expect(below.getByText('100%')).toBeTruthy();
    expect(below.getByText('200%')).toBeTruthy();
  });
});
