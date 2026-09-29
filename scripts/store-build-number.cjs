// The store build number: Android's versionCode and iOS's CFBundleVersion.
//
//   build number = major × 1,000,000 + minor × 1,000 + patch
//
//   0.40.0 → 40000    0.40.1 → 40001    0.41.0 → 41000    1.0.0 → 1000000
//
// Users never see it. The App Store and Google Play show the version (0.40.0);
// the build number appears only in TestFlight ("0.40.0 (40000)") and in the two
// store consoles. The stores need it because every upload must have a new
// build number, and Google Play requires it to be higher than every earlier
// upload.
//
// Every merge to main is a release with a new, higher version (PR Version
// Check enforces this), so the build number is computed from the version
// instead of being bumped by hand. Maintainers change only the version.
//
// Don't change the formula. Google Play never accepts a lower versionCode, so
// a new formula must give every future version a higher number than the
// current one does. docs/operations/version-numbers.md explains all of this.

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

// Google Play's largest allowed versionCode.
const MAX_BUILD_NUMBER = 2100000000;

const storeBuildNumber = (version) => {
  const match = VERSION_PATTERN.exec(version || '');
  if (!match) {
    throw new Error(
      `The version must be major.minor.patch, such as 0.40.0; received ${version || '<empty>'}.`,
    );
  }

  const [major, minor, patch] = match.slice(1).map(Number);
  // A minor or patch of 1000 or more would overlap the next part's range, so
  // two versions could share a build number.
  if (minor > 999 || patch > 999) {
    throw new Error(
      `The minor and patch versions must be 999 or lower for store build numbers; received ${version}.`,
    );
  }

  const buildNumber = major * 1000000 + minor * 1000 + patch;
  if (buildNumber < 1) {
    throw new Error('Version 0.0.0 has no store build number; the stores need at least 1.');
  }
  if (buildNumber > MAX_BUILD_NUMBER) {
    throw new Error(`Version ${version} gives a build number above Google Play's limit.`);
  }
  return buildNumber;
};

module.exports = { MAX_BUILD_NUMBER, storeBuildNumber };

// `node scripts/store-build-number.cjs [version]` prints the build number for
// the version given, or for package.json's version.
if (require.main === module) {
  try {
    const version = process.argv[2] || require('../package.json').version;
    console.log(storeBuildNumber(version));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
