import { act, fireEvent } from '@testing-library/react-native';
import { createElement, type ComponentType } from 'react';
import { LibraryFeaturedCarousel } from '@/components/LibraryFeaturedCarousel';
import { openURL, openYouTubeSearch } from '@/constants/ExternalLinks';
import type { SupportedLanguage } from '@/constants/LanguageContext';
import { customLightTheme } from '@/constants/Themes';
import type { HymnalBookId } from '@/features/hymnal/HymnalLabels';
import {
  getDisplayedHymns,
  getHymnalOrder,
  getHymnCrossReferences,
  HYMNALS,
} from '@/features/hymnal/Hymnals';
import { renderWithPreferences } from './helpers/render-preferences';

const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
let mockScreenOptions: Record<string, any> = {};
let mockRedirect: string | undefined;

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirect = href;
    return null;
  },
  router: { push: (...args: unknown[]) => mockPush(...args) },
  Stack: {
    Screen: ({ options }: { options: Record<string, any> }) => {
      mockScreenOptions = options;
      return null;
    },
  },
  useIsFocused: () => true,
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/constants/ExternalLinks', () => ({
  ...jest.requireActual('@/constants/ExternalLinks'),
  openURL: jest.fn(),
  openYouTubeSearch: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

// The hymn list renders more rows on a timer, which nothing here waits for.
jest.useFakeTimers();

const routes: [string, ComponentType, HymnalBookId][] = [
  ['english-hymnal', require('@/app/(tabs)/home/english-hymnal').default, 'sdah-1985-en'],
  ['chinese-505-hymnal', require('@/app/(tabs)/home/chinese-505-hymnal').default, 'chinese-hymnal-505'],
  ['chinese-506-hymnal', require('@/app/(tabs)/home/chinese-506-hymnal').default, 'chinese-hymnal-506'],
  ['chinese-707-standard-hymnal', require('@/app/(tabs)/home/chinese-707-standard-hymnal').default, 'chinese-hymnal-707-v3'],
  ['chinese-707-four-part-hymnal', require('@/app/(tabs)/home/chinese-707-four-part-hymnal').default, 'chinese-hymnal-707-v2'],
  ['chinese-707-new-simplified-hymnal', require('@/app/(tabs)/home/chinese-707-new-simplified-hymnal').default, 'chinese-hymnal-707-v1'],
];
const HymnalSelectionScreen: ComponentType =
  require('@/app/(tabs)/home/hymnal-selection').default;

const renderPage = (
  page: ComponentType,
  params: Record<string, string> = {},
  language: SupportedLanguage = 'en',
) => {
  mockParams = params;
  return renderWithPreferences(createElement(page), { language, theme: customLightTheme });
};

const hymnTitle = (hymnalId: HymnalBookId, number: number | string) => {
  const hymn = HYMNALS[hymnalId].getHymns().find((entry) => entry.number.toString() === `${number}`);
  return `${hymn!.number}. ${hymn!.title}`;
};

// The carousel's dots name each hymnal in order, and mark the one showing.
const dotLabels = (view: ReturnType<typeof renderPage>) =>
  view.getAllByLabelText(/(, hymnal \d+ of|，第 \d+\/\d+ 本)/).map((dot) => ({
    label: dot.props.accessibilityLabel as string,
    selected: Boolean(dot.props.accessibilityState?.selected),
  }));

