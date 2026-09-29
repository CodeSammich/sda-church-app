// Expo reads this after app.json and uses what it returns. It adds the store
// build numbers, which are computed from the version so nobody bumps them by
// hand: 0.40.0 → 40000. See docs/operations/version-numbers.md.
const { storeBuildNumber } = require('./scripts/store-build-number.cjs');

module.exports = ({ config }) => {
  const buildNumber = storeBuildNumber(config.version);
  return {
    ...config,
    ios: { ...config.ios, buildNumber: String(buildNumber) },
    android: { ...config.android, versionCode: buildNumber },
  };
};
