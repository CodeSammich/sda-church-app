import { mkdtempSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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

  it('builds a debug-signed APK as the preview app, and a store build never', () => {
    // #378: the preview gets its own app ID, so it installs beside the store app.
    const script = readFileSync(androidBuildScript, 'utf8');
    expect(script).toContain("if (isDebugSigning) {\n  process.env.APP_VARIANT = 'preview';\n} else {\n  delete process.env.APP_VARIANT;\n}");
    // A reused android/ project is regenerated when its app ID doesn't match.
    expect(script).toContain('generatedPackage !== appPackage');
    expect(script).toContain('|| forcePrebuild || packageChanged');
    // The audio test runs against the debug-signed preview by default.
    expect(readFileSync(resolve(process.cwd(), 'scripts/e2e/android-bible-audio.sh'), 'utf8')).toContain(
      'PKG="${E2E_PACKAGE:-org.nyccsda.app.preview}"',
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

  it('builds only release PRs, not Dependabot PRs into main', () => {
    expect(readRepoFile('.github/workflows/android-pr-preview.yml'))
      .toContain("github.event.pull_request.head.ref == 'release-candidate'");
  });
});

// The slow checks run once per release, on the release PR into main, where
// the Main protection ruleset requires them. Feature PRs into release-candidate
// get only the quick checks, and PRs into main from any other branch, such as
// Dependabot's, skip them without taking a runner.
describe.each([
  ['android-audio-e2e.yml', 'e2e'],
  ['bulletin-integration.yml', 'verify-bulletin-api'],
  ['ios-pr-preview.yml', 'simulator'],
])('%s runs only on release PRs into main', (file, job) => {
  const workflow = readRepoFile(`.github/workflows/${file}`);

  it('triggers on pull requests into main only, with no path filter', () => {
    // A path filter would skip the release PR, and a required check that
    // never reports blocks the merge.
    const trigger = workflow.slice(workflow.indexOf('\non:'), workflow.indexOf('\npermissions:'));
    expect(trigger).toMatch(/\n  pull_request:\n    branches:\n      - main\n(?! {6}-)/);
    expect(trigger).not.toContain('paths:');
  });

  it('skips PRs whose head is not the release-candidate branch in this repository', () => {
    const jobStart = workflow.indexOf(`\n  ${job}:\n`);
    expect(jobStart).toBeGreaterThan(-1);
    const condition = workflow.slice(jobStart, workflow.indexOf('\n    runs-on:', jobStart));
    expect(condition).toContain("github.head_ref == 'release-candidate'");
    expect(condition).toContain('github.event.pull_request.head.repo.full_name == github.repository');
    expect(condition).toContain("github.event_name != 'pull_request'");
  });
});

describe('Native Android build', () => {
  it('reads the release version for the GitHub Release', () => {
    // A quoting mistake here once failed every release after the binaries built.
    const workflow = readRepoFile('.github/workflows/native-android-build.yml');
    const command = workflow.match(/- name: Read release version\n\s+id: version\n\s+run: (.+)\n/)?.[1];
    expect(command).toBeDefined();
    const output = resolve(mkdtempSync(join(tmpdir(), 'release-version-')), 'output');
    const result = spawnSync('bash', ['-c', command as string], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, GITHUB_OUTPUT: output },
    });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(readFileSync(output, 'utf8')).toBe(
      `version=${JSON.parse(readRepoFile('package.json')).version}\n`,
    );
  });
});

