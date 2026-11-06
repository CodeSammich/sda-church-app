import { balanceLabel, isUnevenWrap, WrappingButton } from '@/components/WrappingButton';
import { act } from '@testing-library/react-native';
import { createElement } from 'react';
import { renderWithPreferences } from './helpers/render-preferences';

describe('a button label that wraps (#681)', () => {
  it('splits evenly: Chinese by its characters, other text at the space nearest the middle', () => {
    expect(balanceLabel('發送電子郵件')).toBe('發送電\n子郵件');
    expect(balanceLabel('发送电子邮件')).toBe('发送电\n子邮件');
    expect(balanceLabel('撥打電話')).toBe('撥打\n電話');
    expect(balanceLabel('Llamar por Teléfono')).toBe('Llamar por\nTeléfono');
    // Never a line that starts with punctuation.
    expect(balanceLabel('聯絡我們，謝謝')).toBe('聯絡我們，\n謝謝');
  });

  it('balances only a second line less than half the first', () => {
    expect(isUnevenWrap([{ text: '發送電子郵' }, { text: '件' }])).toBe(true);
    expect(isUnevenWrap([{ text: '發送電' }, { text: '子郵件' }])).toBe(false);
    expect(isUnevenWrap([{ text: 'Email Us' }])).toBe(false);
    expect(isUnevenWrap([{ text: 'a' }, { text: 'b' }, { text: 'c' }])).toBe(false);
  });

  it('shows 發送電子郵件 as three and three when it wraps five and one, as on a Pixel 9a', async () => {
    const screen = await renderWithPreferences(
      createElement(WrappingButton, { children: '發送電子郵件', mode: 'contained', onPress: jest.fn() }),
    );
    const label = screen.getByText('發送電子郵件');
    // The label ignores touches (pointerEvents none), so the test calls its
    // layout handler as the system would.
    await act(async () => {
      label.props.onTextLayout({ nativeEvent: { lines: [{ text: '發送電子郵' }, { text: '件' }] } });
    });
    expect(screen.getByText('發送電\n子郵件')).toBeTruthy();
    // Screen readers still hear it whole.
    expect(screen.getByRole('button', { name: '發送電子郵件' })).toBeTruthy();
  });
});
