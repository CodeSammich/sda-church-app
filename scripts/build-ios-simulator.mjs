import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Builds the app for the iOS Simulator and opens it there. A Simulator build
// needs no Apple signing, certificate, developer account, or iPhone, but the
// Simulator only runs on macOS with Xcode. Xcode builds for the Mac's own
// processor, so the same command works on Intel (x86_64) and Apple Silicon
// (arm64) Macs.
//
//   npm run build:ios:simulator                        Release build with the JavaScript bundled in
//   npm run build:ios:simulator -- --debug             Debug build that loads JavaScript from Metro
//   npm run build:ios:simulator -- --device "iPhone 17"
//   npm run build:ios:simulator -- --prebuild          Regenerate ios/ after native config changes

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const iosRoot = resolve(projectRoot, 'ios');
const isDebug = process.argv.includes('--debug');
const forcePrebuild =
  process.argv.includes('--prebuild') || process.env.EXPO_PREBUILD === 'true';
const deviceIndex = process.argv.indexOf('--device');
const device = deviceIndex === -1 ? undefined : process.argv[deviceIndex + 1];

if (deviceIndex !== -1 && !device) {
  throw new Error('--device requires a simulator name, such as "iPhone 17"');
}

if (process.platform !== 'darwin') {
  console.error(
    'The iOS Simulator only runs on macOS with Xcode. On Windows or Linux, use the ' +
      'iOS PR preview workflow in GitHub Actions; see docs/operations/native-builds.md.',
  );
  process.exit(1);
}

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: projectRoot, stdio: 'inherit' });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

// Reuse an already generated local project by default, as the Android build
// script does. The template must match the one in the Android script and the
// iOS workflows; a test checks that they agree.
if (!existsSync(iosRoot) || forcePrebuild) {
  run('npx', [
    'expo',
    'prebuild',
    '--template',
    'expo-template-bare-minimum@58.0.9',
    '--platform',
    'ios',
    '--clean',
    '--no-install',
  ]);
} else {
  console.log(
    'Reusing existing ios/ project; pass --prebuild or set EXPO_PREBUILD=true to regenerate it.',
  );
}

// `expo run:ios` installs CocoaPods when needed, builds for the Simulator,
// installs the app, and launches it. A Release build has its JavaScript
// bundled in, so it runs without Metro, like the Android preview APK.
run('npx', [
  'expo',
  'run:ios',
  '--configuration',
  isDebug ? 'Debug' : 'Release',
  ...(isDebug ? [] : ['--no-bundler']),
  ...(device ? ['--device', device] : []),
]);