// Store uploads run in their own jobs and environment, apart from the signing
// secrets, and run no npm packages, so a compromised dependency in the build
// job can't reach the store credentials.
describe.each([
  [
    'native-ios-build.yml',
    'testflight_upload',
    ['APP_STORE_CONNECT_API_KEY_ID', 'APP_STORE_CONNECT_API_ISSUER_ID', 'APP_STORE_CONNECT_API_PRIVATE_KEY'],
  ],
  ['native-android-build.yml', 'play_upload', ['GOOGLE_PLAY_WORKLOAD_IDENTITY_PROVIDER', 'GOOGLE_PLAY_SERVICE_ACCOUNT']],
])('%s store upload', (file, job, secrets) => {
  const workflow = readRepoFile(`.github/workflows/${file}`);
  const start = workflow.indexOf(`\n  ${job}:\n`);
  const length = workflow.slice(start + 1).search(/\n {2}[a-z_-]+:\n/);
  const uploadJob = workflow.slice(start, length === -1 ? undefined : start + 1 + length);
  const otherJobs = workflow.replace(uploadJob, '');

  it('runs in the store-upload environment, only for main in this repository', () => {
    expect(start).toBeGreaterThan(-1);
    expect(uploadJob).toContain('environment: store-upload');
    expect(uploadJob).toContain("github.ref == 'refs/heads/main'");
    expect(uploadJob).toContain('github.event.repository.fork == false');
  });

  it('keeps the store credentials out of every other job, and the signing secrets out of it', () => {
    for (const secret of secrets) {
      expect(uploadJob).toContain(`secrets.${secret}`);
      expect(otherJobs).not.toContain(secret);
    }
    expect(uploadJob).not.toMatch(/secrets\.(IOS|ANDROID)_/);
  });

  it('runs no npm packages and never traces the shell', () => {
    expect(uploadJob).not.toMatch(/npm (ci|install)|npx |cache:/);
    expect(uploadJob).not.toMatch(/^\s+set -[a-z]*x/m);
  });

  it('skips with a notice until the secrets are set', () => {
    expect(uploadJob).toContain('::notice title=');
  });
});

describe('Google Play upload', () => {
  it('lets only the upload job ask GitHub for an identity token', () => {
    // The keyless sign-in's token is accepted only for the store-upload
    // environment, but no other job should be able to request one at all.
    const workflow = readRepoFile('.github/workflows/native-android-build.yml');
    expect(workflow.match(/id-token: write/g)).toHaveLength(1);
    const playJob = workflow.slice(workflow.indexOf('\n  play_upload:\n'), workflow.indexOf('\n  release:\n'));
    expect(playJob).toContain('id-token: write');
  });

  it("reads the release notes from git, never by pasting the commit message into the shell", () => {
    // `${{ github.event.head_commit.message }}` inside `run:` would let a
    // commit message run commands.
    const workflow = readRepoFile('.github/workflows/native-android-build.yml');
    expect(workflow).toContain('RELEASE_COMMIT_SUBJECT="$(git log -1 --format=%s)"');
    expect(workflow).not.toContain('head_commit');
  });
});

