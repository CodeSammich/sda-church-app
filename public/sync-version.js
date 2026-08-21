const fs = require('fs');
const path = require('path');

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const writeJson = (filePath, value) => {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const syncVersion = ({
  projectRoot = path.resolve(__dirname, '..'),
  requestedVersion,
  increment = false,
  logger = console,
} = {}) => {
  if (requestedVersion && increment) {
    throw new Error('Use either --version or --increment, not both');
  }

  const pkgPath = path.join(projectRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  let version = requestedVersion || pkg.version;

  if (increment) {
    if (!SEMVER_PATTERN.test(version)) {
      throw new Error(`Cannot increment invalid semantic version: ${version}`);
    }
    const parts = version.split('.').map(Number);
    parts[2] += 1;
    version = parts.join('.');
  }

  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(
      `Version must use major.minor.patch format; received: ${version || '<empty>'}`,
    );
  }

  pkg.version = version;
  writeJson(pkgPath, pkg);
  logger.log(`Syncing version ${version} across configuration files...`);

  const lockPath = path.join(projectRoot, 'package-lock.json');
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    lock.version = version;
    if (lock.packages && lock.packages['']) {
      lock.packages[''].version = version;
    }
    writeJson(lockPath, lock);
    logger.log('Successfully synced version to package-lock.json');
  }

  const appJsonPath = path.join(projectRoot, 'app.json');
  if (fs.existsSync(appJsonPath)) {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    appJson.expo.version = version;
    writeJson(appJsonPath, appJson);
    logger.log('Successfully synced version to app.json');
  }

  const swPath = path.join(projectRoot, 'public/sw.js');
  if (fs.existsSync(swPath)) {
    let swContent = fs.readFileSync(swPath, 'utf8');
    const versionPattern = /const VERSION\s*=\s*(['"])[^'"]*\1;/;
    if (!versionPattern.test(swContent)) {
      throw new Error('Could not find the VERSION constant in public/sw.js');
    }
    swContent = swContent.replace(versionPattern, `const VERSION = '${version}';`);
    fs.writeFileSync(swPath, swContent);
    logger.log('Successfully synced version to public/sw.js');
  }

  return version;
};

const parseArgs = (args) => {
  const versionIndex = args.indexOf('--version');
  if (versionIndex !== -1 && !args[versionIndex + 1]) {
    throw new Error('--version requires a major.minor.patch value');
  }
  return {
    increment: args.includes('--increment'),
    requestedVersion: versionIndex === -1 ? undefined : args[versionIndex + 1],
  };
};

if (require.main === module) {
  try {
    syncVersion(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(`Version sync failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { syncVersion };
