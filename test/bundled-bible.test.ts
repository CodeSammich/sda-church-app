import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// test/setup.ts replaces this module for every other test; this one tests it.
jest.unmock('@/services/BundledBible');

const mockAsset = { uri: '', localUri: null as string | null, downloadAsync: jest.fn() };
jest.mock('expo-asset', () => ({ Asset: { fromModule: () => mockAsset } }));
const mockText = jest.fn();
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({ text: () => mockText(uri) })),
}));

const load = (os: 'ios' | 'web') => {
  jest.resetModules();
  jest.doMock('react-native', () => ({ Platform: { OS: os } }));
  return require('@/services/BundledBible') as typeof import('@/services/BundledBible');
};

beforeEach(() => {
  mockAsset.uri = 'https://app.nyccsda.org/assets/gen.biblejson';
  mockAsset.localUri = null;
  mockAsset.downloadAsync.mockReset().mockImplementation(async () => {
    mockAsset.localUri = 'file:///bundle/gen.biblejson';
  });
  mockText.mockReset().mockResolvedValue('{"book":"gen","contents":[]}');
});

describe('bundled Bible files', () => {
  it('reads a local file on a phone, once', async () => {
    const { readBundledBibleFile } = load('ios');

    await expect(readBundledBibleFile('cuv1919/hant', 'gen')).resolves.toEqual({ book: 'gen', contents: [] });
    await readBundledBibleFile('cuv1919/hant', 'gen');

    expect(mockText).toHaveBeenCalledTimes(1);
    expect(mockText).toHaveBeenCalledWith('file:///bundle/gen.biblejson');
  });

  it('fetches the file from the website on the web', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ book: 'gen', contents: [] }),
    } as Response);
    const { readBundledBibleFile } = load('web');

    await readBundledBibleFile('cuv1919/hans', 'gen');

    expect(fetchSpy).toHaveBeenCalledWith('https://app.nyccsda.org/assets/gen.biblejson');
    expect(mockAsset.downloadAsync).not.toHaveBeenCalled();
  });

  it('tries again after a failed read, and rejects a file that isn’t bundled', async () => {
    const { readBundledBibleFile, hasBundledBibleFile } = load('ios');
    mockText.mockRejectedValueOnce(new Error('disk'));

    await expect(readBundledBibleFile('cuv1919/hant', 'exo')).rejects.toThrow('disk');
    await expect(readBundledBibleFile('cuv1919/hant', 'exo')).resolves.toEqual({ book: 'gen', contents: [] });
    await expect(readBundledBibleFile('cuv1919/hant', 'xyz')).rejects.toThrow('No bundled Bible file cuv1919/hant/xyz');
    expect(hasBundledBibleFile('cuv1919/hant', 'books')).toBe(true);
    expect(hasBundledBibleFile('cuv1919/hant', 'xyz')).toBe(false);
  });

  it('indexes exactly the files in assets/bible', () => {
    const root = join(process.cwd(), 'assets/bible');
    const onDisk: string[] = [];
    const walk = (folder: string) => {
      for (const name of readdirSync(folder)) {
        const path = join(folder, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (name.endsWith('.biblejson')) onDisk.push(relative(root, path));
      }
    };
    walk(root);
    const index = readFileSync(join(root, 'index.ts'), 'utf8');
    const indexed = [...index.matchAll(/require\('\.\/([^']+)'\)/g)].map((match) => match[1]);

    expect(indexed.sort()).toEqual(onDisk.sort());
  });
});
