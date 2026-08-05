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
    title: 'Welcome',
    textSize: 'Text size',
    option: '125 percent text size',
    saving: 'Saving text size…',
  },
  {
    language: 'zh' as const,
    title: '歡迎',
    textSize: '字體大小',
    option: '125% 字體大小',
    saving: '正在儲存字體大小…',
  },
  {
    language: 'zh-cn' as const,
    title: '欢迎',
    textSize: '字体大小',
    option: '125% 字体大小',
    saving: '正在保存字体大小…',
  },
  {
    language: 'es' as const,
    title: 'Bienvenido',
    textSize: 'Tamaño del texto',
    option: 'Tamaño del texto al 125 por ciento',
    saving: 'Guardando el tamaño del texto…',
  },
];

describe('InitialSetup', () => {
  it('uses two-column choice grids on iPhone-width screens', () => {
    expect(shouldUseTwoColumnOnboardingChoices(393)).toBe(true);
    expect(shouldUseTwoColumnOnboardingChoices(430)).toBe(true);
    expect(shouldUseTwoColumnOnboardingChoices(431)).toBe(false);
  });

  it('offers and persists the 200% onboarding text-size preset', async () => {
    const setTextScale = jest.fn().mockResolvedValue(undefined);
    const screen = renderWithPreferences(
      createElement(InitialSetup, { onComplete: jest.fn() }),
      { setTextScale },
    );

    fireEvent.press(screen.getByLabelText('200 percent text size'));

    await waitFor(() => {
      expect(setTextScale).toHaveBeenCalledWith(2);
    });
  });

  it('exposes every wrapping preset as an independent radio control', () => {
    const setLanguage = jest.fn();
    const toggleTheme = jest.fn();
    const screen = renderWithPreferences(
      createElement(InitialSetup, { onComplete: jest.fn() }),
      { setLanguage, toggleTheme },
    );

    expect(screen.getAllByRole('radio')).toHaveLength(10);
    expect(screen.getByRole('radio', { name: 'EN' }).props.accessibilityState)
      .toMatchObject({ checked: true, disabled: false });

    fireEvent.press(screen.getByRole('radio', { name: '繁體' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));

    expect(setLanguage).toHaveBeenCalledWith('zh');
    expect(toggleTheme).toHaveBeenCalledWith('dark');
  });

  it.each(languageCases)(
    'renders localized presets and saving status for $language',
    async ({ language, title, textSize, option, saving }) => {
      let resolvePersistence: (() => void) | undefined;
      const setTextScale = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            resolvePersistence = resolve;
          }),
      );
      const screen = renderWithPreferences(
        createElement(InitialSetup, { onComplete: jest.fn() }),
        { language, setTextScale },
      );

      expect(screen.getByText(title)).toBeTruthy();
      expect(screen.getByText(textSize)).toBeTruthy();
      expect(screen.getByText('100%')).toBeTruthy();
      expect(screen.getByText('125%')).toBeTruthy();
      expect(screen.getByText('150%')).toBeTruthy();
      expect(screen.getByText('200%')).toBeTruthy();

      fireEvent.press(screen.getByLabelText(option));
      expect(screen.getByText(saving)).toBeTruthy();
      expect(setTextScale).toHaveBeenCalledWith(1.25);

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
    const screen = renderWithPreferences(
      createElement(InitialSetup, { onComplete }),
      { language: 'es', setTextScale },
    );

    fireEvent.press(
      screen.getByLabelText('Tamaño del texto al 150 por ciento'),
    );
    await waitFor(() => {
      expect(
        screen.getByText(
          'No se pudo guardar el tamaño del texto al 150%. Reinténtalo antes de continuar.',
        ),
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByRole('button', { name: 'Comenzar' }));
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.press(
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

    fireEvent.press(screen.getByRole('button', { name: 'Comenzar' }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
