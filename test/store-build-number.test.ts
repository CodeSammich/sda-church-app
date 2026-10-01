import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { MAX_BUILD_NUMBER, storeBuildNumber } = require('../scripts/store-build-number.cjs');
const appConfig = require('../app.config.js');

const appJson = JSON.parse(readFileSync(resolve(process.cwd(), 'app.json'), 'utf8'));

describe('store build number', () => {
  it.each([
    ['0.39.0', 39000],
    ['0.40.0', 40000],
    ['0.40.1', 40001],
    ['0.41.0', 41000],
    ['1.0.0', 1000000],
    ['1.2.3', 1002003],
    ['2099.999.999', 2099999999],
  ])('gives %s the build number %i', (version, buildNumber) => {
    expect(storeBuildNumber(version)).toBe(buildNumber);
  });

  it('goes up whenever the version goes up', () => {
    // Google Play refuses a versionCode lower than an earlier upload.
    const versions = ['0.0.1', '0.9.9', '0.39.0', '0.40.0', '0.40.1', '0.40.999', '0.41.0',
      '0.999.999', '1.0.0', '1.0.1', '1.1.0', '2.0.0'];
    const buildNumbers: number[] = versions.map(storeBuildNumber);
    expect(buildNumbers).toEqual([...buildNumbers].sort((a, b) => a - b));
    expect(new Set(buildNumbers).size).toBe(versions.length);
  });

  it.each(['', '1.0', '1.0.0.0', 'v1.0.0', '01.0.0', '1.0.0-beta'])(
    'refuses the malformed version %p',
    (version) => {
      expect(() => storeBuildNumber(version)).toThrow('major.minor.patch');
    },
  );

  it('refuses a minor or patch above 999, which would overlap the next part', () => {
    expect(() => storeBuildNumber('0.1000.0')).toThrow('999 or lower');
    expect(() => storeBuildNumber('0.0.1000')).toThrow('999 or lower');
  });

  it("stays within Google Play's limit", () => {
    expect(() => storeBuildNumber('0.0.0')).toThrow('at least 1');
    expect(() => storeBuildNumber('2100.0.1')).toThrow("Google Play's limit");
    expect(storeBuildNumber('2100.0.0')).toBe(MAX_BUILD_NUMBER);
  });

  it("prints package.json's build number from the command line", () => {
    const result = spawnSync(process.execPath, ['scripts/store-build-number.cjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    const { version } = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
    expect(result.stdout.trim()).toBe(String(storeBuildNumber(version)));
  });
});

describe('app.config.js', () => {
  it('gives both stores the build number computed from the version', () => {
    const config = appConfig({ config: appJson.expo });
    const buildNumber = storeBuildNumber(appJson.expo.version);
    expect(config.android.versionCode).toBe(buildNumber);
    expect(config.ios.buildNumber).toBe(String(buildNumber));
    // Everything else passes through unchanged.
    expect(config.android.package).toBe(appJson.expo.android.package);
    expect(config.ios.bundleIdentifier).toBe(appJson.expo.ios.bundleIdentifier);
  });

  it('gives a debug-signed preview its own app ID and name, so it installs beside the store app', () => {
    const previous = process.env.APP_VARIANT;
    try {
      process.env.APP_VARIANT = 'preview';
      const preview = appConfig({ config: appJson.expo });
      expect(preview.android.package).toBe(`${appJson.expo.android.package}.preview`);
      expect(preview.name).toBe('NYCCSDA Preview');
      expect(preview.android.versionCode).toBe(storeBuildNumber(appJson.expo.version));
      expect(preview.ios.bundleIdentifier).toBe(appJson.expo.ios.bundleIdentifier);

      delete process.env.APP_VARIANT;
      const store = appConfig({ config: appJson.expo });
      expect(store.android.package).toBe(appJson.expo.android.package);
      expect(store.name).toBe(appJson.expo.name);
    } finally {
      if (previous === undefined) delete process.env.APP_VARIANT;
      else process.env.APP_VARIANT = previous;
    }
  });

  it('leaves app.json without hand-set build numbers', () => {
    expect(appJson.expo.android).not.toHaveProperty('versionCode');
    expect(appJson.expo.ios).not.toHaveProperty('buildNumber');
  });
});
