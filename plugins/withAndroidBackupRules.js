const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
} = require('@expo/config-plugins');

/**
 * What Android's Auto Backup leaves out (#556). Each path is relative to its
 * domain's folder; `file` is the files directory, expo-file-system's
 * `Paths.document`, and `external` the app's external files directory.
 *
 * Only excludes: with no <include>, everything else is still backed up as
 * before, AsyncStorage's settings and saved verses included.
 */
const EXCLUDED = [
  // Downloaded Bible audio. It's kept in the files directory, which the phone
  // doesn't clear when space runs low, but it's up to gigabytes the app can
  // download again. Over Auto Backup's 25 MB limit, Android backs up nothing
  // of the app's, so the settings would stop being backed up too.
  { domain: 'file', path: 'bible-audio' },
  // Bible audio still downloading (#611): Android's DownloadManager writes
  // only to the app's external files, and the app moves each chapter into
  // bible-audio when it's done. `external` is that folder. Custom until #612.
  { domain: 'external', path: 'bible-audio-partial' },
  // The downloader's list of chapters under way (#611): on a new phone they
  // aren't, so it would only be dropped. Custom until #612.
  { domain: 'sharedpref', path: 'bible-audio-downloads.xml' },
  // The home screen widget's layout and week of verses (#235), which
  // expo-widgets keeps in shared preferences. The app gives the widget its
  // week again whenever it runs, so a restored copy would only be out of date.
  { domain: 'sharedpref', path: 'expo.modules.widgets.xml' },
  // The light or dark look each widget's button chose, by the widget's ID,
  // which another phone wouldn't share (modules/verse-widget).
  { domain: 'sharedpref', path: 'verse_widget_theme.xml' },
];

const ATTRIBUTES = {
  // Android 11 and lower.
  'android:fullBackupContent': '@xml/backup_rules',
  // Android 12 and later, for both the cloud backup and a transfer to a new phone.
  'android:dataExtractionRules': '@xml/data_extraction_rules',
};

const HEADER = '<?xml version="1.0" encoding="utf-8"?>\n<!-- Written by plugins/withAndroidBackupRules.js. -->\n';

const excludes = (indent) =>
  EXCLUDED.map(({ domain, path: excluded }) => `${indent}<exclude domain="${domain}" path="${excluded}"/>`).join('\n');

/** res/xml/backup_rules.xml, for android:fullBackupContent. */
function getFullBackupContent() {
  return `${HEADER}<full-backup-content>\n${excludes('  ')}\n</full-backup-content>\n`;
}

/** res/xml/data_extraction_rules.xml, for android:dataExtractionRules. */
function getDataExtractionRules() {
  return `${HEADER}<data-extraction-rules>
  <cloud-backup>
${excludes('    ')}
  </cloud-backup>
  <device-transfer>
${excludes('    ')}
  </device-transfer>
</data-extraction-rules>
`;
}

/** Points the manifest at the rules, unless another plugin already set different ones. */
function setBackupRules(manifest) {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  for (const [attribute, value] of Object.entries(ATTRIBUTES)) {
    const existing = application.$[attribute];
    if (existing && existing !== value) {
      throw new Error(
        `${attribute} is already ${existing}. Merge its rules into plugins/withAndroidBackupRules.js.`,
      );
    }
    application.$[attribute] = value;
  }
  return manifest;
}

function withAndroidBackupRules(config) {
  config = withAndroidManifest(config, (modConfig) => {
    modConfig.modResults = setBackupRules(modConfig.modResults);
    return modConfig;
  });
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const folder = path.join(modConfig.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(path.join(folder, 'backup_rules.xml'), getFullBackupContent());
      fs.writeFileSync(path.join(folder, 'data_extraction_rules.xml'), getDataExtractionRules());
      return modConfig;
    },
  ]);
}

module.exports = withAndroidBackupRules;
module.exports.EXCLUDED = EXCLUDED;
module.exports.getDataExtractionRules = getDataExtractionRules;
module.exports.getFullBackupContent = getFullBackupContent;
module.exports.setBackupRules = setBackupRules;
