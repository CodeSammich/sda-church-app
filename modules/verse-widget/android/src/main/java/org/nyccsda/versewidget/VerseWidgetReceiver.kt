// Glance marks its layout tree and color classes as library-internal;
// expo-widgets uses them the same way.
@file:SuppressLint("RestrictedApi")

package org.nyccsda.versewidget

import android.annotation.SuppressLint
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.res.Configuration
import android.content.res.Resources
import android.graphics.Paint
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.Layout
import android.text.SpannableString
import android.text.StaticLayout
import android.text.TextPaint
import android.text.style.StyleSpan
import android.text.style.TypefaceSpan
import android.util.Log
import android.util.TypedValue
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.glance.BackgroundModifier
import androidx.glance.Emittable
import androidx.glance.EmittableImage
import androidx.glance.EmittableWithChildren
import androidx.glance.GlanceModifier
import androidx.glance.TintColorFilterParams
import androidx.glance.action.Action
import androidx.glance.action.ActionModifier
import androidx.glance.appwidget.AppWidgetId
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.SendBroadcastIntentAction
import androidx.glance.background
import androidx.glance.layout.EmittableColumn
import androidx.glance.layout.HeightModifier
import androidx.glance.layout.PaddingModifier
import androidx.glance.layout.padding
import androidx.glance.text.EmittableText
import androidx.glance.text.FontFamily
import androidx.glance.text.FontWeight
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import androidx.glance.unit.Dimension
import androidx.glance.unit.FixedColorProvider
import expo.modules.widgets.ExpoWidgetsAppWidgetProvider
import io.github.expo.peek.emittables.PeekEmittableAppWidget
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlin.math.max
import kotlin.math.min
import androidx.glance.color.ColorProvider as DayNightColorProvider

/** The widget's name, as features/verse-of-the-day/VerseOfTheDayWidgetLayout.tsx registers it. */
const val VERSE_WIDGET_NAME = "VerseOfTheDay"

private const val INTERACTION_ACTION = "expo.modules.widgets.ACTION_WIDGET_INTERACTION"
private const val TARGET_EXTRA = "expo.modules.widgets.extra.TARGET"
private const val LINK_PREFIX = "sdachurchapp:"
private const val SHARE_PREFIX = "share:"
private const val THEME_TARGET = "theme:"
// Line fitting is logged after `adb shell setprop log.tag.VerseWidget DEBUG`.
private const val LOG_TAG = "VerseWidget"

/** How far apart the verse's lines are, as a multiple of its type size, as in YouVersion's widget. */
private const val VERSE_LINE_SPACING = 1.5f
/** Room left at the end of each of the verse's lines. */
private const val LINE_SLACK_DP = 4f
/** Wide enough for any one line. */
private const val ONE_LINE_DP = 10_000f
/** The most children Glance draws in a column. */
private const val MAX_CHILDREN = 10

/**
 * The Android home screen widget's receiver (#235). The app's
 * `<package>.VerseOfTheDayProvider`, which plugins/withAndroidVerseWidget.js
 * writes, is this class, because expo-widgets finds a widget's receiver by
 * that name.
 *
 * - Colors: the layout takes its colors from the app's themes, in the phone's
 *   current mode, and Android doesn't redraw a widget when the phone switches
 *   between light and dark mode. So the layout is drawn in both modes, and each
 *   light-mode color is paired with the dark-mode color in the same place.
 *   Android 12 and later switch between them on their own. Older versions pick
 *   one when the widget is drawn, which is every hour. A widget whose button
 *   chose a look is drawn in that mode only.
 * - The verse: the layout's one text without a line limit. It's set in the
 *   phone's serif font and cut to the whole lines that fit, as YouVersion's
 *   widget does, so no line is cut through the middle.
 * - Taps: expo-widgets sends a tap on a button here, with the button's target.
 *   An app link opens in the app, and a new referenceRequest takes the reader
 *   to the verse even if the link is the same as last time (see
 *   BibleService.createScriptureReferenceRequest). A `share:` target opens the
 *   phone's share sheet with the rest of the target as the text, and `theme:`
 *   flips this widget between light and dark (WidgetLooks).
 */
open class VerseWidgetReceiver : ExpoWidgetsAppWidgetProvider(VERSE_WIDGET_NAME) {
  override val glanceAppWidget: PeekEmittableAppWidget = DayNightWidget(super.glanceAppWidget)

