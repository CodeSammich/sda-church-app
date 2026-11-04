import { AppAlertHost, getAppAlertForTests, resetAppAlertsForTests, showAppAlert } from '@/components/AppAlert';
import { customDarkTheme } from '@/constants/Themes';
import { act, fireEvent, within } from '@testing-library/react-native';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { StyleSheet } from 'react-native';
import { renderWithPreferences } from './helpers/render-preferences';

// The app's own popups, in place of the system's alerts, which on Android
// look nothing like the rest of the app.
const renderHost = (options: Parameters<typeof renderWithPreferences>[1] = {}) =>
  renderWithPreferences(createElement(AppAlertHost), options);

beforeEach(() => resetAppAlertsForTests());

describe('the app popup', () => {
  it('shows a notice with an X in its title row, and no Close button', async () => {
    const screen = await renderHost();
    await act(async () => showAppAlert('No connection', 'Connect to the internet to download.'));

    expect(screen.getByText('No connection')).toBeTruthy();
    expect(screen.getByText('Connect to the internet to download.')).toBeTruthy();
    // The X is an icon, so "Close" is only its screen-reader label.
    expect(screen.queryByText('Close')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('No connection')).toBeNull();
  });

  it('asks a question with its answers as buttons, the main one first and Cancel last, and no X', async () => {
    const useMobileData = jest.fn();
    const wait = jest.fn();
    const screen = await renderHost();
    await act(async () =>
      showAppAlert('Download on mobile data?', 'It can use your data plan.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Wait for Wi-Fi', onPress: wait },
        { text: 'Use mobile data', onPress: useMobileData },
      ]),
    );

    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    const answers = screen.getAllByText(/^(Use mobile data|Wait for Wi-Fi|Cancel)$/);
    expect(answers.map((text) => text.props.children)).toEqual(['Use mobile data', 'Wait for Wi-Fi', 'Cancel']);
    // They wrap at large text sizes: Paper's Button cut "Usar datos móviles"
    // to "Usar datos m..." at the largest.
    for (const answer of answers) expect(answer.props.numberOfLines).toBeUndefined();

    await fireEvent.press(screen.getByText('Use mobile data'));
    expect(useMobileData).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
    expect(getAppAlertForTests()).toBeNull();
    expect(screen.queryByText('Download on mobile data?')).toBeNull();
  });

  it("scrolls a question's title with its message, so the answers stay in the popup at the largest text sizes", async () => {
    // At the iPhone's largest text, the title and the answers overflowed the
    // height limit: the message vanished, and Cancel showed below the popup.
    const screen = await renderHost();
    await act(async () =>
      showAppAlert('¿Usar datos móviles?', 'Estás usando datos móviles.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Usar datos móviles' },
      ]),
    );
    const scroll = within(screen.getByTestId('app-alert-scroll'));
    expect(scroll.getByText('¿Usar datos móviles?')).toBeTruthy();
    expect(scroll.getByText('Estás usando datos móviles.')).toBeTruthy();
    expect(scroll.queryByText('Cancelar')).toBeNull();
    expect(screen.getByText('Cancelar')).toBeTruthy();
  });

  it('answers Cancel when the popup is dismissed', async () => {
    const cancel = jest.fn();
    const screen = await renderHost();
    await act(async () =>
      showAppAlert('Delete John?', undefined, [
        { text: 'Cancel', style: 'cancel', onPress: cancel },
        { text: 'Delete', style: 'destructive' },
      ]),
    );

    // A tap outside the popup; Android's Back does the same.
    await fireEvent.press(screen.getByRole('button', { name: 'Close modal' }));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(getAppAlertForTests()).toBeNull();
  });

  it('shows popups one at a time, and lets an answer show the next', async () => {
    const screen = await renderHost();
    await act(async () => {
      showAppAlert('First');
      showAppAlert('Second');
    });
    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.queryByText('Second')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByText('Second')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    await act(async () =>
      showAppAlert('Ask', undefined, [{ text: 'Go on', onPress: () => showAppAlert('Then this') }]),
    );
    await fireEvent.press(screen.getByText('Go on'));
    expect(screen.getByText('Then this')).toBeTruthy();
  });

  it('says text given in every language in the app’s', async () => {
    const screen = await renderHost({ language: 'zh-cn' });
    await act(async () =>
      showAppAlert(
        { en: 'Couldn’t open the link', zh: '無法開啟連結', 'zh-cn': '无法打开链接', es: 'No se pudo abrir el enlace' },
        { en: 'Try again.', zh: '再試一次。', 'zh-cn': '再试一次。', es: 'Vuelve a intentarlo.' },
      ),
    );

    expect(screen.getByText('无法打开链接')).toBeTruthy();
    expect(screen.getByText('再试一次。')).toBeTruthy();
    expect(screen.getByRole('button', { name: '关闭' })).toBeTruthy();
  });

  it('is 90% of a phone’s width, up to 560 points, as a number iOS applies to the whole popup', () => {
    // iOS's Paper Surface splits a percentage width from a maxWidth, so on an
    // iPad the content filled only part of the popup (#324).
    const source = readFileSync('components/AppAlert.tsx', 'utf8');
    expect(source).not.toMatch(/width: '\d+%'/);
    expect(source).not.toMatch(/maxWidth: \d+/);
    expect(source).toContain('width: Math.round(Math.min(screenWidth * 0.9, MAX_WIDTH))');
    expect(source).toContain('const MAX_WIDTH = 560;');
  });

  it('has the shared popup corners and canvas', async () => {
    const screen = await renderHost({ theme: customDarkTheme });
    await act(async () => showAppAlert('No connection'));

    const surface = StyleSheet.flatten(screen.getByTestId('app-alert-surface').props.style);
    expect(surface.backgroundColor).toBe(customDarkTheme.colors.background);
    expect(surface.borderRadius).toBe(21);
  });
});

describe('the system alerts', () => {
  const APP_CODE = ['app', 'components', 'constants', 'features', 'hooks', 'services', 'styles'];
  const files = (folder: string): string[] =>
    readdirSync(folder).flatMap((name) => {
      const path = join(folder, name);
      if (statSync(path).isDirectory()) return files(path);
      return /\.(ts|tsx)$/.test(name) ? [path] : [];
    });

  it('are never used: every popup is the app’s own', () => {
    const users = APP_CODE.flatMap(files).filter((file) =>
      /\bAlert\.(alert|prompt)\(|import \{[^}]*\bAlert\b[^}]*\} from 'react-native'/.test(readFileSync(file, 'utf8')),
    );
    expect(users).toEqual([]);
  });

  it('are shown by the one host, in the root layout', () => {
    expect(readFileSync('app/_layout.tsx', 'utf8').match(/<AppAlertHost \/>/g)).toHaveLength(1);
  });
});
