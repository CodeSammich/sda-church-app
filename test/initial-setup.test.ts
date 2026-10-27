import {
  InitialSetup,
  shouldUseTwoColumnOnboardingChoices,
} from '@/components/InitialSetup';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { createElement } from 'react';
import { renderWithPreferences } from './helpers/render-preferences';

const languageCases = [
  {
    language: 'en' as const,
    next: 'Next',
    title: 'Welcome',
    textSize: 'Text size',
    option: '125 percent text size',
    saving: 'Saving text size…',
  },
  {
    language: 'zh' as const,
    next: '下一步',
    title: '歡迎',
    textSize: '字體大小',
    option: '125% 字體大小',
    saving: '正在儲存字體大小…',
  },
  {
    language: 'zh-cn' as const,
    next: '下一步',
    title: '欢迎',
    textSize: '字体大小',
    option: '125% 字体大小',
    saving: '正在保存字体大小…',
  },
  {
    language: 'es' as const,
    next: 'Siguiente',
    title: 'Bienvenido',
    textSize: 'Tamaño del texto',
    option: 'Tamaño del texto al 125 por ciento',
    saving: 'Guardando el tamaño del texto…',
  },
];

// Setup is a step for each question (#523): language, text size, appearance.
const goOn = (screen: Awaited<ReturnType<typeof renderWithPreferences>>, name = 'Next') =>
  fireEvent.press(screen.getByRole('button', { name }));

describe('InitialSetup', () => {
  it('uses two-column choice grids on iPhone-width screens', () => {
    expect(shouldUseTwoColumnOnboardingChoices(393)).toBe(true);
    expect(shouldUseTwoColumnOnboardingChoices(430)).toBe(true);
    expect(shouldUseTwoColumnOnboardingChoices(431)).toBe(false);
  });

  it('offers and persists the 200% onboarding text-size preset', async () => {
    const setTextScale = jest.fn().mockResolvedValue(undefined);
    const screen = await renderWithPreferences(
      createElement(InitialSetup, { onComplete: jest.fn() }),
      { setTextScale },
    );

    await goOn(screen);
    await fireEvent.press(screen.getByLabelText('200 percent text size'));

    await waitFor(() => {
      expect(setTextScale).toHaveBeenCalledWith(2);
    });
  });

  it('exposes every wrapping preset as an independent radio control', async () => {
    const setLanguage = jest.fn();
    const setThemeMode = jest.fn();
    const screen = await renderWithPreferences(
      createElement(InitialSetup, { onComplete: jest.fn() }),
      { setLanguage, setThemeMode },
    );

    // Four choices on each step.
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getByRole('radio', { name: 'EN' }).props.accessibilityState)
      .toMatchObject({ checked: true, disabled: false });
    await fireEvent.press(screen.getByRole('radio', { name: '繁體' }));

    await goOn(screen);
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(
      screen.getByRole('radio', { name: '125 percent text size' }).props
        .accessibilityState,
    ).toMatchObject({ checked: true, disabled: false });

    await goOn(screen);
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    await fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));

    expect(setLanguage).toHaveBeenCalledWith('zh');
    expect(setThemeMode).toHaveBeenCalledWith('dark');
    expect(screen.queryByRole('radio', { name: 'Automatic' })).toBeNull();
  });

  it('exposes the four explicit appearance choices', async () => {
    const screen = await renderWithPreferences(
      createElement(InitialSetup, { onComplete: jest.fn() }),
    );
    await goOn(screen);
    await goOn(screen);

    expect(screen.getByRole('radio', { name: 'System' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Sunrise/Sunset' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Light' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeTruthy();
  });

  it.each(languageCases)(
    'renders localized presets and saving status for $language',
    async ({ language, next, title, textSize, option, saving }) => {
      let resolvePersistence: (() => void) | undefined;
      const setTextScale = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            resolvePersistence = resolve;
          }),
      );
      const screen = await renderWithPreferences(
        createElement(InitialSetup, { onComplete: jest.fn() }),
        { language, setTextScale },
      );

      expect(screen.getByText(title)).toBeTruthy();
      await goOn(screen, next);
      expect(screen.getByText(textSize)).toBeTruthy();
      expect(screen.getByText('100%')).toBeTruthy();
      expect(screen.getByText('125%')).toBeTruthy();
      expect(screen.getByText('150%')).toBeTruthy();
      expect(screen.getByText('200%')).toBeTruthy();

      await fireEvent.press(screen.getByLabelText(option));
      expect(screen.getByText(saving)).toBeTruthy();
      expect(setTextScale).toHaveBeenCalledWith(1.25);
      // The size has to save before setup goes on.
      expect(screen.getByRole('button', { name: next }).props.accessibilityState).toMatchObject({ disabled: true });

      await act(async () => {
        resolvePersistence?.();
      });
      await waitFor(() => {
        expect(screen.queryByText(saving)).toBeNull();
      });
    },
  );

  it('blocks completion after a failed write and offers a localized retry', async () => {
    const onComplete = jest.fn();
    const setTextScale = jest
      .fn()
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce(undefined);
    const screen = await renderWithPreferences(
      createElement(InitialSetup, { onComplete }),
      { language: 'es', setTextScale },
    );

    await goOn(screen, 'Siguiente');
    await fireEvent.press(
      screen.getByLabelText('Tamaño del texto al 150 por ciento'),
    );
    await waitFor(() => {
      expect(
        screen.getByText(
          'No se pudo guardar el tamaño del texto al 150%. Reinténtalo antes de continuar.',
        ),
      ).toBeTruthy();
    });

    await goOn(screen, 'Siguiente');
    expect(screen.getByLabelText('Tamaño del texto al 150 por ciento')).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();

    await fireEvent.press(
      screen.getByLabelText(
        'Reintentar guardar el tamaño del texto al 150 por ciento',
      ),
    );
    await waitFor(() => {
      expect(setTextScale).toHaveBeenCalledTimes(2);
      expect(
        screen.queryByText(
          'No se pudo guardar el tamaño del texto al 150%. Reinténtalo antes de continuar.',
        ),
      ).toBeNull();
    });

    await goOn(screen, 'Siguiente');
    await goOn(screen, 'Comenzar');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('goes through the three steps, back and on, and finishes on the last', async () => {
    const onComplete = jest.fn();
    const screen = await renderWithPreferences(createElement(InitialSetup, { onComplete }));
    const stepLabel = (n: number) => screen.getByLabelText(`Step ${n} of 3`);

    expect(stepLabel(1)).toBeTruthy();
    expect(screen.getByText('Language')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Get Started' })).toBeNull();

    await goOn(screen);
    expect(stepLabel(2)).toBeTruthy();
    expect(screen.getByText('Text size')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(stepLabel(1)).toBeTruthy();
    expect(screen.getByText('Language')).toBeTruthy();

    await goOn(screen);
    await goOn(screen);
    expect(stepLabel(3)).toBeTruthy();
    expect(screen.getByText('Appearance')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();

    await goOn(screen, 'Get Started');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