describe('hymnal order', () => {
  it('puts English first for English and Spanish, and Chinese first for Chinese', () => {
    const chinese = [
      'chinese-hymnal-505',
      'chinese-hymnal-506',
      'chinese-hymnal-707-v3',
      'chinese-hymnal-707-v2',
      'chinese-hymnal-707-v1',
    ];
    expect(getHymnalOrder('en')).toEqual(['sdah-1985-en', ...chinese]);
    expect(getHymnalOrder('es')).toEqual(['sdah-1985-en', ...chinese]);
    expect(getHymnalOrder('zh')).toEqual([...chinese, 'sdah-1985-en']);
    expect(getHymnalOrder('zh-cn')).toEqual([...chinese, 'sdah-1985-en']);
  });

  it('shows the carousel in that order, picking the first hymnal', () => {
    const english = renderPage(HymnalSelectionScreen);
    expect(dotLabels(english).map(({ label }) => label)).toEqual([
      'SDA Hymnal — 1985 Edition, hymnal 1 of 6',
      'Chinese Hymnal — 505 Edition, hymnal 2 of 6',
      'Chinese Hymnal — 506 Edition, hymnal 3 of 6',
      'Hymns of Praise — 707 Standard Edition, hymnal 4 of 6',
      'Hymns of Praise — 707 Four-Part Harmony, hymnal 5 of 6',
      'Hymns of Praise — 707 New Simplified Notation, hymnal 6 of 6',
    ]);
    expect(dotLabels(english)[0].selected).toBe(true);
    expect(english.getByText(hymnTitle('sdah-1985-en', 1))).toBeTruthy();
    english.unmount();

    const chinese = renderPage(HymnalSelectionScreen, {}, 'zh');
    expect(dotLabels(chinese).map(({ label }) => label)).toEqual([
      '中文讚美詩 — 505 版，第 1/6 本',
      '中文讚美詩 — 506 版，第 2/6 本',
      '頌讚詩歌 — 707 標準版，第 3/6 本',
      '頌讚詩歌 — 707 簡譜四聲部版，第 4/6 本',
      '頌讚詩歌 — 707 新編簡譜版，第 5/6 本',
      '英文 SDA 詩歌本 — 1985 年版，第 6/6 本',
    ]);
    expect(chinese.getByText(hymnTitle('chinese-hymnal-505', 1))).toBeTruthy();
  });
});

describe('the hymnal page', () => {
  it('shows the hymns of the hymnal picked in the carousel', () => {
    const view = renderPage(HymnalSelectionScreen);
    fireEvent.press(view.getByLabelText('Chinese Hymnal — 506 Edition, hymnal 3 of 6'));

    expect(dotLabels(view)[2].selected).toBe(true);
    expect(view.getByText(hymnTitle('chinese-hymnal-506', 1))).toBeTruthy();
    expect(view.queryByText(hymnTitle('sdah-1985-en', 1))).toBeNull();
    expect(view.getByPlaceholderText('Search by number or title...')).toBeTruthy();
  });

  it("keeps each hymnal's own search when another hymnal is picked", () => {
    const view = renderPage(HymnalSelectionScreen);
    fireEvent.changeText(view.getByPlaceholderText('Search by number, title, or scripture...'), 'Joyful');
    expect(view.getByText(hymnTitle('sdah-1985-en', 12))).toBeTruthy();
    expect(view.queryByText(hymnTitle('sdah-1985-en', 1))).toBeNull();

    // The 505 hymnal has no search of its own yet, so it shows every hymn.
    fireEvent.press(view.getByLabelText('Chinese Hymnal — 505 Edition, hymnal 2 of 6'));
    expect(view.getByPlaceholderText('Search by number or title...').props.value).toBe('');
    expect(view.getByText(hymnTitle('chinese-hymnal-505', 1))).toBeTruthy();

    fireEvent.press(view.getByLabelText('SDA Hymnal — 1985 Edition, hymnal 1 of 6'));
    expect(view.getByPlaceholderText('Search by number, title, or scripture...').props.value).toBe('Joyful');
    expect(view.getByText(hymnTitle('sdah-1985-en', 12))).toBeTruthy();
  });

  it('sends the old hymn lookup to the hymnal page, on the hymn it had picked', () => {
    const HymnLookup: ComponentType = require('@/app/(tabs)/home/hymn-lookup').default;
    renderPage(HymnLookup, { sourceHymnalId: 'chinese-hymnal-505', sourceNumber: '23' });
    expect(mockRedirect).toBe('/home/hymnal-selection?hymnal=chinese-hymnal-505&hymnNum=23');
    renderPage(HymnLookup);
    expect(mockRedirect).toBe('/home/hymnal-selection');
    renderPage(HymnLookup, { sourceHymnalId: 'not-a-hymnal', sourceNumber: '23' });
    expect(mockRedirect).toBe('/home/hymnal-selection');

    // The page itself has no lookup button now; its search does that job.
    expect(renderPage(HymnalSelectionScreen).queryByText(/1985 ↔ 505/)).toBeNull();
  });

  it("shows the hymnal's name and a search button in the header once the carousel scrolls away", () => {
    const view = renderPage(HymnalSelectionScreen);
    expect(mockScreenOptions).toMatchObject({ title: 'Hymnals', showTitleChip: false, heroUnderStatusBar: true });
    expect(mockScreenOptions.headerSearchButton).toBeUndefined();

    // The carousel is 400 tall; the layout mock gives the safe area a 0 top.
    const list = view.UNSAFE_getByType(require('react-native').FlatList as ComponentType<any>);
    const carousel = view.UNSAFE_getByType(LibraryFeaturedCarousel).parent!;
    act(() => carousel.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 400 } } }));
    act(() => list.props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: 500 } } }));

    expect(mockScreenOptions).toMatchObject({
      title: 'SDA Hymnal — 1985 Edition',
      showTitleChip: true,
      heroUnderStatusBar: false,
    });
    expect(mockScreenOptions.headerSearchButton.label).toBe('Search this hymnal');
  });
});

