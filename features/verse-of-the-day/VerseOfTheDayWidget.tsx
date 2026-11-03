import { createWidget } from 'expo-widgets';

import {
  VERSE_WIDGET_COLORS,
  VERSE_WIDGET_NAME,
  VerseOfTheDayWidgetLayout,
} from './VerseOfTheDayWidgetLayout';

/**
 * Registers the widget's layout for the Android build, which runs this file
 * so the widget has a layout, and the app's colors, before the app first runs
 * (plugins/withAndroidVerseWidget.js). The app doesn't import it: registering
 * the layout with only the colors would clear the week of verses the app
 * stored (services/VerseOfTheDayWidget.android.ts).
 */
export default createWidget(VERSE_WIDGET_NAME, VerseOfTheDayWidgetLayout, {
  colors: VERSE_WIDGET_COLORS,
});
