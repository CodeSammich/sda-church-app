const fs = require('node:fs');
const path = require('node:path');
const { AndroidConfig, withDangerousMod } = require('@expo/config-plugins');
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

/** The home screen widget that widgets/VerseOfTheDayWidget.tsx registers (#235). */
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
    initialLayout: './widgets/VerseOfTheDayWidget.tsx',
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
 * The widget's receiver. expo-widgets turns a tap on a button into a
 * broadcast to it with the button's target. The widget's one button covers
 * it and targets an app link, so the receiver opens that link. A new
 * referenceRequest takes the reader to the verse even if the link is the same
 * as last time (see BibleService.createScriptureReferenceRequest).
 */
function createProviderKt(androidPackage) {
  const className = getProviderClassName(VERSE_WIDGET);
  return `package ${androidPackage}

import android.content.Context
import android.content.Intent
import android.net.Uri
import expo.modules.widgets.ExpoWidgetsAppWidgetProvider

// ${MARKER}: written by plugins/withAndroidVerseWidget.js.
class ${className} : ExpoWidgetsAppWidgetProvider(${JSON.stringify(VERSE_WIDGET.name)}) {
  override fun onReceive(context: Context, intent: Intent) {
    val target = intent.getStringExtra(TARGET_EXTRA)
    if (intent.action == INTERACTION_ACTION && target != null && target.startsWith(LINK_PREFIX)) {
      val link = Uri.parse(target).buildUpon()
        .appendQueryParameter("referenceRequest", "widget-\${System.currentTimeMillis()}")
        .build()
      context.startActivity(
        Intent(Intent.ACTION_VIEW, link)
          .setPackage(context.packageName)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
      return
    }
    super.onReceive(context, intent)
  }

  private companion object {
    const val INTERACTION_ACTION = "expo.modules.widgets.ACTION_WIDGET_INTERACTION"
    const val TARGET_EXTRA = "expo.modules.widgets.extra.TARGET"
    const val LINK_PREFIX = "sdachurchapp:"
  }
}
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
  // Config plugins run their file steps newest first, so adding this step
  // before expo-widgets' own makes it run after, on the files it writes.
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
module.exports.createLocalizedStringsXml = createLocalizedStringsXml;
