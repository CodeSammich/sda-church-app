import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const androidRoot = resolve(projectRoot, 'android');
const packageJson = JSON.parse(
  await readFile(resolve(projectRoot, 'package.json'), 'utf8'),
);
const appJson = JSON.parse(await readFile(resolve(projectRoot, 'app.json'), 'utf8'));
const isApk = process.argv.includes('--apk');
const isDebugSigning = process.argv.includes('--debug');
const architecturesIndex = process.argv.indexOf('--architectures');
const architecturePreset =
  architecturesIndex === -1 ? undefined : process.argv[architecturesIndex + 1];
const outputIndex = process.argv.indexOf('--output');
const requestedOutput = outputIndex === -1 ? undefined : process.argv[outputIndex + 1];

const architecturePresets = {
  arm: 'armeabi-v7a,arm64-v8a',
  intel: 'x86,x86_64',
};

if (outputIndex !== -1 && !requestedOutput) {
  throw new Error('--output requires a destination file');
}

if (architecturesIndex !== -1 && !architecturePreset) {
  throw new Error('--architectures requires arm or intel');
}

if (architecturePreset && !architecturePresets[architecturePreset]) {
  throw new Error(
    `Unknown architecture preset: ${architecturePreset}. Use arm or intel.`,
  );
}

if (isDebugSigning && !isApk) {
  throw new Error('--debug is supported only for an Android APK build');
}

const androidConfig = appJson.expo?.android || {};
if (!androidConfig.package) {
  throw new Error('app.json must define expo.android.package before building Android');
}

if (!Number.isInteger(androidConfig.versionCode) || androidConfig.versionCode < 1) {
  throw new Error(
    'Set an explicit positive expo.android.versionCode in app.json before building a store binary. It must be higher than the last Google Play versionCode.',
  );
}

const requiredSigningVariables = [
  'ANDROID_KEYSTORE_PATH',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD',
];
if (!isDebugSigning) {
  const missingSigningVariables = requiredSigningVariables.filter(
    (name) => !process.env[name],
  );

  if (missingSigningVariables.length > 0) {
    throw new Error(
      `Android release signing is required. Set: ${missingSigningVariables.join(', ')}. For local device testing, use build:android:apk:debug instead.`,
    );
  }

  if (!existsSync(process.env.ANDROID_KEYSTORE_PATH)) {
    throw new Error(
      `Android keystore does not exist: ${process.env.ANDROID_KEYSTORE_PATH}`,
    );
  }
}

// Tell the config plugin which release signing mode was explicitly requested.
// A debug-signed APK uses Gradle's generated local debug key and never uses the
// production upload keystore or its passwords.
process.env.ANDROID_DEBUG_SIGNING_BUILD = isDebugSigning ? 'true' : 'false';

const run = (command, args, cwd = projectRoot, environment = process.env) => {
  const executable = process.platform === 'win32' && command === 'npx' ? 'npx.cmd' : command;
  const result = spawnSync(executable, args, {
    cwd,
    env: environment,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

mkdirSync(resolve(projectRoot, 'build'), { recursive: true });

// Expo prebuild only needs the signing mode, not the production keystore or
// passwords. Keep those values out of config plugins and npm child processes;
// expose them only to the Gradle invocation that actually signs the binary.
const prebuildEnvironment = { ...process.env };
for (const name of requiredSigningVariables) {
  delete prebuildEnvironment[name];
}

run('npx', [
  'expo',
  'prebuild',
  '--template',
  'expo-template-bare-minimum@58.0.3',
  '--platform',
  'android',
  '--clean',
  '--no-install',
], projectRoot, prebuildEnvironment);

const gradleArgs = [':app:' + (isApk ? 'assembleRelease' : 'bundleRelease')];
if (architecturePreset) {
  gradleArgs.push(
    `-PreactNativeArchitectures=${architecturePresets[architecturePreset]}`,
  );
}
run('./gradlew', gradleArgs, androidRoot);

const extension = isApk ? 'apk' : 'aab';
const sourcePath = resolve(
  androidRoot,
  'app',
  'build',
  'outputs',
  isApk ? 'apk' : 'bundle',
  'release',
  `app-release.${extension}`,
);
const outputPath = resolve(
  projectRoot,
  requestedOutput ||
    `build/app-${packageJson.version}-build-${new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')}${architecturePreset ? `-${architecturePreset}` : ''}.${extension}`,
);

if (!existsSync(sourcePath)) {
  throw new Error(`Expected Android output was not found: ${sourcePath}`);
}

copyFileSync(sourcePath, outputPath);
console.log(
  `Android ${isDebugSigning ? 'debug-signed ' : ''}${extension.toUpperCase()} written to ${outputPath}`,
);
