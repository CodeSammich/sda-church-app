const fs = require('node:fs');
const path = require('node:path');

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;
const RELEASE_REF_PATTERN = /^release\/(\d+)\.(\d+)\.(\d+|x)$/;
const RELEASE_TITLE_PATTERN = /^Release\/(\d+)\.(\d+)\.(\d+|x)(:|\s|$)/;

const getPackageVersion = () => {
  const packagePath = path.resolve(__dirname, '..', 'package.json');
  return JSON.parse(fs.readFileSync(packagePath, 'utf8')).version;
};

const parseReleaseRef = (ref) => {
  const match = RELEASE_REF_PATTERN.exec(ref || '');
  if (!match) return null;
  return {
    majorMinor: `${match[1]}.${match[2]}`,
    patch: match[3],
  };
};

const resolveReleaseVersion = ({
  title,
  baseRef,
  headRef,
  headRepository,
  repository,
  packageVersion,
}) => {
  const titleMatch = RELEASE_TITLE_PATTERN.exec(title || '');
  if (!titleMatch) {
    throw new Error(
      'PR title must use Release/<major.minor>.<patch-or-x> (for example: Release/1.2.x: Describe the changes).',
    );
  }

  const titleMajorMinor = `${titleMatch[1]}.${titleMatch[2]}`;
  const titlePatch = titleMatch[3];
  let version;

  if (titlePatch === 'x') {
    if (!SEMVER_PATTERN.test(packageVersion || '')) {
      throw new Error(
        `package.json must contain a concrete major.minor.patch version when the PR title uses an x patch; received ${packageVersion || '<empty>'}.`,
      );
    }
    const packageMajorMinor = packageVersion.split('.').slice(0, 2).join('.');
    if (packageMajorMinor !== titleMajorMinor) {
      throw new Error(
        `PR title release line ${titleMajorMinor}.x must match package.json release line ${packageMajorMinor}.`,
      );
    }
    version = packageVersion;
  } else {
    version = `${titleMajorMinor}.${titlePatch}`;
  }

  const applicableRefs = [
    ['destination', parseReleaseRef(baseRef)],
    ...(headRepository === repository
      ? [['source', parseReleaseRef(headRef)]]
      : []),
  ];
  for (const [label, releaseRef] of applicableRefs) {
    if (releaseRef && releaseRef.majorMinor !== titleMajorMinor) {
      throw new Error(
        `PR title release line ${titleMajorMinor}.x must match ${label} branch release/${releaseRef.majorMinor}.${releaseRef.patch}.`,
      );
    }
  }

  return version;
};

if (require.main === module) {
  try {
    process.stdout.write(
      resolveReleaseVersion({
        title: process.env.PR_TITLE,
        baseRef: process.env.BASE_REF,
        headRef: process.env.HEAD_REF,
        headRepository: process.env.HEAD_REPOSITORY,
        repository: process.env.REPOSITORY,
        packageVersion: getPackageVersion(),
      }),
    );
  } catch (error) {
    console.error(`Release version validation failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  parseReleaseRef,
  resolveReleaseVersion,
};
