const { parseReleaseRef, resolveReleaseVersion } = require('../scripts/release-version-policy.cjs');

const context = (overrides: Record<string, string> = {}) => ({
  title: 'Release/0.38.x: Prepare release',
  baseRef: 'release/0.38.x',
  headRef: 'feature/audio-fix',
  headRepository: 'CodeSammich/sda-church-app',
  repository: 'New-York-Chinese-Seventh-day-Adventist/sda-church-app',
  packageVersion: '0.38.4',
  ...overrides,
});

describe('release version policy', () => {
  it('accepts an x patch title and uses the concrete package version', () => {
    expect(resolveReleaseVersion(context())).toBe('0.38.4');
  });

  it('accepts a concrete patch title on the same major/minor release line', () => {
    expect(resolveReleaseVersion(context({
      title: 'Release/0.38.4: Prepare release',
      baseRef: 'release/0.38.0',
    }))).toBe('0.38.4');
  });

  it('accepts an organization release source branch with an x patch', () => {
    expect(resolveReleaseVersion(context({
      baseRef: 'main',
      headRef: 'release/0.38.x',
      headRepository: 'New-York-Chinese-Seventh-day-Adventist/sda-church-app',
    }))).toBe('0.38.4');
  });

  it('rejects a title on a different release line', () => {
    expect(() => resolveReleaseVersion(context({
      title: 'Release/0.39.4: Prepare release',
    }))).toThrow('must match destination branch');
  });

  it('rejects an x patch title when package.json has another release line', () => {
    expect(() => resolveReleaseVersion(context({ packageVersion: '0.39.0' })))
      .toThrow('must match package.json release line');
  });

  it('parses concrete and wildcard release branches', () => {
    expect(parseReleaseRef('release/0.38.4')).toEqual({ majorMinor: '0.38', patch: '4' });
    expect(parseReleaseRef('release/0.38.x')).toEqual({ majorMinor: '0.38', patch: 'x' });
    expect(parseReleaseRef('feature/audio-fix')).toBeNull();
  });
});
