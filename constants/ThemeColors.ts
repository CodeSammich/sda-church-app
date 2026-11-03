/**
 * The core colors of the app's light and dark themes, which
 * constants/Themes.ts builds the themes from. They're here, in a file with no
 * imports, so the Android home screen widget's build can read them too: it
 * runs features/verse-of-the-day/VerseOfTheDayWidget.tsx without the app's
 * libraries, so it can't load Themes.ts.
 */
export const LIGHT_THEME_COLORS = {
  primary: '#0369A1', // Accessible companion to the hymnal icon's brighter sky blue
  background: '#F2E6DF', // The Canvas
  onSurface: '#1A1A1A', // The Ink: High-contrast text on Surfaces
  onSurfaceVariant: '#606060', // Muted Intent: Top Search Bar Icon/Text
};

export const DARK_THEME_COLORS = {
  primary: '#D2B258',
  background: '#080808', // Render-matched near-black reader canvas
  onSurface: '#F3EDE1',
  onSurfaceVariant: '#BDB5A2',
};
