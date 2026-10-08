import { fireEvent } from '@testing-library/react-native';
import { createElement, type ComponentType } from 'react';
import { customLightTheme } from '@/constants/Themes';
import { getHymnalOrder, getHymnCrossReferences } from '@/features/hymnal/Hymnals';
import {
  HYMNAL_CROSS_REFERENCE_TABLES,
  type HymnalCrossReferenceTable,
  invertNumberMap,
} from '@/features/hymnal/HymnalNumberMappings';
import {
  getHymnalSearchItems,
  getOtherHymnalSearchGroups,
} from '@/features/hymnal/HymnalSearch';
import { renderWithPreferences } from './helpers/render-preferences';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
  useIsFocused: () => true,
  useLocalSearchParams: () => ({}),
}));

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

jest.useFakeTimers();

// A made-up second table, 506 ↔ 1985, registered the way the JSON's tables
// are: two hymnals and each one's numbers in the other. Nothing else changes.
const fakeNumberMap = { '1': [73], '2': [4, 5] };
const fakeTable: HymnalCrossReferenceTable = {
  hymnalIds: ['chinese-hymnal-506', 'sdah-1985-en'],
  numberMaps: [fakeNumberMap, invertNumberMap(fakeNumberMap)],
};

beforeAll(() => HYMNAL_CROSS_REFERENCE_TABLES.push(fakeTable));
afterAll(() => {
  HYMNAL_CROSS_REFERENCE_TABLES.splice(HYMNAL_CROSS_REFERENCE_TABLES.indexOf(fakeTable), 1);
});

const HymnalSelectionScreen: ComponentType =
  require('@/app/(tabs)/home/hymnal-selection').default;

describe('a new cross-reference table', () => {
  it('pairs the hymns both ways, with every table and every number', () => {
    expect(getHymnCrossReferences('chinese-hymnal-506', 1)).toEqual([
      { hymnalId: 'sdah-1985-en', number: 73, available: true },
    ]);
    expect(getHymnCrossReferences('chinese-hymnal-506', 2).map(({ number }) => number)).toEqual([4, 5]);
    // SDAH 73 is in both tables: 505's 2 from the printed table, and 506's 1.
    expect(getHymnCrossReferences('sdah-1985-en', 73)).toEqual([
      { hymnalId: 'chinese-hymnal-505', number: 2, available: true },
      { hymnalId: 'chinese-hymnal-506', number: 1, available: true },
    ]);
  });

  it("adds the new equivalent to its hymnal's search results, which come first", () => {
    const groups = getOtherHymnalSearchGroups(getHymnalSearchItems('en'), 'Holy, Holy, Holy', {
      activeHymnalId: 'sdah-1985-en',
      hymnalOrder: getHymnalOrder('en'),
    });
    // Both tables pair a hymnal with the 1985, so both lead, in the app's order.
    expect(groups.slice(0, 2).map(({ hymnalId, hymns }) => [hymnalId, hymns[0].hymnNumber])).toEqual([
      ['chinese-hymnal-505', 2],
      ['chinese-hymnal-506', 1],
    ]);
  });

  it('shows chips on both hymnals’ rows with no change to the page', () => {
    const view = renderWithPreferences(createElement(HymnalSelectionScreen), {
      theme: customLightTheme,
    });
    fireEvent.press(view.getByLabelText('Chinese Hymnal — 506 Edition, hymnal 3 of 6'));
    expect(view.getByText('1985 · 73')).toBeTruthy();
    // A hymn that maps to two numbers gets a chip for each.
    expect(view.getByText('1985 · 4')).toBeTruthy();
    expect(view.getByText('1985 · 5')).toBeTruthy();

    fireEvent.press(view.getByLabelText('SDA Hymnal — 1985 Edition, hymn 73'));
    expect(view.getByText('505 · 2')).toBeTruthy();
    expect(view.getByLabelText('Chinese Hymnal — 506 Edition, hymn 1')).toBeTruthy();
    expect(view.getByText('Show all hymns')).toBeTruthy();
  });
});
