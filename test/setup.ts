import { createElement } from 'react';

// React Native 0.83.6's published Jest Text mock assumes the production
// component has a prototype. It is a prototype-less function in this release,
// so use the same host name that the mock would ultimately render.
jest.mock('react-native/Libraries/Text/Text', () => ({
  __esModule: true,
  default: 'Text',
}));

const mockCreateIcon = () => {
  const React = require('react');
  const MockIcon = (props: Record<string, unknown>) =>
    React.createElement('MockIcon', props);
  MockIcon.glyphMap = {};
  return MockIcon;
};

jest.mock('@expo/vector-icons', () => ({
  Ionicons: mockCreateIcon(),
  MaterialCommunityIcons: mockCreateIcon(),
}));

jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => ({
  __esModule: true,
  default: mockCreateIcon(),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The Bible texts that ship with the app (assets/bible) are assets Metro
// bundles, which Jest can't load. Tests read the same files from disk, so any
// test that opens the Chinese Bible reads the real 1919 text.
// test/bundled-bible.test.ts tests the real loader.
jest.mock('@/services/BundledBible', () => {
  const { readFileSync } = require('node:fs');
  const { join } = require('node:path');
  return {
    hasBundledBibleFile: () => true,
    readBundledBibleFile: async (collection: string, name: string) =>
      JSON.parse(readFileSync(join(process.cwd(), 'assets/bible', collection, `${name}.biblejson`), 'utf8')),
  };
});

// The cache directory, for the copies services/CacheStore.ts keeps on a phone.
jest.mock('expo-file-system', () => require('./helpers/file-system-mock').fileSystemMock);
beforeEach(() => {
  require('./helpers/file-system-mock').mockFiles.clear();
});

// This intentional TypeScript setup expression verifies that Jest transforms
// root test/ support files before the behavioral suites execute.
void createElement;
