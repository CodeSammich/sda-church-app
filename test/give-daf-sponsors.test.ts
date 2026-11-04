import { readFileSync } from 'node:fs';

import { fireEvent } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { createElement } from 'react';

import GiveScreen from '@/app/(tabs)/home/give';
import {
  DAF_SPONSORS_COPY,
  DafSponsorsDialog,
  getDafSponsorDetails,
} from '@/components/DafSponsorsDialog';
import {
  CHURCH_EIN,
  CHURCH_LEGAL_NAME,
  DAF_SPONSORS,
  OTHER_DAF_SPONSORS,
  PREFERRED_DAF_SPONSOR,
} from '@/constants/ExternalLinks';
import type { SupportedLanguage } from '@/constants/LanguageContext';
import { renderWithPreferences } from './helpers/render-preferences';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/components/VerseHero', () => ({ VerseHero: () => null }));
jest.mock('@/hooks/useHeroHeaderTitle', () => ({
  useHeroHeaderTitle: () => ({ showHeaderTitle: false, handleHeroScroll: jest.fn() }),
}));

const LANGUAGES: SupportedLanguage[] = ['en', 'zh', 'zh-cn', 'es'];

const OTHER_SPONSORS_LABEL: Record<SupportedLanguage, string> = {
  en: 'Other Sponsors',
  zh: '其他贊助機構',
  'zh-cn': '其他赞助机构',
  es: 'Otros patrocinadores',
};

describe('donor-advised fund sponsors (#646)', () => {
  it('lists each sponsor once, with an https address', () => {
    expect(new Set(DAF_SPONSORS.map(({ id }) => id)).size).toBe(DAF_SPONSORS.length);
    for (const sponsor of DAF_SPONSORS) {
      expect(sponsor.name.trim()).not.toBe('');
      expect(new URL(sponsor.url).protocol).toBe('https:');
    }
    // Those without a link to a grant open their home pages.
    for (const sponsor of OTHER_DAF_SPONSORS) {
      expect(sponsor.url).toMatch(/^https:\/\/www\.[a-z0-9-]+\.org\/$/);
    }
  });

  it('opens a Fidelity Charitable grant with the church already chosen, by its EIN', () => {
    const url = new URL(PREFERRED_DAF_SPONSOR.url);
    expect(url.origin + url.pathname).toBe('https://charitablegift.fidelity.com/cgfweb/CGFLogon.cgfdo');
    expect(url.searchParams.get('Npo_Id')).toBe('113004814');
    expect(CHURCH_EIN.replace('-', '')).toBe('113004814');
  });

  it('has the daily dependency monitor check each sponsor’s link', () => {
    const monitor = readFileSync('test/integration/external-dependencies.mjs', 'utf8');
    for (const sponsor of DAF_SPONSORS) {
      expect(monitor).toContain(`'${sponsor.url}'`);
    }
  });

  it('puts Fidelity Charitable, which the church prefers, first', () => {
    expect(PREFERRED_DAF_SPONSOR).toBe(DAF_SPONSORS[0]);
    expect(PREFERRED_DAF_SPONSOR.name).toBe('Fidelity Charitable');
    expect(OTHER_DAF_SPONSORS).toEqual(DAF_SPONSORS.slice(1));
    // The sponsors the page's text names.
    expect(OTHER_DAF_SPONSORS.map(({ name }) => name)).toEqual(['DAFgiving360', 'Vanguard Charitable']);
  });

  it('has the popup’s words in every language', () => {
    expect(Object.keys(DAF_SPONSORS_COPY).sort()).toEqual([...LANGUAGES].sort());
    for (const language of LANGUAGES) {
      for (const text of Object.values(DAF_SPONSORS_COPY[language])) {
        expect(text.trim()).not.toBe('');
      }
    }
  });

  it('names a sponsor’s old name and its website under it', () => {
    const [schwab, vanguard] = OTHER_DAF_SPONSORS;
    expect(getDafSponsorDetails(schwab, 'en')).toEqual(['Formerly Schwab Charitable', 'dafgiving360.org']);
    expect(getDafSponsorDetails(schwab, 'zh')).toEqual(['原名 Schwab Charitable', 'dafgiving360.org']);
    expect(getDafSponsorDetails(vanguard, 'es')).toEqual(['vanguardcharitable.org']);
  });
});

