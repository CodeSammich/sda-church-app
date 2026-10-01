// Expo reads this after app.json and uses what it returns. It adds the store
// build numbers, which are computed from the version so nobody bumps them by
// hand: 0.40.0 → 40000. See docs/operations/version-numbers.md.
//
// A debug-signed Android preview (APP_VARIANT=preview, which
// scripts/build-android-native.mjs sets only for those) also gets its own app
// ID and name. Android won't install an app over one with the same ID and a
// different signature, so the preview installs beside the Play version instead
// of replacing it (#378). Store builds never set the variant.
const { storeBuildNumber } = require('./scripts/store-build-number.cjs');

const PREVIEW_NAME = 'NYCCSDA Preview';
const PREVIEW_PACKAGE_SUFFIX = '.preview';

module.exports = ({ config }) => {
  const buildNumber = storeBuildNumber(config.version);
  const preview = process.env.APP_VARIANT === 'preview';
  return {
    ...config,
    ...(preview ? { name: PREVIEW_NAME } : {}),
    ios: { ...config.ios, buildNumber: String(buildNumber) },
    android: {
      ...config.android,
      versionCode: buildNumber,
      ...(preview ? { package: `${config.android.package}${PREVIEW_PACKAGE_SUFFIX}` } : {}),
    },
  };
};
