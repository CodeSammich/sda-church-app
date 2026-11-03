import { requireOptionalNativeModule } from 'expo';

const VerseWidget = requireOptionalNativeModule<{ redraw(): Promise<void> }>('VerseWidget');

/**
 * Redraws the Android home screen widget (#235) through the app's own
 * receiver, which gives its colors a light and a dark version. Does nothing
 * where the module isn't built in: iOS, the web, and tests.
 */
export async function redrawVerseWidget(): Promise<void> {
  await VerseWidget?.redraw();
}