describe("each hymnal's own route", () => {
  it.each(routes)('/home/%s opens the hymnal page with its hymnal and hymn', (_route, page, hymnalId) => {
    const hymnNumber = HYMNALS[hymnalId].getHymns()[9].number.toString();
    const view = renderPage(page, { hymnNum: hymnNumber, backTo: '/home/bulletin' });
    const order = getHymnalOrder('en');

    expect(dotLabels(view)[order.indexOf(hymnalId)].selected).toBe(true);
    // Just that hymn, marked as the one the link opened, and a way back to the rest.
    const title = view.getByText(hymnTitle(hymnalId, hymnNumber));
    expect(view.getAllByText(/^\d+B?\. /)).toHaveLength(1);
    let row = title.parent;
    while (row && !row.props.accessibilityState) row = row.parent;
    expect(row!.props.accessibilityState).toMatchObject({ selected: true });
    expect(view.getByText('Show all hymns')).toBeTruthy();
    expect(mockScreenOptions.backTo).toBe('/home/bulletin');

    fireEvent.press(view.getByText('Show all hymns'));
    expect(view.getByText(hymnTitle(hymnalId, HYMNALS[hymnalId].getHymns()[0].number))).toBeTruthy();
  });

  it('lets the hymnal param pick another hymnal and applies an old search', () => {
    const view = renderPage(routes[0][1], { hymnal: 'chinese-hymnal-505', highlight: '主' });
    expect(dotLabels(view)[1].selected).toBe(true);
    expect(view.getByPlaceholderText('Search by number or title...').props.value).toBe('主');
  });

  it("shows a 505 hymn its 1985 equivalent's verse, and opens it in the Chinese Bible", () => {
    // 505's 5 is SDAH 1, on Psalm 103:2-5.
    const view = renderPage(routes[1][1], { hymnNum: '5' }, 'zh');
    fireEvent.press(view.getByText('詩篇 103:2-5'));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/bible',
      params: expect.objectContaining({
        translationId: 'cmn_cuv',
        bookId: 'PSA',
        chapter: '103',
        backTo: '/home/chinese-505-hymnal?hymnNum=5',
      }),
    });
    view.unmount();

    // In Simplified Chinese, the Simplified Bible. The 506 has no verses yet.
    const simplified = renderPage(routes[1][1], { hymnNum: '5' }, 'zh-cn');
    fireEvent.press(simplified.getByText('诗篇 103:2-5'));
    expect(mockPush).toHaveBeenLastCalledWith(
      expect.objectContaining({ params: expect.objectContaining({ translationId: 'cmn_cu1' }) }),
    );
  });

  it('brings the Bible back to the same hymnal, hymn, and return route', () => {
    const view = renderPage(routes[0][1], { hymnNum: '1', backTo: '/home/bulletin' });
    fireEvent.press(view.getByText('Psalm 103:2-5'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/bible',
      params: expect.objectContaining({
        bookId: 'PSA',
        chapter: '103',
        backTo: '/home/english-hymnal?backTo=%2Fhome%2Fbulletin&hymnNum=1',
      }),
    });
  });
});

