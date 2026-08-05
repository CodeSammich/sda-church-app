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

// This intentional TypeScript setup expression verifies that Jest transforms
// root test/ support files before the behavioral suites execute.
void createElement;
