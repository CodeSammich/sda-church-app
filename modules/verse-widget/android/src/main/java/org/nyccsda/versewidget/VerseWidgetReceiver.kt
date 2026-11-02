// Glance marks its layout tree and color classes as library-internal;
// expo-widgets uses them the same way.
@file:SuppressLint("RestrictedApi")

package org.nyccsda.versewidget

import android.annotation.SuppressLint
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.DpSize
import androidx.glance.BackgroundModifier
import androidx.glance.Emittable
import androidx.glance.EmittableWithChildren
import androidx.glance.GlanceModifier
import androidx.glance.appwidget.AppWidgetId
import androidx.glance.appwidget.SizeMode
import androidx.glance.background
import androidx.glance.text.EmittableText
import androidx.glance.unit.ColorProvider
import androidx.glance.unit.FixedColorProvider
import expo.modules.widgets.ExpoWidgetsAppWidgetProvider
import io.github.expo.peek.emittables.PeekEmittableAppWidget
import androidx.glance.color.ColorProvider as DayNightColorProvider

/** The widget's name, as features/verse-of-the-day/VerseOfTheDayWidgetLayout.tsx registers it. */
const val VERSE_WIDGET_NAME = "VerseOfTheDay"

private const val INTERACTION_ACTION = "expo.modules.widgets.ACTION_WIDGET_INTERACTION"
private const val TARGET_EXTRA = "expo.modules.widgets.extra.TARGET"
private const val LINK_PREFIX = "sdachurchapp:"

/**
 * The dark-mode color for each light-mode color the widget's layout uses,
 * from constants/Themes.ts: the background, primary, ink, and muted ink.
 * test/verse-of-the-day-widget.test.ts checks they match the app's themes.
 */
private val NIGHT_COLORS = mapOf(
  0xFFF2E6DF.toInt() to 0xFF080808.toInt(),
  0xFF0369A1.toInt() to 0xFFD2B258.toInt(),
  0xFF1A1A1A.toInt() to 0xFFF3EDE1.toInt(),
  0xFF606060.toInt() to 0xFFBDB5A2.toInt(),
)

/**
 * The Android home screen widget's receiver (#235). The app's
 * `<package>.VerseOfTheDayProvider`, which plugins/withAndroidVerseWidget.js
 * writes, is this class, because expo-widgets finds a widget's receiver by
 * that name.
 *
 * - Colors: expo-widgets gives each color one value, and Android doesn't
 *   redraw a widget when the phone switches between light and dark mode. So
 *   before Android draws it, each of the layout's light-mode colors gets its
 *   dark-mode twin, and Android 12 and later switch between them on their own.
 *   Older versions pick one when the widget is drawn, which is every hour.
 * - Taps: expo-widgets sends a tap on a button here, with the button's target.
 *   The widget's one button covers it and targets an app link, so this opens
 *   the link in the app. A new referenceRequest takes the reader to the verse
 *   even if the link is the same as last time (see
 *   BibleService.createScriptureReferenceRequest).
 */
open class VerseWidgetReceiver : ExpoWidgetsAppWidgetProvider(VERSE_WIDGET_NAME) {
  override val glanceAppWidget: PeekEmittableAppWidget = DayNightWidget(super.glanceAppWidget)

  override fun onReceive(context: Context, intent: Intent) {
    val target = intent.getStringExtra(TARGET_EXTRA)
    if (intent.action == INTERACTION_ACTION && target != null && target.startsWith(LINK_PREFIX)) {
      val link = Uri.parse(target).buildUpon()
        .appendQueryParameter("referenceRequest", "widget-${System.currentTimeMillis()}")
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

  companion object {
    /**
     * Draws every copy of the widget on the home screen with the props
     * expo-widgets has stored. The app calls it through VerseWidgetModule,
     * because expo-widgets' own redraw would skip the dark-mode colors.
     */
    suspend fun redraw(context: Context) {
      val receiver = ComponentName(context.packageName, "${context.packageName}.${VERSE_WIDGET_NAME}Provider")
      val widget = VerseWidgetReceiver().glanceAppWidget
      AppWidgetManager.getInstance(context).getAppWidgetIds(receiver).forEach { id ->
        widget.refresh(context, AppWidgetId(id))
      }
    }
  }
}

/** expo-widgets' widget, with each light-mode color paired with its dark-mode twin. */
private class DayNightWidget(private val expoWidget: PeekEmittableAppWidget) : PeekEmittableAppWidget() {
  override val sizeMode: SizeMode = SizeMode.Exact

  override fun provideRoot(context: Context, id: AppWidgetId, options: Bundle, size: DpSize): Emittable =
    expoWidget.provideRoot(context, id, options, size).also { it.pairNightColors() }
}

private fun Emittable.pairNightColors() {
  modifier = modifier.pairNightBackground()
  if (this is EmittableText) {
    style = style?.let { it.copy(color = it.color.withNight()) }
  }
  if (this is EmittableWithChildren) {
    children.forEach { it.pairNightColors() }
  }
}

private fun GlanceModifier.pairNightBackground(): GlanceModifier =
  foldIn<GlanceModifier>(GlanceModifier) { result, element ->
    if (element is BackgroundModifier.Color) {
      result.background(element.colorProvider.withNight())
    } else {
      result.then(element)
    }
  }

private fun ColorProvider.withNight(): ColorProvider {
  val day = (this as? FixedColorProvider)?.color ?: return this
  val night = NIGHT_COLORS[day.toArgb()] ?: return this
  return DayNightColorProvider(day = day, night = Color(night))
}
