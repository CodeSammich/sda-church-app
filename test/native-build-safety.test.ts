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

const readRepoFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Android PR preview', () => {
  it('keeps the job name the Main protection ruleset requires', () => {
    // Required check: "Build Android debug APK (ARM)". Renaming the job without
    // updating the ruleset blocks every release PR.
    expect(readRepoFile('.github/workflows/android-pr-preview.yml'))
      .toContain('name: Build Android debug APK (ARM)');
  });
});

describe('Android audio e2e', () => {
  const workflow = readRepoFile('.github/workflows/android-audio-e2e.yml');

  it('reads no secrets and never runs pull request code with a write token', () => {
    expect(workflow).not.toMatch(/secrets\./);
    expect(workflow).not.toContain('pull_request_target');
    expect(workflow).toMatch(/^permissions:\n  contents: read\n/m);
  });

  it('gives issue access only to the nightly alert job', () => {
    expect(workflow.match(/issues: write/g)).toHaveLength(1);
    const alertJob = workflow.slice(workflow.indexOf('\n  alert:\n'));
    expect(alertJob).toContain('issues: write');
    expect(alertJob).toContain("github.event_name == 'schedule'");
  });

  it('runs the scenarios with the church host blocked, as they expect', () => {
    expect(workflow).toContain('--local=/adventistconnect.org/');
    expect(workflow).toContain("E2E_PRIMARY_BLOCKED: '1'");
    expect(workflow).toContain('scripts/e2e/android-bible-audio.sh');
  });
});

describe('iOS PR preview', () => {
  const workflow = readRepoFile('.github/workflows/ios-pr-preview.yml');

  it('builds unsigned and never reads secrets, so pull requests can run it', () => {
    expect(workflow).toContain('CODE_SIGNING_ALLOWED=NO');
    expect(workflow).toContain('-sdk iphonesimulator');
    expect(workflow).not.toMatch(/secrets\./);
    expect(workflow).not.toContain('pull_request_target');
  });

  it('builds for both Apple Silicon and Intel Macs', () => {
    expect(workflow).toMatch(/runner: macos-26\s+arch: arm64/);
    expect(workflow).toMatch(/runner: macos-26-intel\s+arch: x86_64/);
  });

  it('keeps the job names the Main protection ruleset requires', () => {
    // Required checks: "Build iOS Simulator app (Apple Silicon Mac)" and
    // "Build iOS Simulator app (Intel Mac)". Renaming the job without
    // updating the ruleset blocks every release PR.
    expect(workflow).toContain('name: Build iOS Simulator app (${{ matrix.mac }} Mac)');
    expect(workflow).toMatch(/- mac: Apple Silicon\n/);
    expect(workflow).toMatch(/- mac: Intel\n/);
  });

  it('uses the same Xcode as the signed iOS build', () => {
    const xcode = /\/Applications\/Xcode_[\d.]+\.app/;
    expect(workflow.match(xcode)?.[0]).toBe(
      readRepoFile('.github/workflows/native-ios-build.yml').match(xcode)?.[0],
    );
  });

  // Running the script on a Mac would start a real build, so only check the
  // refusal where it cannot build.
  (process.platform === 'darwin' ? it.skip : it)(
    'explains that the local Simulator needs a Mac',
    () => {
      const result = spawnSync(
        process.execPath,
        [resolve(process.cwd(), 'scripts/build-ios-simulator.mjs')],
        { cwd: process.cwd(), encoding: 'utf8' },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('The iOS Simulator only runs on macOS with Xcode');
    },
  );
});

describe('Expo template pin', () => {
  it('uses one template version for every native build path', () => {
    const files = [
      'scripts/build-android-native.mjs',
      'scripts/build-ios-simulator.mjs',
      '.github/workflows/native-ios-build.yml',
      '.github/workflows/ios-pr-preview.yml',
      'docs/operations/native-builds.md',
    ];
    const versions = new Set(
      files.flatMap((file) =>
        [...readRepoFile(file).matchAll(/expo-template-bare-minimum@(\d+\.\d+\.\d+)/g)].map(
          ([, version]) => version,
        ),
      ),
    );
    expect([...versions]).toHaveLength(1);
  });
});
