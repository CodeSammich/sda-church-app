const { resolveReleaseVersion } = require('../scripts/release-version-policy.cjs');

describe('release version policy', () => {
  it('takes the version from a release PR title into main', () => {
    expect(resolveReleaseVersion({
      title: 'Release/1.1.0: Hymnals in one place',
      baseRef: 'main',
    })).toBe('1.1.0');
  });

  it('accepts a title with no summary', () => {
    expect(resolveReleaseVersion({ title: 'Release/1.0.2', baseRef: 'main' })).toBe('1.0.2');
  });

  it('rejects a release PR into main without a concrete version', () => {
    for (const title of [
      'Hymnals in one place',
      'Release/1.1.x: Hymnals in one place',
      'release/1.1.0: Hymnals in one place',
      'Release/1.1: Hymnals in one place',
    ]) {
      expect(() => resolveReleaseVersion({ title, baseRef: 'main' }))
        .toThrow('must be titled Release/<major>.<minor>.<patch>');
    }
  });

  it('needs no version from a feature PR into release-candidate', () => {
    expect(resolveReleaseVersion({
      title: 'Show every hymnal on one page',
      baseRef: 'release-candidate',
    })).toBe('');
  });

  it('ignores a version in a feature PR title', () => {
    // The release PR's title decides the version, so an old-style feature
    // title can't set one.
    expect(resolveReleaseVersion({
      title: 'Release/9.9.9: Old-style title',
      baseRef: 'release-candidate',
    })).toBe('');
  });
});
