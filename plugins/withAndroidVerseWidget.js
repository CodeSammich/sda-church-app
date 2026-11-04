const fs = require('node:fs');
const path = require('node:path');
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
// Only the Android half of expo-widgets' config plugin. The full plugin also
// adds an iOS widget extension and app group, which the iPhone app doesn't
// have; package.json keeps expo-widgets and @expo/ui out of the iOS build too.
const withAndroidWidgets =
  require('expo-widgets/plugin/build/android/withAndroidWidgets').default;
const {
  getProviderClassName,
  getWidgetDescriptionResourceName,
  getWidgetDisplayNameResourceName,
  getWidgetInfoResourceName,
} = require('expo-widgets/plugin/build/android/resourceNames');

const MARKER = 'NYCCSDA_VERSE_WIDGET';

/** The home screen widget, whose layout is in features/verse-of-the-day (#235). */
const VERSE_WIDGET = {
  name: 'VerseOfTheDay',
  displayName: 'Today’s Verse',
  description: 'The verse of the day. Tap it to read the chapter.',
  ios: null,
  android: {
    // Four cells by two, also on Android 11 and older.
    minWidth: 250,
    minHeight: 110,
    targetCellWidth: 4,
    targetCellHeight: 2,
    resizeMode: 'both',
    // Lets the widget draw before the app first runs.
    initialLayout: './features/verse-of-the-day/VerseOfTheDayWidget.tsx',
  },
};

/** The widget picker's labels in the phone's language. */
const LOCALIZED_LABELS = {
  'b+zh+Hant': {
    displayName: '今日經文',
    description: '每日一節經文，點一下即可閱讀整章。',
  },
  'b+zh+Hans': {
    displayName: '今日经文',
    description: '每日一节经文，点一下即可阅读整章。',
  },
  es: {
    displayName: 'Versículo de hoy',
    description: 'El versículo del día. Tócalo para leer el capítulo.',
  },
};

/**
 * How often Android redraws the widget, which then shows the day's verse
 * from the week the app gave it. expo-widgets sets 0 (never). An hour is
 * Android's guidance for not draining the battery, so the new verse appears
 * within an hour of 6 AM.
 */
const UPDATE_PERIOD_MILLIS = 60 * 60 * 1000;

const escapeAndroidString = (value) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');

/**
 * The widget's receiver. expo-widgets finds it as `<package>.VerseOfTheDayProvider`,
 * so it's written into the app's package, but its code is
 * VerseWidgetReceiver in modules/verse-widget: it opens the verse when the
 * widget is tapped, and gives the widget's colors their dark-mode versions.
 */
function createProviderKt(androidPackage) {
  return `package ${androidPackage}

import org.nyccsda.versewidget.VerseWidgetReceiver

// ${MARKER}: written by plugins/withAndroidVerseWidget.js.
class ${getProviderClassName(VERSE_WIDGET)} : VerseWidgetReceiver()
`;
}

/** Sets how often Android redraws the widget in its provider info XML. */
function setUpdatePeriod(xml) {
  const updatePeriod = /android:updatePeriodMillis="\d+"/;
  if (!updatePeriod.test(xml)) {
    throw new Error('Could not find updatePeriodMillis in the widget info written by expo-widgets');
  }
  return xml.replace(updatePeriod, `android:updatePeriodMillis="${UPDATE_PERIOD_MILLIS}"`);
}

function createLocalizedStringsXml({ displayName, description }) {
  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="${getWidgetDisplayNameResourceName(VERSE_WIDGET)}">${escapeAndroidString(displayName)}</string>
  <string name="${getWidgetDescriptionResourceName(VERSE_WIDGET)}">${escapeAndroidString(description)}</string>
</resources>
`;
}

/**
 * Keeps the widget's receiver to Android and the app itself. expo-widgets
 * exports it, but nothing outside the app needs to reach it: Android sends
 * the widget's updates itself, and the widget's buttons name the receiver
 * from the app, so it takes only the widget's own taps.
 */
function setReceiverNotExported(manifest) {
  const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  const name = `.${getProviderClassName(VERSE_WIDGET)}`;
  const receiver = (mainApplication.receiver ?? []).find((r) => r.$['android:name'] === name);
  if (!receiver) {
    throw new Error('Could not find the verse widget receiver written by expo-widgets');
  }
  receiver.$['android:exported'] = 'false';
  return manifest;
}

/** Edits the files expo-widgets writes for the widget. */
function writeVerseWidgetFiles(projectRoot, androidPackage) {
  const providerPath = path.join(
    projectRoot,
    'app/src/main/java',
    ...androidPackage.split('.'),
    `${getProviderClassName(VERSE_WIDGET)}.kt`,
  );
  const infoPath = path.join(
    projectRoot,
    'app/src/main/res/xml',
    `${getWidgetInfoResourceName(VERSE_WIDGET)}.xml`,
  );
  if (!fs.existsSync(providerPath) || !fs.existsSync(infoPath)) {
    throw new Error('expo-widgets did not write the verse widget files before withAndroidVerseWidget');
  }

  fs.writeFileSync(providerPath, createProviderKt(androidPackage));
  fs.writeFileSync(infoPath, setUpdatePeriod(fs.readFileSync(infoPath, 'utf8')));
  for (const [qualifier, labels] of Object.entries(LOCALIZED_LABELS)) {
    const valuesDirectory = path.join(projectRoot, `app/src/main/res/values-${qualifier}`);
    fs.mkdirSync(valuesDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(valuesDirectory, 'verse_widget_strings.xml'),
      createLocalizedStringsXml(labels),
    );
  }
}

/**
 * The Android home screen widget for the verse of the day (#235), built with
 * expo-widgets. iOS isn't touched.
 */
function withAndroidVerseWidget(config) {
  // Config plugins run their steps newest first, so adding these steps
  // before expo-widgets' own makes them run after, on what it writes.
  config = withAndroidManifest(config, (modConfig) => {
    modConfig.modResults = setReceiverNotExported(modConfig.modResults);
    return modConfig;
  });
  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      writeVerseWidgetFiles(
        modConfig.modRequest.platformProjectRoot,
        AndroidConfig.Package.getPackage(modConfig),
      );
      return modConfig;
    },
  ]);
  return withAndroidWidgets(config, { widgets: [VERSE_WIDGET] });
}

module.exports = withAndroidVerseWidget;
module.exports.VERSE_WIDGET = VERSE_WIDGET;
module.exports.UPDATE_PERIOD_MILLIS = UPDATE_PERIOD_MILLIS;
module.exports.createProviderKt = createProviderKt;
module.exports.setUpdatePeriod = setUpdatePeriod;
module.exports.setReceiverNotExported = setReceiverNotExported;
module.exports.createLocalizedStringsXml = createLocalizedStringsXml;