describe('recordings and piano accompaniments', () => {
  beforeEach(() => jest.clearAllMocks());

  it('offers an English hymn with singing or piano only, and its verse as a chip', () => {
    const view = renderPage(routes[0][1], { hymnNum: '1' });
    expect(view.queryByText('YouTube')).toBeNull();
    expect(view.getByText('Psalm 103:2-5')).toBeTruthy();

    fireEvent.press(view.getByText('With singing'));
    expect(openYouTubeSearch).toHaveBeenCalledWith('SDA Hymnal 1985 Praise to the Lord');

    fireEvent.press(view.getByText('Piano only'));
    expect(openURL).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=Uoi3zhcXZrM',
      'Error',
      'Could not open the YouTube video.',
    );
  });

  it('leaves out the piano button when a hymn has no accompaniment', () => {
    // Not in the playlist; see scripts/map-english-hymnal-piano-youtube.mjs.
    const view = renderPage(routes[0][1], { hymnNum: '30' });
    expect(view.getByText('With singing')).toBeTruthy();
    expect(view.queryByText('Piano only')).toBeNull();
  });

  it('offers a 505 hymn with singing or piano only too', () => {
    const view = renderPage(routes[1][1], { hymnNum: '1' }, 'zh');
    fireEvent.press(view.getByText('演唱'));
    expect(openYouTubeSearch).toHaveBeenCalledWith('505版赞美诗 1 在主宝座前');

    fireEvent.press(view.getByText('鋼琴伴奏'));
    expect(openURL).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=JxR9rqNut-s',
      'Error',
      'Could not open the YouTube video.',
    );
  });

  it.each(routes.slice(2))('offers only With singing on /home/%s, which has no accompaniments yet', (_route, page, hymnalId) => {
    const view = renderPage(page, { hymnNum: HYMNALS[hymnalId].getHymns()[0].number.toString() });
    expect(view.getByText('With singing')).toBeTruthy();
    expect(view.getByA11yHint('Opens the video on YouTube')).toBeTruthy();
    expect(view.queryByText('YouTube')).toBeNull();
    expect(view.queryByText('Piano only')).toBeNull();
  });

  it('labels the buttons in the app language', () => {
    const view = renderPage(routes[0][1], { hymnNum: '1' }, 'zh');
    expect(view.getByText('演唱')).toBeTruthy();
    expect(view.getByText('鋼琴伴奏')).toBeTruthy();
    expect(view.getAllByA11yHint('在 YouTube 開啟影片')).toHaveLength(2);
    expect(view.getByA11yHint('在聖經中開啟這段經文')).toBeTruthy();
  });
});

describe('1985 ↔ 505 cross-references', () => {
  it('pairs hymns both ways from the cross-reference table', () => {
    expect(getHymnCrossReferences('sdah-1985-en', 694)).toEqual([
      { hymnalId: 'chinese-hymnal-505', number: 497, available: true },
    ]);
    expect(getHymnCrossReferences('chinese-hymnal-505', 497)).toEqual([
      { hymnalId: 'sdah-1985-en', number: 694, available: true },
    ]);
    // Asterisked in the table, missing from the online 505 catalog, or another hymnal.
    expect(getHymnCrossReferences('sdah-1985-en', 2)).toEqual([]);
    expect(getHymnCrossReferences('sdah-1985-en', 254)).toEqual([
      { hymnalId: 'chinese-hymnal-505', number: 90, available: false },
    ]);
    expect(getHymnCrossReferences('chinese-hymnal-506', 1)).toEqual([]);
  });

  it('shows the 505 hymn from its chip on a 1985 hymn, and back', () => {
    const view = renderPage(HymnalSelectionScreen);
    // SDAH 1 is 505's hymn 5.
    fireEvent.press(view.getByLabelText('Chinese Hymnal — 505 Edition, hymn 5'));

    expect(dotLabels(view)[1].selected).toBe(true);
    expect(view.getAllByText(/^\d+\. /).map((text) => text.props.children.join(''))).toEqual([
      hymnTitle('chinese-hymnal-505', 5),
    ]);
    expect(view.getByText('English · 1')).toBeTruthy();

    fireEvent.press(view.getByLabelText('SDA Hymnal — 1985 Edition, hymn 1'));
    expect(dotLabels(view)[0].selected).toBe(true);
    expect(view.getByText(hymnTitle('sdah-1985-en', 1))).toBeTruthy();
    expect(view.getByText('Show all hymns')).toBeTruthy();
  });

  it('labels the chip in the app language', () => {
    const view = renderPage(routes[0][1], { hymnNum: '1' }, 'zh');
    expect(view.getByText('中文 505 · 5')).toBeTruthy();
    expect(view.getByLabelText('中文讚美詩 — 505 版第 5 首')).toBeTruthy();
    view.unmount();

    const english = renderPage(routes[1][1], { hymnNum: '5' });
    expect(english.getByText('English · 1')).toBeTruthy();
  });
});

