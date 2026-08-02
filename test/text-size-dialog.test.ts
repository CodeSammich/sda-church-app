import {
  shouldStackTextSizeDialogControls,
  TextSizeDialog,
} from '@/components/TextSizeDialog';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { createElement } from 'react';
import { renderWithPreferences } from './helpers/render-preferences';

const languageCases = [
  {
    language: 'en' as const,
    title: 'Text size',
    description: 'Adjust persistent app text from 100% to 200%.',
    current: 'Current selection: 100%',
    increase: 'Increase text size by five percent',
    removedPreviewLabel: 'Live preview',
    preview: '“I was blind, but now I see.” — John 9:25',
  },
  {
    language: 'zh' as const,
    title: '字體大小',
    description: '將應用程式文字永久調整為 100% 至 200%。',
    current: '目前選擇：100%',
    increase: '將字體大小增加百分之五',
    removedPreviewLabel: '即時預覽',
    preview: '「我從前是眼瞎的，如今能看見了。」— 約翰福音 9:25',
  },
  {
    language: 'zh-cn' as const,
    title: '字体大小',
    description: '将应用文字永久调整为 100% 至 200%。',
    current: '当前选择：100%',
    increase: '将字体大小增加百分之五',
    removedPreviewLabel: '实时预览',
    preview: '“我从前是眼瞎的，如今能看见了。”— 约翰福音 9:25',
  },
  {
    language: 'es' as const,
    title: 'Tamaño del texto',
    description:
      'Ajusta de forma permanente el texto de la aplicación del 100% al 200%.',
    current: 'Selección actual: 100%',
    increase: 'Aumentar el tamaño del texto en cinco por ciento',
    removedPreviewLabel: 'Vista previa en vivo',
    preview: '“Yo era ciego y ahora veo.” — Juan 9:25',
  },
];

describe('TextSizeDialog', () => {
  it('reflows dense native controls for phone-width enlarged text', () => {
    expect(shouldStackTextSizeDialogControls(320, 4)).toBe(true);
    expect(shouldStackTextSizeDialogControls(320, 2)).toBe(true);
    expect(shouldStackTextSizeDialogControls(1024, 1)).toBe(false);
  });

  it.each(languageCases)(
    'renders complete localized controls for $language',
    ({
      language,
      title,
      description,
      current,
      increase,
      preview,
      removedPreviewLabel,
    }) => {
      const screen = renderWithPreferences(
        createElement(TextSizeDialog, { onDismiss: jest.fn(), visible: true }),
        { language },
      );

      expect(screen.getByText(title)).toBeTruthy();
      expect(screen.getByText(description)).toBeTruthy();
      expect(screen.getByText(current)).toBeTruthy();
      expect(screen.getByLabelText(increase)).toBeTruthy();
      expect(screen.getByText(preview)).toBeTruthy();
      expect(screen.queryByText(removedPreviewLabel)).toBeNull();
    },
  );

  it('applies a 5% change and dismisses only after persistence resolves', async () => {
    let resolvePersistence: (() => void) | undefined;
    const setTextScale = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePersistence = resolve;
        }),
    );
    const onDismiss = jest.fn();
    const screen = renderWithPreferences(
      createElement(TextSizeDialog, { onDismiss, visible: true }),
      { setTextScale },
    );

    fireEvent.press(
      screen.getByLabelText('Increase text size by five percent'),
    );
    expect(screen.getByText('Current selection: 105%')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Apply' }));

    expect(setTextScale).toHaveBeenCalledWith(1.05);
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent(
      screen.getByRole('adjustable'),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } },
    );
    expect(screen.queryByText('Current selection: 110%')).toBeNull();
    expect(setTextScale).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePersistence?.();
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('announces a localized failure and succeeds through the explicit retry', async () => {
    const onDismiss = jest.fn();
    const setTextScale = jest
      .fn()
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce(undefined);
    const screen = renderWithPreferences(
      createElement(TextSizeDialog, { onDismiss, visible: true }),
      { language: 'zh-cn', setTextScale },
    );

    fireEvent.press(screen.getByLabelText('将字体大小增加百分之五'));
    fireEvent.press(screen.getByRole('button', { name: '应用' }));

    await waitFor(() => {
      expect(
        screen.getByText('无法保存字体大小。请再试一次。'),
      ).toBeTruthy();
    });
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => {
      expect(setTextScale).toHaveBeenCalledTimes(2);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });
});
