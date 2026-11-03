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
import android.graphics.Paint
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.StaticLayout
import android.text.TextPaint
import androidx.compose.ui.unit.DpSize
import androidx.glance.BackgroundModifier
import androidx.glance.Emittable
import androidx.glance.EmittableImage
import androidx.glance.EmittableWithChildren
import androidx.glance.GlanceModifier
import androidx.glance.TintColorFilterParams
import androidx.glance.appwidget.AppWidgetId
import androidx.glance.appwidget.SizeMode
import androidx.glance.background
import androidx.glance.layout.EmittableColumn
import androidx.glance.layout.HeightModifier
import androidx.glance.layout.PaddingModifier
import androidx.glance.text.EmittableText
import androidx.glance.text.FontFamily
import androidx.glance.text.FontWeight
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import androidx.glance.unit.Dimension
import androidx.glance.unit.FixedColorProvider
import expo.modules.widgets.ExpoWidgetsAppWidgetProvider
import io.github.expo.peek.emittables.PeekEmittableAppWidget
import kotlin.math.max
import kotlin.math.min
import androidx.glance.color.ColorProvider as DayNightColorProvider

/** The widget's name, as features/verse-of-the-day/VerseOfTheDayWidgetLayout.tsx registers it. */
const val VERSE_WIDGET_NAME = "VerseOfTheDay"

private const val INTERACTION_ACTION = "expo.modules.widgets.ACTION_WIDGET_INTERACTION"
private const val TARGET_EXTRA = "expo.modules.widgets.extra.TARGET"
private const val LINK_PREFIX = "sdachurchapp:"
private const val SHARE_PREFIX = "share:"

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
 *   one when the widget is drawn, which is every hour.
 * - The verse: the layout's one text without a line limit. It's set in the
 *   phone's serif font and cut to the whole lines that fit, as YouVersion's
 *   widget does, so no line is cut through the middle.
 * - Taps: expo-widgets sends a tap on a button here, with the button's target.
 *   An app link opens in the app, and a new referenceRequest takes the reader
 *   to the verse even if the link is the same as last time (see
 *   BibleService.createScriptureReferenceRequest). A `share:` target opens the
 *   phone's share sheet with the rest of the target as the text.
 */
open class VerseWidgetReceiver : ExpoWidgetsAppWidgetProvider(VERSE_WIDGET_NAME) {
  override val glanceAppWidget: PeekEmittableAppWidget = DayNightWidget(super.glanceAppWidget)

  override fun onReceive(context: Context, intent: Intent) {
    val target = if (intent.action == INTERACTION_ACTION) intent.getStringExtra(TARGET_EXTRA) else null
    when {
      target == null -> super.onReceive(context, intent)
      target.startsWith(LINK_PREFIX) -> openLink(context, target)
      target.startsWith(SHARE_PREFIX) -> share(context, target.removePrefix(SHARE_PREFIX))
      else -> super.onReceive(context, intent)
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
    val day = expoWidget.provideRoot(context.inMode(Configuration.UI_MODE_NIGHT_NO), id, options, size)
    val night = expoWidget.provideRoot(context.inMode(Configuration.UI_MODE_NIGHT_YES), id, options, size)
    val root = if (day.sameShape(night)) {
      day.also { it.pairNightColors(night) }
    } else {
      expoWidget.provideRoot(context, id, options, size)
    }
    root.fitVerse(context, size)
    return root
  }
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
 * Sets the verse in serif and lets it fill the space its column leaves, cut
 * to the whole lines that fit. The space is the widget's size less the
 * padding around the verse and the height of everything else in its column.
 */
private fun Emittable.fitVerse(context: Context, size: DpSize) {
  val path = pathTo { it is EmittableText && it.maxLines == Int.MAX_VALUE } ?: return
  val verse = path.last() as EmittableText
  val column = path.getOrNull(path.size - 2) as? EmittableColumn ?: return
  val measure = TextMeasure(context)

  var width = size.width.value
  var height = size.height.value
  for (node in path.dropLast(1)) {
    val padding = node.paddingDp(context)
    width -= padding.horizontal
    height -= padding.vertical
  }
  for (child in column.children) {
    if (child !== verse) height -= child.heightDp(context, width, measure)
  }

  verse.style = (verse.style ?: TextStyle()).copy(fontFamily = FontFamily.Serif)
  verse.maxLines = max(1, measure.linesThatFit(verse, width, height))
  verse.modifier = verse.modifier.then(HeightModifier(Dimension.Expand))
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

/** Lays text out the way a widget's TextView does, to measure it. */
private class TextMeasure(context: Context) {
  private val density = context.resources.displayMetrics.density
  private val fontScale = context.resources.configuration.fontScale

  fun heightDp(text: EmittableText, widthDp: Float): Float {
    val layout = layout(text, widthDp)
    val lines = min(layout.lineCount, text.maxLines)
    return if (lines == 0) 0f else layout.getLineBottom(lines - 1) / density
  }

  fun linesThatFit(text: EmittableText, widthDp: Float, heightDp: Float): Int {
    val layout = layout(text, widthDp)
    var lines = 0
    while (lines < layout.lineCount && layout.getLineBottom(lines) <= heightDp * density) lines += 1
    return lines
  }

  private fun layout(text: EmittableText, widthDp: Float): StaticLayout {
    val style = text.style
    val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
      textSize = (style?.fontSize?.value ?: 14f) * fontScale * density
      typeface = Typeface.create(
        if (style?.fontFamily == FontFamily.Serif) Typeface.SERIF else Typeface.DEFAULT,
        if (style?.fontWeight == FontWeight.Bold) Typeface.BOLD else Typeface.NORMAL,
      )
    }
    val builder = StaticLayout.Builder
      .obtain(text.text, 0, text.text.length, paint, max(1, (widthDp * density).toInt()))
      .setIncludePad(true)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) builder.setUseLineSpacingFromFallbacks(true)
    return builder.build()
  }
}