describe('searching every hymnal from the page', () => {
  // What the one list holds: the picked hymnal's hymns, then the heading and
  // the other hymnals' matches, as "hymnal:number" under each "hymnal" name,
  // with "more hymnal" for a Show all button.
  const listedHymns = (view: ReturnType<typeof renderPage>) =>
    (view.UNSAFE_getByType(require('react-native').FlatList as ComponentType<any>).props.data as any[]).map(
      (item) =>
        item.kind === 'heading'
          ? 'heading'
          : item.kind === 'group'
            ? item.hymnalId
            : item.kind === 'more'
              ? `more ${item.hymnalId}`
              : item.kind === 'other'
                ? `${item.item.hymnalId}:${item.item.hymnNumber}`
                : `${item.number}`,
    );

  it('lists matches in the other Chinese hymnals under their own heading', () => {
    const view = renderPage(HymnalSelectionScreen, {}, 'zh');
    fireEvent.changeText(view.getByPlaceholderText('按編號或標題搜尋...'), '平安夜');

    expect(listedHymns(view)).toEqual([
      '66',
      'heading',
      // The 1985, which the cross-reference table pairs with the 505, comes
      // first with its equivalent of the 505's own match, then the app's order.
      'sdah-1985-en',
      'sdah-1985-en:143',
      'chinese-hymnal-506',
      'chinese-hymnal-506:82',
      'chinese-hymnal-707-v3',
      'chinese-hymnal-707-v3:82',
      'chinese-hymnal-707-v2',
      'chinese-hymnal-707-v2:82',
      'chinese-hymnal-707-v1',
      'chinese-hymnal-707-v1:82',
    ]);
    expect(view.getByText('其他詩歌本').props.accessibilityRole).toBe('header');
    expect(view.getByText('中文讚美詩 — 506 版').props.accessibilityRole).toBe('header');
    const result = view.getByLabelText('中文讚美詩 — 506 版第 82 首，平安夜');
    expect(result.props.accessibilityRole).toBe('button');
  });

  it("shows the other hymnals' hymns with the same number", () => {
    const view = renderPage(HymnalSelectionScreen);
    fireEvent.changeText(view.getByPlaceholderText('Search by number, title, or scripture...'), '100');

    const listed = listedHymns(view);
    expect(listed[0]).toBe('100');
    expect(listed).toEqual(
      expect.arrayContaining([
        'chinese-hymnal-505:100',
        'chinese-hymnal-506:100',
        'chinese-hymnal-707-v1:100',
        'chinese-hymnal-707-v2:100',
        'chinese-hymnal-707-v3:100',
      ]),
    );
    expect(listed.filter((key) => key.startsWith('sdah-1985-en:'))).toEqual([]);
    // Each other hymnal leads with its 100, the 505 first.
    expect(listed.slice(listed.indexOf('heading') + 1, listed.indexOf('heading') + 3)).toEqual([
      'chinese-hymnal-505',
      'chinese-hymnal-505:100',
    ]);
    expect(view.getByLabelText(`Chinese Hymnal — 505 Edition, hymn 100, ${hymnTitle('chinese-hymnal-505', 100).replace('100. ', '')}`)).toBeTruthy();
  });

  it('leads with the 505 equivalent of a 1985 match, and shows it when tapped', () => {
    const view = renderPage(HymnalSelectionScreen);
    fireEvent.changeText(view.getByPlaceholderText('Search by number, title, or scripture...'), 'Praise God, From Whom');
    // The doxology in two settings; the cross-reference table pairs only 694 with 505.
    expect(listedHymns(view)).toEqual(['694', '695', 'heading', 'chinese-hymnal-505', 'chinese-hymnal-505:497']);

    fireEvent.press(view.getByLabelText('Chinese Hymnal — 505 Edition, hymn 497, 赞美上帝'));
    expect(dotLabels(view)[1].selected).toBe(true);
    expect(listedHymns(view)).toEqual(['497']);
    expect(view.getByText('Show all hymns')).toBeTruthy();
    expect(view.queryByText('In other hymnals')).toBeNull();

    // The 1985 hymnal still has its search.
    fireEvent.press(view.getByLabelText('SDA Hymnal — 1985 Edition, hymnal 1 of 6'));
    expect(listedHymns(view)).toEqual(['694', '695', 'heading', 'chinese-hymnal-505', 'chinese-hymnal-505:497']);
  });

  it("shows another hymnal's first 10 matches, and the rest with Show all", () => {
    const view = renderPage(HymnalSelectionScreen);
    const searchbar = view.getByPlaceholderText('Search by number, title, or scripture...');
    fireEvent.changeText(searchbar, '耶穌');
    const more = () =>
      (view.UNSAFE_getByType(require('react-native').FlatList as ComponentType<any>).props.data as any[]).find(
        (item) => item.kind === 'more' && item.hymnalId === 'chinese-hymnal-505',
      );
    const count = more().count;
    expect(count).toBeGreaterThan(10);

    // No 1985 title has 耶穌, so the 505 leads the list.
    const listed = listedHymns(view);
    expect(listed.slice(0, 2)).toEqual(['heading', 'chinese-hymnal-505']);
    expect(listed.slice(2, 12).every((key) => key.startsWith('chinese-hymnal-505:'))).toBe(true);
    expect(listed[12]).toBe('more chinese-hymnal-505');

    // The list renders rows this far down only once it's laid out, so render
    // the button from the list's own renderItem and press it.
    const list = view.UNSAFE_getByType(require('react-native').FlatList as ComponentType<any>);
    const button = list.props.renderItem({ item: more() });
    expect(button.props.accessibilityLabel).toBe(`Show all ${count}, Chinese Hymnal — 505 Edition`);
    act(() => button.props.onPress());
    const expanded = listedHymns(view);
    expect(expanded.filter((key) => key.startsWith('chinese-hymnal-505:'))).toHaveLength(count);
    expect(expanded).not.toContain('more chinese-hymnal-505');
    expect(expanded).toContain('more chinese-hymnal-506');

    // Another search shows 10 again.
    fireEvent.changeText(searchbar, '主');
    expect(more()).toBeTruthy();
  });

  it('answers "hymn 100, English or Chinese?" from any hymnal', () => {
    // Each hymn listed, wherever it is: the picked hymnal's own rows, or the
    // other hymnals' results, as "hymnal:number title".
    const listedTitles = (view: ReturnType<typeof renderPage>, hymnalId: HymnalBookId) =>
      (view.UNSAFE_getByType(require('react-native').FlatList as ComponentType<any>).props.data as any[])
        .filter((item) => item.kind !== 'heading')
        .map((item) =>
          item.kind === 'other'
            ? `${item.item.hymnalId}:${item.item.title}`
            : `${hymnalId}:${item.number}. ${item.title}`,
        );
    const english100 = `sdah-1985-en:${hymnTitle('sdah-1985-en', 100)}`;
    const chinese100 = `chinese-hymnal-505:${hymnTitle('chinese-hymnal-505', 100)}`;

    getHymnalOrder('en').forEach((hymnalId, index) => {
      const view = renderPage(HymnalSelectionScreen);
      fireEvent.press(view.getByLabelText(new RegExp(`, hymnal ${index + 1} of 6$`)));
      fireEvent.changeText(view.getByPlaceholderText(/^Search by number/), '100');

      const listed = listedTitles(view, hymnalId);
      expect(listed[0]).toBe(`${hymnalId}:${hymnTitle(hymnalId, 100)}`);
      expect(listed).toEqual(expect.arrayContaining([english100, chinese100]));
      view.unmount();
    });
  });

  it('says nothing matches only when no hymnal has a match', () => {
    const view = renderPage(HymnalSelectionScreen);
    fireEvent.changeText(view.getByPlaceholderText('Search by number, title, or scripture...'), 'zzqqx');
    expect(view.getByText('No hymns match your search.')).toBeTruthy();
    expect(view.queryByText('In other hymnals')).toBeNull();

    fireEvent.press(view.getByLabelText('Chinese Hymnal — 505 Edition, hymnal 2 of 6'));
    fireEvent.changeText(view.getByPlaceholderText('Search by number or title...'), 'Praise God');
    expect(view.queryByText('No hymns match your search.')).toBeNull();
    expect(view.getByText('In other hymnals')).toBeTruthy();
    expect(view.getByLabelText('SDA Hymnal — 1985 Edition, hymn 694, Praise God, From Whom All Blessings')).toBeTruthy();
  });
});