  override fun onReceive(context: Context, intent: Intent) {
    val target = if (intent.action == INTERACTION_ACTION) intent.getStringExtra(TARGET_EXTRA) else null
    when {
      target == null -> super.onReceive(context, intent)
      target.startsWith(LINK_PREFIX) -> openLink(context, target)
      target.startsWith(SHARE_PREFIX) -> share(context, target.removePrefix(SHARE_PREFIX))
      target == THEME_TARGET -> flipLook(context, intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, 0))
      else -> super.onReceive(context, intent)
    }
  }

  override fun onDeleted(context: Context, appWidgetIds: IntArray) {
    WidgetLooks.forget(context, appWidgetIds)
    super.onDeleted(context, appWidgetIds)
  }

  /** Flips the tapped widget between light and dark, and redraws only it. */
  private fun flipLook(context: Context, id: Int) {
    if (id == AppWidgetManager.INVALID_APPWIDGET_ID) return
    WidgetLooks.flip(context, id)
    val result = goAsync()
    CoroutineScope(Dispatchers.Default).launch {
      try {
        glanceAppWidget.refresh(context, AppWidgetId(id))
      } finally {
        result.finish()
      }
    }
  }

  private fun openLink(context: Context, target: String) {
    val link = Uri.parse(target).buildUpon()
      .appendQueryParameter("referenceRequest", "widget-${System.currentTimeMillis()}")
      .build()
    context.startActivity(
      Intent(Intent.ACTION_VIEW, link)
        .setPackage(context.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    )
  }

  private fun share(context: Context, text: String) {
    val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
    context.startActivity(Intent.createChooser(send, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }

  companion object {
    /**
     * Draws every copy of the widget on the home screen with the props
     * expo-widgets has stored. The app calls it through VerseWidgetModule,
     * because expo-widgets' own redraw would skip this receiver.
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

/** expo-widgets' widget, drawn in both modes, with the verse in serif cut to whole lines. */
private class DayNightWidget(private val expoWidget: PeekEmittableAppWidget) : PeekEmittableAppWidget() {
  override val sizeMode: SizeMode = SizeMode.Exact

  override fun provideRoot(context: Context, id: AppWidgetId, options: Bundle, size: DpSize): Emittable {
    val root = when (WidgetLooks.isDark(context, id.appWidgetId)) {
      // The look this widget's button chose, whatever the phone's mode.
      false -> expoWidget.provideRoot(context.inMode(Configuration.UI_MODE_NIGHT_NO), id, options, size)
      true -> expoWidget.provideRoot(context.inMode(Configuration.UI_MODE_NIGHT_YES), id, options, size)
      null -> {
        val day = expoWidget.provideRoot(context.inMode(Configuration.UI_MODE_NIGHT_NO), id, options, size)
        val night = expoWidget.provideRoot(context.inMode(Configuration.UI_MODE_NIGHT_YES), id, options, size)
        if (day.sameShape(night)) {
          day.also { it.pairNightColors(night) }
        } else {
          expoWidget.provideRoot(context, id, options, size)
        }
      }
    }
    root.tagLookButton(id.appWidgetId)
    root.fitVerse(context, size)
    return root
  }
}

/**
 * The look each widget's light/dark button chose, by widget: light, dark, or
 * none, which follows the phone. Each tap flips the colors the widget shows.
 * When the new look matches the phone's mode, the widget goes back to
 * following the phone, so a second tap always undoes the first.
 */
private object WidgetLooks {
  private const val FILE = "verse_widget_theme"

  /** Whether the widget's button chose dark, light, or neither (null). */
  fun isDark(context: Context, id: Int): Boolean? {
    val prefs = prefs(context)
    return if (prefs.contains(key(id))) prefs.getBoolean(key(id), false) else null
  }

  fun flip(context: Context, id: Int) {
    val phoneDark = phoneIsDark()
    val nextDark = !(isDark(context, id) ?: phoneDark)
    prefs(context).edit().apply {
      if (nextDark == phoneDark) remove(key(id)) else putBoolean(key(id), nextDark)
    }.apply()
  }

  fun forget(context: Context, ids: IntArray) {
    prefs(context).edit().apply { ids.forEach { remove(key(it)) } }.apply()
  }

  private fun prefs(context: Context) = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

  private fun key(id: Int) = "dark_$id"

  // The phone's own mode, whatever the app's theme setting.
  private fun phoneIsDark() =
    Resources.getSystem().configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
}

/**
 * expo-widgets' tap on the light/dark button carries only its target, so the
 * receiver adds which widget it's on.
 */
private fun Emittable.tagLookButton(id: Int) {
  val action = modifier.foldIn<Action?>(null) { found, element -> (element as? ActionModifier)?.action ?: found }
  val intent = (action as? SendBroadcastIntentAction)?.intent
  if (intent?.getStringExtra(TARGET_EXTRA) == THEME_TARGET) intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
  if (this is EmittableWithChildren) children.forEach { it.tagLookButton(id) }
}

/**
 * The app in light or dark mode. expo-widgets reads the mode from the
 * application context, so this context is its own application context.
 */
private fun Context.inMode(nightMode: Int): Context {
  val configuration = Configuration(resources.configuration)
  configuration.uiMode = (configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or nightMode
  val modeContext = applicationContext.createConfigurationContext(configuration)
  return object : ContextWrapper(modeContext) {
    override fun getApplicationContext(): Context = this
  }
}

private fun Emittable.sameShape(other: Emittable): Boolean {
  if (this::class != other::class) return false
  if (this !is EmittableWithChildren) return true
  val otherChildren = (other as EmittableWithChildren).children
  return children.size == otherChildren.size && children.zip(otherChildren).all { (a, b) -> a.sameShape(b) }
}

private fun Emittable.pairNightColors(night: Emittable) {
  modifier = modifier.pairNightBackgrounds(night.modifier)
  if (this is EmittableText && night is EmittableText) {
    val nightColor = night.style?.color
    style = style?.let { if (nightColor != null) it.copy(color = it.color.withNight(nightColor)) else it }
  }
  if (this is EmittableImage && night is EmittableImage) {
    val dayTint = colorFilterParams as? TintColorFilterParams
    val nightTint = night.colorFilterParams as? TintColorFilterParams
    if (dayTint != null && nightTint != null) {
      colorFilterParams = TintColorFilterParams(dayTint.colorProvider.withNight(nightTint.colorProvider))
    }
  }
  if (this is EmittableWithChildren && night is EmittableWithChildren) {
    children.zip(night.children).forEach { (dayChild, nightChild) -> dayChild.pairNightColors(nightChild) }
  }
}

private fun GlanceModifier.pairNightBackgrounds(night: GlanceModifier): GlanceModifier {
  val nightColors = night.foldIn(mutableListOf<ColorProvider>()) { colors, element ->
    colors.also { if (element is BackgroundModifier.Color) it += element.colorProvider }
  }.iterator()
  return foldIn<GlanceModifier>(GlanceModifier) { result, element ->
    if (element is BackgroundModifier.Color && nightColors.hasNext()) {
      result.background(element.colorProvider.withNight(nightColors.next()))
    } else {
      result.then(element)
    }
  }
}

private fun ColorProvider.withNight(night: ColorProvider): ColorProvider {
  val dayColor = (this as? FixedColorProvider)?.color ?: return this
  val nightColor = (night as? FixedColorProvider)?.color ?: return this
  return DayNightColorProvider(day = dayColor, night = nightColor)
}

/**
 * Lays the verse out in the space its column leaves, as YouVersion's widget
 * does: in the phone's serif font, with relaxed line spacing, and only the
 * whole lines that fit. A widget's text can't set its line spacing, so each
 * line becomes a one-line text with padding below it. A verse that runs on
 * stops at the end of the last line that fits, a whole word, with no "…";
 * a tap opens the whole verse.
 *
 * The space is the widget's size less the padding around the verse and the
 * height of everything else in its column. On a widget too small for a line
 * of the verse, what's below the verse (the translation) gives way first, and
 * then the verse itself.
 */
private fun Emittable.fitVerse(context: Context, size: DpSize) {
  val path = pathTo { it is EmittableText && it.maxLines == Int.MAX_VALUE } ?: return
  val verse = path.last() as EmittableText
  val column = path.getOrNull(path.size - 2) as? EmittableColumn ?: return
  val measure = TextMeasure(context)
  val style = (verse.style ?: TextStyle()).copy(fontFamily = FontFamily.Serif)

  var width = size.width.value
  var height = size.height.value
  for (node in path.dropLast(1)) {
    val padding = node.paddingDp(context)
    width -= padding.horizontal
    height -= padding.vertical
  }
  fun space() = height - column.children.filter { it !== verse }
    .sumOf { it.heightDp(context, width, measure).toDouble() }.toFloat()

  // Each line leaves a little room at its end, so Android never wraps it again.
  val lines = measure.lines(verse.text, style, width - LINE_SLACK_DP)
  val pitch = max(lines.maxOf { it.heightDp }, measure.textSizeDp(style) * VERSE_LINE_SPACING)
  fun fitting(space: Float) = lines.indices.takeWhile { i -> i * pitch + lines[i].heightDp <= space }.size

  var count = fitting(space())
  val index = column.children.indexOf(verse)
  if (count == 0) {
    while (column.children.size > index + 1) column.children.removeAt(column.children.size - 1)
    count = fitting(space())
  }
  if (Log.isLoggable(LOG_TAG, Log.DEBUG)) {
    Log.d(LOG_TAG, "size=${size.width.value}x${size.height.value}dp space=${width}x${space()}dp pitch=${pitch}dp lines=$count/${lines.size}")
  }
  if (count == 0) {
    column.children.removeAt(index)
    return
  }

  val shown = (0 until count).map { i ->
    EmittableText().also {
      it.text = lines[i].text
      it.style = style
      it.maxLines = 1
      if (i < count - 1) it.modifier = GlanceModifier.padding(bottom = (pitch - lines[i].heightDp).dp)
    }
  }
  column.children[index] = shown.inColumns().also {
    // Fills the space, keeping what follows the verse at the bottom.
    it.modifier = GlanceModifier.then(HeightModifier(Dimension.Expand))
  }
}

/** Glance draws at most 10 children of a column, so a longer list goes in nested columns. */
private fun List<Emittable>.inColumns(): EmittableColumn {
  var items: List<Emittable> = this
  while (items.size > MAX_CHILDREN) {
    items = items.chunked(MAX_CHILDREN).map { chunk -> EmittableColumn().also { it.children += chunk } }
  }
  return EmittableColumn().also { it.children += items }
}

private fun Emittable.pathTo(match: (Emittable) -> Boolean): List<Emittable>? {
  if (match(this)) return listOf(this)
  if (this !is EmittableWithChildren) return null
  for (child in children) {
    child.pathTo(match)?.let { return listOf(this) + it }
  }
  return null
}

private class Padding(val horizontal: Float, val vertical: Float)

private fun Emittable.paddingDp(context: Context): Padding {
  val padding = modifier.foldIn<PaddingModifier?>(null) { total, element ->
    if (element is PaddingModifier) total?.plus(element) ?: element else total
  }?.toDp(context.resources) ?: return Padding(0f, 0f)
  return Padding(
    horizontal = padding.left.value + padding.start.value + padding.right.value + padding.end.value,
    vertical = padding.top.value + padding.bottom.value,
  )
}

/** About how tall this part of the widget is, in dp: what Android's layout gives it. */
private fun Emittable.heightDp(context: Context, width: Float, measure: TextMeasure): Float {
  val fixed = modifier.foldIn<Float?>(null) { height, element ->
    ((element as? HeightModifier)?.height as? Dimension.Dp)?.dp?.value ?: height
  }
  if (fixed != null) return fixed
  val padding = paddingDp(context)
  val innerWidth = width - padding.horizontal
  val content = when (this) {
    is EmittableText -> measure.heightDp(this, innerWidth)
    is EmittableColumn -> children.sumOf { it.heightDp(context, innerWidth, measure).toDouble() }.toFloat()
    is EmittableWithChildren -> children.maxOfOrNull { it.heightDp(context, innerWidth, measure) } ?: 0f
    else -> 0f
  }
  return content + padding.vertical
}

/** A line of the verse: its text, where it starts in the verse, and its height. */
private class Line(val text: String, val start: Int, val heightDp: Float)

/**
 * Lays text out the way a widget's TextView does, to measure it: Glance sets
 * the text's size on the TextView and its font and weight as spans, so the
 * line height comes from the phone's default font, or a taller fallback.
 */
private class TextMeasure(context: Context) {
  private val metrics = context.resources.displayMetrics
  private val density = metrics.density

  fun heightDp(text: EmittableText, widthDp: Float): Float {
    val layout = layout(text.text, text.style, widthDp)
    val lines = min(layout.lineCount, text.maxLines)
    return if (lines == 0) 0f else layout.getLineBottom(lines - 1) / density
  }

  fun textSizeDp(style: TextStyle?): Float = textSizePx(style) / density

  /** The lines the text breaks into at this width, each measured as a one-line text. */
  fun lines(text: String, style: TextStyle, widthDp: Float): List<Line> {
    val layout = layout(text, style, widthDp)
    return (0 until layout.lineCount).map { i ->
      val line = text.substring(layout.getLineStart(i), layout.getLineEnd(i)).trimEnd()
      Line(line, layout.getLineStart(i), layout(line, style, ONE_LINE_DP).getLineBottom(0) / density)
    }
  }

  // As Android sizes text in sp, including its gentler scaling of large text (Android 14).
  private fun textSizePx(style: TextStyle?): Float =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, style?.fontSize?.value ?: 14f, metrics)

  private fun layout(text: String, style: TextStyle?, widthDp: Float): StaticLayout {
    val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { textSize = textSizePx(style) }
    val spanned = SpannableString(text).apply {
      if (style?.fontFamily == FontFamily.Serif) setSpan(TypefaceSpan("serif"), 0, length, 0)
      if (style?.fontWeight == FontWeight.Bold) setSpan(StyleSpan(Typeface.BOLD), 0, length, 0)
    }
    val builder = StaticLayout.Builder
      .obtain(spanned, 0, spanned.length, paint, max(1, (widthDp * density).toInt()))
      .setIncludePad(true)
      .setBreakStrategy(Layout.BREAK_STRATEGY_HIGH_QUALITY)
      .setHyphenationFrequency(
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          Layout.HYPHENATION_FREQUENCY_NONE
        } else {
          Layout.HYPHENATION_FREQUENCY_NORMAL
        }
      )
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) builder.setUseLineSpacingFromFallbacks(true)
    return builder.build()
  }
}
