import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Expo Router runs its own copy of React Navigation. A hook imported straight
// from @react-navigation/native, such as useIsFocused, looks for a different
// navigator and crashes the screen with "Couldn't find a navigation object".
// Import navigation hooks from expo-router instead.
const sources = execFileSync('git', ['ls-files', 'app', 'components', 'constants', 'features', 'hooks', 'services'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter((file) => /\.tsx?$/.test(file));

describe('navigation imports', () => {
  it.each(sources)('%s imports navigation hooks from expo-router, not React Navigation', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(/from ['"]@react-navigation\//);
  });
});