describe('Apple signing reminders', () => {
  it('reads no secrets in the monitor or in the per-build date check', () => {
    // The dates aren't secret; neither job needs Apple credentials.
    const monitor = readRepoFile('.github/workflows/apple-signing-monitor.yml');
    expect(monitor).not.toMatch(/secrets\./);
    expect(monitor).not.toContain('environment:');
    // Every repository admin gets the Apple reminder by email.
    expect(monitor).toContain('vars.APPLE_SIGNING_ALERT_ASSIGNEES || vars.MONITOR_ALERT_ASSIGNEES');
    const workflow = readRepoFile('.github/workflows/native-ios-build.yml');
    const start = workflow.indexOf('\n  signing_dates:\n');
    const job = workflow.slice(start, workflow.indexOf('\n  release_ipa:\n'));
    expect(start).toBeGreaterThan(-1);
    expect(job).not.toMatch(/\$\{\{\s*secrets\.|^\s+environment:/m);
    expect(job).toContain('node scripts/check-apple-signing-expiry.cjs --profile');
  });
});

describe('pull_request_target', () => {
  it('is used only by the three workflows the Actions event policy allows', () => {
    // The repository's Actions event policy allows every event, so this test is
    // the safeguard against a "pwn request": a new pull_request_target workflow
    // must be reviewed (it must never run pull request code while it can read
    // secrets or write) and added here and to the admin runbook.
    const { readdirSync } = require('node:fs');
    // Any mention outside a comment counts, so `on: [push, pull_request_target]`
    // is caught too.
    const withoutComments = (text: string) => text.replace(/(^|\s)#.*$/gm, '');
    const users = readdirSync(resolve(process.cwd(), '.github/workflows'))
      .filter((file: string) => withoutComments(readRepoFile(`.github/workflows/${file}`)).includes('pull_request_target'))
      .sort();
    expect(users).toEqual([
      'android-pr-preview.yml',
      'main-release-source-gate.yml',
      'pending-release-label.yml',
    ]);
    const runbook = readRepoFile('docs/operations/admin-runbook.md');
    for (const file of users) {
      expect(runbook).toContain(`.github/workflows/${file}`);
      expect(readRepoFile(`.github/workflows/${file}`)).toContain('Settings → Actions → Policies');
    }
  });

  it('never checks out pull request code in the gate or the label workflow', () => {
    for (const file of ['main-release-source-gate.yml', 'pending-release-label.yml']) {
      expect(readRepoFile(`.github/workflows/${file}`)).not.toContain('actions/checkout');
    }
  });

  it('builds only the release-candidate branch of this repository in the Android preview, never a fork', () => {
    const workflow = readRepoFile('.github/workflows/android-pr-preview.yml');
    expect(workflow).toContain('github.event.pull_request.head.repo.full_name == github.repository');
    expect(workflow).toContain('test "$HEAD_REPOSITORY" = "$GITHUB_REPOSITORY"');
  });

  it('keeps pull request code away from secrets in the Android preview', () => {
    const workflow = readRepoFile('.github/workflows/android-pr-preview.yml');
    const build = workflow.slice(workflow.indexOf('\n  build:\n'), workflow.indexOf('\n  upload:\n'));
    const upload = workflow.slice(workflow.indexOf('\n  upload:\n'));
    // The build job runs the pull request's code, so it gets no secrets, no
    // environment, and no saved credentials.
    expect(build).toContain('ref: ${{ needs.resolve-pr.outputs.head_sha }}');
    expect(build).toContain('persist-credentials: false');
    expect(build).not.toMatch(/\$\{\{\s*secrets\.|^\s+environment:/m);
    // The upload job has the Drive secret, so it runs only main's upload
    // script on the finished APK.
    expect(upload).toContain('environment: production');
    expect(upload.match(/actions\/checkout@/g)).toHaveLength(1);
    expect(upload).toContain('ref: ${{ needs.resolve-pr.outputs.trusted_sha }}');
    expect(upload).not.toMatch(/head_sha|\bnpm |\bnpx /);
  });

  it('passes pull request text to scripts only through environment variables', () => {
    // A title, body, or branch name pasted into a script as ${{ … }} becomes
    // part of the script, so a pull request could inject commands.
    for (const file of ['android-pr-preview.yml', 'main-release-source-gate.yml', 'pending-release-label.yml']) {
      const lines = readRepoFile(`.github/workflows/${file}`).split('\n');
      lines.forEach((line, index) => {
        const key = /^(\s*(?:-\s+)?)(?:run|script):(.*)$/.exec(line);
        if (!key) return;
        const script = [key[2]];
        for (const next of lines.slice(index + 1)) {
          if (next.trim() && next.search(/\S/) <= key[1].length) break;
          script.push(next);
        }
        expect(`${file}: ${script.join('\n')}`).not.toContain('${{');
      });
    }
  });

  it('grants write access only to label issues, and no secret but the workflow token to the gate or labels', () => {
    const writes = (file: string) => (readRepoFile(`.github/workflows/${file}`).match(/^\s+[a-z-]+:\s*write\b/gm) ?? [])
      .map((line) => line.trim());
    expect(writes('android-pr-preview.yml')).toEqual([]);
    expect(writes('main-release-source-gate.yml')).toEqual([]);
    expect(writes('pending-release-label.yml')).toEqual(['issues: write']);
    for (const file of ['main-release-source-gate.yml', 'pending-release-label.yml']) {
      const secrets = [...readRepoFile(`.github/workflows/${file}`).matchAll(/\$\{\{\s*secrets\.(\w+)/g)];
      expect(secrets.map((match) => match[1]).filter((name) => name !== 'GITHUB_TOKEN')).toEqual([]);
    }
  });

  it("never turns off checkout's protection against fork code", () => {
    const { readdirSync } = require('node:fs');
    for (const file of readdirSync(resolve(process.cwd(), '.github/workflows'))) {
      expect(readRepoFile(`.github/workflows/${file}`)).not.toContain('allow-unsafe-pr-checkout');
    }
  });
});

describe('GitHub Release', () => {
  it('attaches the IPA from its own job, keeping the signing job read-only', () => {
    const workflow = readRepoFile('.github/workflows/native-ios-build.yml');
    const signing = workflow.slice(workflow.indexOf('\n  ios_build_ipa:\n'), workflow.indexOf('\n  signing_dates:\n'));
    expect(signing).not.toContain('contents: write');
    const start = workflow.indexOf('\n  release_ipa:\n');
    const job = workflow.slice(start, workflow.indexOf('\n  testflight_upload:\n'));
    expect(start).toBeGreaterThan(-1);
    expect(job).toContain('contents: write');
    expect(job).not.toMatch(/\$\{\{\s*secrets\.|^\s+environment:/m);
    expect(job).toContain("github.event_name == 'push'");
    expect(job).toContain('scripts/publish-github-release.sh');
  });

  it('adds the Android binaries with the same script, so either workflow can finish first', () => {
    const workflow = readRepoFile('.github/workflows/native-android-build.yml');
    expect(workflow).toContain('scripts/publish-github-release.sh "$RELEASE_TAG" release-assets/*');
    // The old step failed whenever the release already existed.
    expect(workflow).not.toContain('Bump package.json version before building another release');
  });
});

describe('TestFlight upload', () => {
  const workflow = readRepoFile('.github/workflows/native-ios-build.yml');

  it('removes the App Store Connect key however the upload ends', () => {
    expect(workflow).toContain(`trap 'rm -f "$KEY_PATH"' EXIT`);
    expect(workflow).toMatch(
      /- name: Remove the IPA and API key\n\s+if: always\(\)\n\s+run: rm -rf [^\n]*\.appstoreconnect\/private_keys/,
    );
  });
});

describe('Store build numbers in CI', () => {
  it('computes the iOS build number from the version', () => {
    expect(readRepoFile('.github/workflows/native-ios-build.yml')).toContain(
      'node scripts/store-build-number.cjs "$APP_VERSION"',
    );
  });

  it('requires each release PR to raise the version, and with it the build number', () => {
    const workflow = readRepoFile('.github/workflows/pr-check.yml');
    expect(workflow).toContain('node scripts/store-build-number.cjs "$HEAD_VER"');
    expect(workflow).toContain('if [ "$HEAD_BUILD" -le "$BASE_BUILD" ]; then');
  });
});

describe('Android audio e2e', () => {
  const workflow = readRepoFile('.github/workflows/android-audio-e2e.yml');

  it('reads no secrets and never runs pull request code with a write token', () => {
    expect(workflow).not.toMatch(/secrets\./);
    expect(workflow).not.toContain('pull_request_target');
    expect(workflow).toMatch(/^permissions:\n  contents: read\n/m);
  });

  it('runs only on release PRs and by hand, with no nightly run or alert', () => {
    // Host outages are the External Dependency Monitor's job, daily; the app
    // code this test checks only changes through a release PR.
    expect(workflow).not.toContain('schedule:');
    expect(workflow).not.toContain('issues: write');
    expect(workflow).not.toContain('\n  alert:\n');
  });

  it('keeps the job name the Main protection ruleset requires', () => {
    expect(workflow).toContain('name: Bible audio on an Android emulator');
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

describe('Bulletin Apps Script deploy', () => {
  const workflow = readRepoFile('.github/workflows/apps-script-deploy.yml');
  const trigger = workflow.slice(workflow.indexOf('\non:'), workflow.indexOf('\npermissions:'));
  const job = workflow.slice(workflow.indexOf('\n  deploy:\n'));

  it('starts on every merge into main, and by hand, but never on a pull request', () => {
    // #442: like the native builds, a release starts it and production approval gates it.
    expect(trigger).toMatch(/\n  push:\n    branches:\n      - main\n(?! {6}-)/);
    expect(trigger).not.toContain('paths:');
    expect(trigger).toContain('workflow_dispatch:');
    expect(trigger).not.toContain('pull_request');
  });

  it('deploys only main in the church repository, after production approval', () => {
    // A manual run from release-candidate would otherwise put unreleased code live.
    const condition = job.slice(job.indexOf('if:'), job.indexOf('environment:'));
    expect(condition).toContain("github.ref == 'refs/heads/main'");
    expect(condition).toContain('github.event.repository.fork == false');
    expect(job).toMatch(/\n    environment: production\n/);
  });

  it('describes a merge deploy with git, never by pasting the commit message into the shell', () => {
    expect(workflow).toContain('DEPLOYMENT_DESCRIPTION="${DEPLOYMENT_DESCRIPTION:-$(git log -1 --format=%s)}"');
    expect(workflow).not.toContain('head_commit');
  });

  it('pins the clasp version it installs', () => {
    // It runs on every release with the deploy credentials, so a new clasp
    // release must not reach it unreviewed.
    expect(workflow).toMatch(/npm install --global @google\/clasp@\d+\.\d+\.\d+\n/);
  });
});