describe('hymnal search', () => {
  const english = HYMNALS['sdah-1985-en'].getHymns();
  const chinese505 = HYMNALS['chinese-hymnal-505'].getHymns();

  it('matches English numbers, titles, and scripture, with an exact number first', () => {
    const numbers = (query: string) =>
      getDisplayedHymns(english, undefined, query).map((hymn) => hymn.number);
    expect(numbers('23')[0]).toBe(23);
    expect(numbers('23')).toEqual(expect.arrayContaining([123, 230]));
    expect(numbers('joyful, joyful')).toEqual([12]);
    expect(numbers('Psalm 148:1-2')).toContain(694);
  });

  it('matches Chinese titles in Traditional or Simplified characters', () => {
    const traditional = getDisplayedHymns(chinese505, undefined, '寶座');
    expect(traditional.map((hymn) => hymn.number)).toContain(1);
    expect(getDisplayedHymns(chinese505, undefined, '宝座')).toEqual(traditional);
  });

  it('shows just the routed hymn, or searches when the hymnal lacks it', () => {
    expect(getDisplayedHymns(english, '1', '')).toEqual([english[0]]);
    expect(getDisplayedHymns(english, '999', 'joyful, joyful').map((hymn) => hymn.number)).toEqual([12]);
  });
});

describe('Library featured carousel', () => {
  it('still shows each book as a button with the featured label and its pill', () => {
    const onPress = jest.fn();
    const view = renderWithPreferences(
      createElement(LibraryFeaturedCarousel, {
        books: [
          { key: 'a', title: 'Example Book', author: 'A. Writer', accessibilityHint: 'Opens the book', onPress },
          { key: 'b', title: 'Second Book', author: 'B. Writer', accessibilityHint: 'Opens the book', onPress },
        ],
        featuredLabel: 'Featured',
        pageLabel: (page: number, count: number) => `Featured book ${page} of ${count}`,
        readLabel: 'Read',
      }),
      { theme: customLightTheme },
    );
    expect(view.getByLabelText('Featured book 1 of 2').props.accessibilityState).toEqual({ selected: true });

    // Pages draw once the carousel knows its width.
    const root = view.UNSAFE_getByType(LibraryFeaturedCarousel).children[0] as any;
    act(() => root.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 500 } } }));
    const page = view.getByLabelText('Featured: Example Book. A. Writer');
    expect(page.props.accessibilityRole).toBe('button');
    expect(view.getAllByText('Featured').length).toBeGreaterThan(0);
    expect(view.getAllByText('Read').length).toBeGreaterThan(0);
    fireEvent.press(page);
    expect(onPress).toHaveBeenCalledTimes(1);

    fireEvent.press(view.getByLabelText('Featured book 2 of 2'));
    expect(view.getByLabelText('Featured book 2 of 2').props.accessibilityState).toEqual({ selected: true });
  });

  it('shows a hymnal page with its own label and no pill or button', () => {
    const view = renderWithPreferences(
      createElement(LibraryFeaturedCarousel, {
        books: [{ key: 'h', title: 'SDA Hymnal', author: '1985 Edition', eyebrow: 'English' }],
        pageLabel: () => '',
      }),
      { theme: customLightTheme },
    );
    const root = view.UNSAFE_getByType(LibraryFeaturedCarousel).children[0] as any;
    act(() => root.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 500 } } }));
    const page = view.getByLabelText('English: SDA Hymnal. 1985 Edition');
    expect(page.props.accessibilityRole).toBeUndefined();
    expect(view.queryByText('Read')).toBeNull();
  });
});
