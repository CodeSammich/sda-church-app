const fs = require('fs');
const path = require('path');

// 1. Read the source of truth
const pkgPath = path.join(__dirname, '../package.json');
let pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
let version = pkg.version;

// Check for optional increment flag (e.g. node sync-version.js --increment)
if (process.argv.includes('--increment')) {
  const parts = version.split('.');
  console.log(parts);
  if (parts.length === 3) {
    parts[2] = parseInt(parts[2], 10) + 1;
    version = parts.join('.');
    pkg.version = version;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

    // Reread the package.json to ensure the updated version is used for the rest of the sync
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    version = pkg.version;

    console.log(`Incremented version to ${version} in package.json`);
  }
}

console.log(`Syncing version ${version} across configuration files...`);

// 2. Update app.json (Expo config)
const appJsonPath = path.join(__dirname, '../app.json');
if (fs.existsSync(appJsonPath)) {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  appJson.expo.version = version;
  // For Android/iOS specifically if you want to sync build numbers too:
  // appJson.expo.android.versionCode = parseInt(version.replace(/\./g, ''));
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
  console.log('Successfully synced package.json version to app.json');
}

// 3. Update sw.js (Service Worker)
const swPath = path.join(__dirname, 'sw.js');
if (fs.existsSync(swPath)) {
  let swContent = fs.readFileSync(swPath, 'utf8');
  // Accept either quote style so formatting changes cannot silently prevent
  // the service-worker cache/update version from being refreshed.
  const versionPattern = /const VERSION\s*=\s*(['"])[^'"]*\1;/;
  if (!versionPattern.test(swContent)) {
    throw new Error('Could not find the VERSION constant in public/sw.js');
  }
  swContent = swContent.replace(versionPattern, `const VERSION = '${version}';`);
  fs.writeFileSync(swPath, swContent);
  console.log('Successfully synced package.json version to sw.js');
}
