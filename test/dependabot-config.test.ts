import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const yaml = require('js-yaml');

// Dependabot's npm updates: where its pull requests go, and which packages it
// leaves to Expo.
const config = yaml.load(readFileSync(join(process.cwd(), '.github/dependabot.yml'), 'utf8'));
const npm = config.updates.find((update: { 'package-ecosystem': string }) => update['package-ecosystem'] === 'npm');

describe('Dependabot', () => {
  it('opens its pull requests against release-candidate, where they can merge', () => {
    expect(npm['target-branch']).toBe('release-candidate');
  });

  // Not on Expo's list, but they follow its versions, so only their updates
  // that would break the match are ignored.
  const follows: Record<string, string[]> = {
    '@react-native/jest-preset': ['version-update:semver-major', 'version-update:semver-minor'],
    'babel-preset-expo': ['version-update:semver-major'],
  };

  it('leaves exactly the packages Expo pins to `npx expo install --fix`', () => {
    // Expo's SDK lists the version of each package it pins. A newer one breaks
    // the build until the next SDK, so Dependabot's pull request could never
    // merge. Add or remove a pinned package, and this list changes with it.
    const pinned = require('expo/bundledNativeModules.json');
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    const used = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    const outright = npm.ignore.filter((rule: object) => !('update-types' in rule));
    const partly = npm.ignore.filter((rule: object) => 'update-types' in rule);

    expect(outright.map((rule: { 'dependency-name': string }) => rule['dependency-name']).sort())
      .toEqual(used.filter((name) => pinned[name]).sort());
    for (const rule of outright) expect(Object.keys(rule)).toEqual(['dependency-name']);
    expect(Object.fromEntries(partly.map((rule: { 'dependency-name': string; 'update-types': string[] }) =>
      [rule['dependency-name'], rule['update-types']]))).toEqual(follows);
    for (const name of Object.keys(follows)) {
      expect(used).toContain(name);
      expect(pinned[name]).toBeUndefined();
    }
  });

  it('gives `expo` its own pull request, so its update can\'t hold up the weekly group', () => {
    expect(npm.groups['minor-and-patch']['exclude-patterns']).toEqual(['expo']);
  });

  it('still offers `expo` itself, the sign of a new SDK or patch release', () => {
    const ignored = npm.ignore.map((rule: { 'dependency-name': string }) => rule['dependency-name']);
    expect(ignored).not.toContain('expo');
    // And held-back majors outside Expo's list, such as TypeScript's.
    expect(ignored).not.toContain('typescript');
    expect(ignored).not.toContain('@types/node');
  });
});
