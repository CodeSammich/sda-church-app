import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent } from '@testing-library/react-native';
import { createElement } from 'react';
import { SwitchRow } from '@/components/SwitchRow';
import { renderWithPreferences } from './helpers/render-preferences';

const renderRow = (value: boolean, onValueChange = jest.fn()) =>
  renderWithPreferences(
    createElement(SwitchRow, {
      label: '雙語閱讀',
      description: '在每節經文下方顯示輔助譯本。',
      value,
      onValueChange,
    }),
  );

describe('a setting that is on or off (#798)', () => {
  it('turns on or off from a tap on its words, not only its switch', async () => {
    const onValueChange = jest.fn();
    const view = await renderRow(true, onValueChange);
    await fireEvent.press(view.getByText('雙語閱讀'));
    expect(onValueChange).toHaveBeenLastCalledWith(false);
    await fireEvent.press(view.getByText('在每節經文下方顯示輔助譯本。'));
    expect(onValueChange).toHaveBeenCalledTimes(2);
    await view.unmount();

    const off = jest.fn();
    const offView = await renderRow(false, off);
    await fireEvent.press(offView.getByText('雙語閱讀'));
    expect(off).toHaveBeenLastCalledWith(true);
  });

  it('is one switch to a screen reader, with its name, what it does, and whether it is on', async () => {
    const view = await renderRow(true);
    const [row] = view.getAllByRole('switch');
    expect(view.getAllByRole('switch')).toHaveLength(1);
    expect(row.props.accessibilityLabel).toBe('雙語閱讀');
    expect(row.props.accessibilityHint).toBe('在每節經文下方顯示輔助譯本。');
    expect(row.props.accessibilityState).toEqual({ checked: true });
    // The switch drawn beside the words is only a picture of it.
    expect(
      view.getByTestId('menu-card-switch-visual', { includeHiddenElements: true }).props.accessible,
    ).toBe(false);
    await view.unmount();

    const offView = await renderRow(false);
    expect(offView.getByRole('switch').props.accessibilityState).toEqual({ checked: false });
  });
});

// Every file of the app's own code, to check no screen draws a switch alone.
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });

it("draws every on/off setting as a SwitchRow, whose words turn it on or off (#798)", () => {
  const root = join(__dirname, '..');
  const files = ['app', 'components', 'features'].flatMap((dir) => sourceFiles(join(root, dir)));
  // A switch on its own, from Paper or React Native, turns on only where
  // it's drawn: the Bible's Dual-language reading and pinyin rows were so.
  const alone = files.filter((file) =>
    /import\s*\{[^}]*\bSwitch\b[^}]*\}\s*from\s*'react-native(-paper)?'/.test(readFileSync(file, 'utf8')),
  );
  expect(alone.map((file) => file.slice(root.length + 1))).toEqual([]);
  const bible = readFileSync(join(root, 'app/(tabs)/bible/index.tsx'), 'utf8');
  expect(bible.match(/<SwitchRow\b/g)).toHaveLength(2);
});