describe('the Tithe & Offering page’s donor-advised fund card (#646)', () => {
  beforeEach(() => {
    (WebBrowser.openBrowserAsync as jest.Mock).mockResolvedValue(undefined);
  });

  it.each(LANGUAGES)('gives the church’s EIN and both buttons in %s', async (language) => {
    const view = await renderWithPreferences(createElement(GiveScreen), { language });
    expect(view.getAllByText(new RegExp(CHURCH_EIN)).length).toBeGreaterThan(0);
    expect(view.getByRole('button', { name: PREFERRED_DAF_SPONSOR.name })).toBeTruthy();
    expect(view.getByRole('button', { name: OTHER_SPONSORS_LABEL[language] })).toBeTruthy();
    // The popup stays closed until asked for.
    expect(view.queryByTestId('daf-sponsors-dialog')).toBeNull();
  });

  it.each(LANGUAGES)('names Schwab’s sponsor by its new name, with its old one as the popup does, in %s', async (language) => {
    const view = await renderWithPreferences(createElement(GiveScreen), { language });
    const [schwab] = OTHER_DAF_SPONSORS;
    const formerly = `${DAF_SPONSORS_COPY[language].formerly} ${schwab.formerName}`;
    const card = view.getByText(new RegExp(CHURCH_EIN));
    expect(card).toHaveTextContent(new RegExp(`${schwab.name}\\W+${formerly}\\W`, 'i'));
    expect(view.queryByText(/Charles Schwab/)).toBeNull();
  });

  it('opens a Fidelity Charitable grant to the church in the in-app browser', async () => {
    const view = await renderWithPreferences(createElement(GiveScreen));
    await fireEvent.press(view.getByRole('button', { name: 'Fidelity Charitable' }));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/charitablegift\.fidelity\.com\/.*[?&]Npo_Id=113004814\b/),
    );
  });

  it('opens the other sponsors in a popup, titled as its button', async () => {
    const view = await renderWithPreferences(createElement(GiveScreen), { language: 'zh' });
    await fireEvent.press(view.getByRole('button', { name: '其他贊助機構' }));
    expect(view.getByTestId('daf-sponsors-dialog')).toBeTruthy();
    expect(view.getAllByText('其他贊助機構')).toHaveLength(2);
    expect(view.getByText('撥款對象')).toBeTruthy();
  });
});

describe('the Other Sponsors popup (#646)', () => {
  beforeEach(() => {
    (WebBrowser.openBrowserAsync as jest.Mock).mockResolvedValue(undefined);
  });

  const renderPopup = (language: SupportedLanguage = 'en', onDismiss = jest.fn()) =>
    renderWithPreferences(
      createElement(DafSponsorsDialog, { onDismiss, title: OTHER_SPONSORS_LABEL[language], visible: true }),
      { language },
    );

  it('lists every sponsor but Fidelity Charitable, each opening its home page', async () => {
    const view = await renderPopup();
    expect(view.queryByTestId(`daf-sponsor-${PREFERRED_DAF_SPONSOR.id}`)).toBeNull();
    for (const sponsor of OTHER_DAF_SPONSORS) {
      const row = view.getByTestId(`daf-sponsor-${sponsor.id}`);
      expect(row.props.accessibilityRole).toBe('link');
      expect(view.getByText(sponsor.name)).toBeTruthy();
      await fireEvent.press(row);
      expect(WebBrowser.openBrowserAsync).toHaveBeenLastCalledWith(sponsor.url);
    }
    expect(view.getByText('Formerly Schwab Charitable')).toBeTruthy();
    expect(view.getByText('dafgiving360.org')).toBeTruthy();
    expect(view.getByTestId('daf-sponsor-dafgiving360').props.accessibilityLabel).toBe(
      'DAFgiving360, Formerly Schwab Charitable, dafgiving360.org',
    );
  });

  it.each(LANGUAGES)('asks donors to contact church staff first, and gives the grant’s recipient, in %s', async (language) => {
    const view = await renderPopup(language);
    const labels = DAF_SPONSORS_COPY[language];
    expect(view.getByText(labels.intro)).toBeTruthy();
    expect(view.getByText(labels.recipient)).toBeTruthy();
    expect(view.getByText(CHURCH_LEGAL_NAME)).toBeTruthy();
    expect(view.getByText(`EIN ${CHURCH_EIN}`)).toBeTruthy();
  });

  it('closes with the X in its title row, with no Close button', async () => {
    const onDismiss = jest.fn();
    const view = await renderPopup('en', onDismiss);
    expect(view.queryByText('Close')).toBeNull();
    await fireEvent.press(view.getByLabelText('Close'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
