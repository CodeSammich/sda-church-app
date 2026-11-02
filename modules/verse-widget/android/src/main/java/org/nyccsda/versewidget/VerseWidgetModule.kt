package org.nyccsda.versewidget

import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Lets the app redraw its home screen widget through VerseWidgetReceiver (#235). */
class VerseWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VerseWidget")

    AsyncFunction("redraw") Coroutine { ->
      VerseWidgetReceiver.redraw(appContext.reactContext ?: throw Exceptions.ReactContextLost())
    }
  }
}
