import React from 'react';
import { render } from '@testing-library/react-native';

import GiveScreen from '@/app/(tabs)/home/give';
import { SHOW_ZELLE_GIVING } from '@/constants/ExternalLinks';
import { LanguageContext, type SupportedLanguage } from '@/constants/LanguageContext';

jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));
jest.mock('@/components/VerseHero', () => ({ VerseHero: () => null }));
jest.mock('@/hooks/useHeroHeaderTitle', () => ({
  useHeroHeaderTitle: () => ({ showHeaderTitle: false, handleHeroScroll: jest.fn() }),
}));
jest.mock('@/constants/Themes', () => ({
  useAppTheme: () => ({ colors: new Proxy({}, { get: () => '#000000' }) }),
}));
jest.mock('@/styles/DocumentStyles', () => ({
  useDocumentStyles: () => new Proxy({}, { get: () => ({}) }),
}));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => {
  const MockIcon = () => null;
  MockIcon.glyphMap = {};
  return MockIcon;
});

const renderGive = (language: SupportedLanguage) =>
  render(
    React.createElement(
      LanguageContext.Provider,
      { value: { language, languageSelectionRevision: 0, setLanguage: () => {} } },
      React.createElement(GiveScreen),
    ),
  );

describe('Zelle on the Tithe & Offering page (#392)', () => {
  it('stays off until the address can receive gifts (#384)', () => {
    expect(SHOW_ZELLE_GIVING).toBe(false);
  });

  it.each<[SupportedLanguage, string]>([
    ['en', 'Online Portal'],
    ['zh', '網上平台'],
    ['zh-cn', '网上平台'],
    ['es', 'Portal en Línea'],
  ])('shows no Zelle section in %s', (language, onlineSection) => {
    const view = renderGive(language);
    expect(view.getByText(onlineSection)).toBeTruthy();
    expect(view.queryByText(/Zelle|@nyccsda\.org/)).toBeNull();
  });
});
