import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const androidBuildScript = resolve(
  process.cwd(),
  'scripts/build-android-native.mjs',
);
const androidSigningPlugin = readFileSync(
  resolve(process.cwd(), 'plugins/withAndroidLocalSigning.js'),
  'utf8',
);
const signingVariables = [
  'ANDROID_KEYSTORE_PATH',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD',
];

const runAndroidBuild = (args: string[]) => {
  const environment = { ...process.env };
  for (const variable of signingVariables) {
    delete environment[variable];
  }

  const result = spawnSync(process.execPath, [androidBuildScript, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: environment,
  });

  return `${result.stdout || ''}\n${result.stderr || ''}`;
};

describe('native Android build safety gates', () => {
  it('fails a release build before prebuild when signing values are absent', () => {
    const output = runAndroidBuild(['--apk']);

    expect(output).toContain(
      'Android release signing is required',
    );
    expect(output).toContain('build:android:apk:debug');
  });

  it('does not allow debug signing for an AAB build', () => {
    expect(runAndroidBuild(['--debug'])).toContain(
      '--debug is supported only for an Android APK build',
    );
  });

  it('avoids Groovy signing-variable names that shadow DSL methods', () => {
    expect(androidSigningPlugin).toContain('def signingKeyAlias');
    expect(androidSigningPlugin).toContain('def signingKeyPassword');
    expect(androidSigningPlugin).toContain('keyAlias signingKeyAlias');
    expect(androidSigningPlugin).toContain('keyPassword signingKeyPassword');
    expect(androidSigningPlugin).not.toContain('def keyAlias =');
    expect(androidSigningPlugin).not.toContain('def keyPassword =');
  });
});
