import { LanguageDialog } from '@/components/LanguageDialog';
import { fireEvent } from '@testing-library/react-native';
import { createElement } from 'react';
import { renderWithPreferences } from './helpers/render-preferences';

describe('LanguageDialog', () => {
  it('changes the app language in place and dismisses', () => {
    const setLanguage = jest.fn();
    const onDismiss = jest.fn();
    const screen = renderWithPreferences(
      createElement(LanguageDialog, { onDismiss, visible: true }),
      { setLanguage },
    );

    expect(screen.getAllByRole('radio')).toHaveLength(4);
    fireEvent.press(screen.getByRole('radio', { name: /Simplified Chinese/ }));

    expect(setLanguage).toHaveBeenCalledWith('zh-cn');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
