import { withSdaBibleInterface } from '@/features/library/SdaBibleReader';

const mockOpenURL = jest.fn();
const mockOpenInItsApp = jest.fn();

const load = (os: 'ios' | 'android' | 'web') => {
  jest.resetModules();
  jest.doMock('react-native', () => ({ Platform: { OS: os } }));
  jest.doMock('@/constants/ExternalLinks', () => ({
    openURL: mockOpenURL,
    openInItsApp: mockOpenInItsApp,
  }));
  return require('@/features/library/SdaBibleReader') as typeof import('@/features/library/SdaBibleReader');
};

beforeEach(() => {
  mockOpenURL.mockReset();
  mockOpenInItsApp.mockReset();
});

describe("the Chinese Union Mission's SDA Bible reader (#554)", () => {
  it("opens reader links in the app's script and leaves other links alone", () => {
    const book = 'https://read.sdabible.org/library/work/m-162';
    expect(withSdaBibleInterface(book, 'zh')).toBe(`${book}?ui=tc`);
    expect(withSdaBibleInterface(book, 'zh-cn')).toBe(`${book}?ui=cn`);
    expect(withSdaBibleInterface(book, 'en')).toBe(`${book}?ui=en`);
    expect(withSdaBibleInterface(`${book}/c-1000001?v=tc_cuv`, 'zh-cn')).toBe(
      `${book}/c-1000001?v=tc_cuv&ui=cn`,
    );
    expect(withSdaBibleInterface('https://text.egwwritings.org/read/130.4', 'zh')).toBe(
      'https://text.egwwritings.org/read/130.4',
    );
    expect(withSdaBibleInterface('https://read.sdabible.org.example.com/x', 'zh')).toBe(
      'https://read.sdabible.org.example.com/x',
    );
  });

  it('sends an iPhone or iPad to the App Store', () => {
    load('ios').openSdaBible('zh');
    expect(mockOpenInItsApp).toHaveBeenCalledWith('https://apps.apple.com/us/app/sda-bible/id6823826805');
    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  it.each(['android', 'web'] as const)(
    "opens the online reader on %s, which has no store listing, in the app's script",
    (os) => {
      const { openSdaBible } = load(os);
      openSdaBible('zh');
      openSdaBible('zh-cn');
      expect(mockOpenURL.mock.calls.map(([url]) => url)).toEqual([
        'https://read.sdabible.org/?ui=tc',
        'https://read.sdabible.org/?ui=cn',
      ]);
      expect(mockOpenInItsApp).not.toHaveBeenCalled();
    },
  );
});
