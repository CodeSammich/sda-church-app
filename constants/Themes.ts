import { createContext } from 'react';
import { StatusBarStyle } from 'react-native';
import {
  configureFonts,
  MD3DarkTheme,
  MD3LightTheme,
  useTheme,
} from 'react-native-paper';
import {
  DEFAULT_TEXT_SCALE,
  scaleTypographyRecord,
  type TextScale,
} from './AppPreferences';

/**
 * Material Design 3 Theme definitions for both React Native Paper and React Navigation.
 * This ensures a cohesive "Digital Sanctuary" across the entire application.
 *
 * Ref: https://callstack.github.io/react-native-paper/docs/guides/theming
 */

export const THEME_STORAGE_KEY = 'user-theme';
export const THEME_DARK = 'dark';
export const THEME_LIGHT = 'light';

/** Script-specific families registered by the root Expo font loader. */
export const SCRIPTURE_FONT_FAMILIES = {
  greek: 'Gentium-Regular',
  hebrew: 'EzraSIL-Regular',
} as const;

// AdventSans font is used for physical signage and branding
// but Plus Jakarta Sans is used for Latin-script digital interfaces
// AdventSans also has special branded styles for certain words that can be problematic
// "SDA" becomes the Adventist logo inline, which can be difficult to render consistently
// https://www.nadadventist.org/about/brand-guidelines/color-typography/
const baseVariants = {
  displayLarge: { fontFamily: 'PlusJakartaSans-Bold' },
  displayMedium: { fontFamily: 'PlusJakartaSans-Bold' },
  displaySmall: { fontFamily: 'PlusJakartaSans-Bold' },
  headlineLarge: { fontFamily: 'PlusJakartaSans-Bold' },
  headlineMedium: { fontFamily: 'PlusJakartaSans-Bold' },
  headlineSmall: { fontFamily: 'PlusJakartaSans-Bold' },
  titleLarge: { fontFamily: 'PlusJakartaSans-Medium' },
  titleMedium: { fontFamily: 'PlusJakartaSans-Medium' },
  titleSmall: { fontFamily: 'PlusJakartaSans-Medium' },
  labelLarge: { fontFamily: 'PlusJakartaSans-Medium' },
  labelMedium: { fontFamily: 'PlusJakartaSans-Medium' },
  labelSmall: { fontFamily: 'PlusJakartaSans-Medium' },
  bodyLarge: { fontFamily: 'PlusJakartaSans-Regular' },
  bodyMedium: { fontFamily: 'PlusJakartaSans-Regular' },
  bodySmall: { fontFamily: 'PlusJakartaSans-Regular' },
};

// Card background colors (light mode) moved into customLightTheme.colors
// Dark mode will use surface color from customDarkTheme.colors
// Icon colors (light mode) moved into customLightTheme.colors
// Dark mode icons will use onSurface from customDarkTheme.colors

export const customLightTheme = {
  ...MD3LightTheme,
  dark: false as boolean,
  version: 3,
  isV3: true,
  fonts: configureFonts({ config: baseVariants }),
  colors: {
    ...MD3LightTheme.colors,
    // Primary: Deep Ocean Blue
    primary: '#0369A1', // Accessible companion to the hymnal icon's brighter sky blue
    onPrimary: '#FFFFFF', // Crisp action text and iconography
    primaryContainer: '#E3F2FD', // Selection Container
    onPrimaryContainer: '#0369A1', // General Iconography
    // Card background colors for light mode
    cardBgColors: {
      // home page
      livestream:           '#FCE8E6', // Soft blush
      bulletin:             '#FFFBEB', // Warm cream
      tithe:                '#F0FDF4', // Faint mint
      discover:             '#F5F3FF', // Soft periwinkle / lavender
      hymnal:               '#EBF5FF', // Sky blue
      events:               '#FFF4E6', // Peach / warm amber tones
      // discover page
      aboutSDA:             '#FCE8E6', // Soft blush
      aboutHistory:         '#FFFBEB', // Warm cream
      meetTeam:             '#F0FDF4', // Faint mint
      join:                 '#EBF5FF', // Sky blue
      fellowship:           '#F5F3FF', // Soft periwinkle / lavender
      bible:                '#FFF4E6', // Peach / warm amber tones
    },
    // Icon colors for light mode
    iconColors: {
      // home page
      livestream:           'rgba(255, 0, 0, 1.00)',            // YouTube official red at full opacity since special brand
      bulletin:             'rgba(146,64,14,1.00)',     // Warm amber/brown
      tithe:                'rgba(4,120,87,1.00)',      // Deep forest/emerald green
      discover:             'rgba(55,48,163,1.00)',     // Deep indigo/navy
      hymnal:               'rgba(2, 132, 199, 1.00)',  // Deep ocean blue
      events:               'rgba(217, 119, 6, 1.00)',  // Warm burnt amber / Terracotta
      // discover page
      aboutSDA:             'rgba(185,28,28,1.00)',     // Rich crimson
      aboutHistory:         'rgba(146,64,14,1.00)',     // Warm amber/brown
      meetTeam:             'rgba(4,120,87,1.00)',      // Deep forest/emerald green
      join:                 'rgba(2, 132, 199, 1.00)',  // Deep ocean blue
      fellowship:           'rgba(55,48,163,1.00)',     // Deep indigo/navy   
      bible:                'rgba(217, 119, 6, 1.00)',  // Warm burnt amber / Terracotta
    },
    // Shared GridMenuCard chrome. Category backgrounds and icons remain above.
    gridMenuCard: {
      border: '#E0E0E0',
      decorativeIcon: 'rgba(40, 40, 40, 0.18)',
      arrowBackground: '#FFFFFF',
      arrowBorder: '#374151',
      arrowForeground: '#374151',
    },
    // Secondary: Utility UI (Chips, Muted Actions)
    secondary: '#606060',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#F1F3F4',
    onSecondaryContainer: '#1A1A1A',

    // Tertiary: Identical to Primary in Light Mode for uniform UI color
    tertiary: '#0369A1',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#E3F2FD',
    onTertiaryContainer: '#0369A1',

    // Backgrounds & Surfaces
    background: '#F2E6DF', // The Canvas
    onBackground: '#1A1A1A', // The Ink: High-contrast text on Canvas
    surface: '#FAF4EF', // The Object: Warm cards/containers
    bulletinSurface: '#FAF4EF', // Warm surface with clear separation from the canvas
    bulletinRemarkSurface: '#FFF1CC', // Restrained amber notice surface
    onBulletinRemarkSurface: '#6B3D00', // High-contrast warm notice text
    onSurface: '#1A1A1A', // The Ink: High-contrast text on Surfaces

    // UI Variants & Boundaries
    surfaceVariant: '#F1F3F4', // Secondary UI / Top Search Bar BG
    onSurfaceVariant: '#606060', // Muted Intent: Top Search Bar Icon/Text
    outline: '#CAC4D0', // Boundary (Outline)
    outlineVariant: '#E0E0E0', // Boundary (Subtle) / Divider

    // Navigation Compatibility Layer
    card: '#FAF4EF', // The Object
    text: '#1A1A1A', // The Ink
    border: '#E0E0E0', // The Divider
    notification: '#0369A1', // Deep Ocean Blue
    readerColors: {
      footnoteIndicator: '#0284C7', // Bright, accessible underline on warm surfaces
    },

    // Branding (Special External Brand Colors)
    brandYoutube: '#FF0000',
    brandSpotify: '#1DB954',
    brandZoom: '#0B5CFF',

    // Neutralizing Elevation (Hierarchy of Light - Light Mode)
    // This was not derived from the UI_UX.md spec, only recommended by Gemini
    elevation: {
      level0: 'transparent',
      level1: '#FAF4EF', // Warm Standard Surface
      level2: '#F1F3F4', // Surface Variant (Subtle Lift)
      level3: '#E0E0E0', // Boundary Subtle (Noticeable Lift)
      level4: '#D1D1D1',
      level5: '#C0C0C0',
    },

    // Subtle Blur Effect for Glassmorphism Border for Search
    glassBorder: 'rgba(0,0,0,0.1)',
    // Persistent highlight for saved Bible verses
    verseHighlight: '#FFF0A6',
  },
  gradients: {
    heroOverlay: ['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.75)'] as [
      string,
      string,
      ...string[],
    ],
  },
  blurTint: 'light' as 'light' | 'dark',
  statusBarScheme: 'dark-content' as StatusBarStyle,
  roundness: 3,
};

export type AppTheme = typeof customLightTheme;

export const customDarkTheme: AppTheme = {
  ...MD3DarkTheme,
  dark: true,
  version: 3,
  isV3: true,
  fonts: configureFonts({ config: baseVariants }),
  colors: {
    ...MD3DarkTheme.colors,
    // Primary: Soft Active Focus
    primary: '#E2E8F0', // Cool off-white reduces glare on dark surfaces
    onPrimary: '#0F172A', // Deep slate keeps action content highly legible
    primaryContainer: '#2C2C2C', // Selection Container
    onPrimaryContainer: '#E2E8F0', // General Iconography
    // Chromatic dark card surfaces preserve Home and Discover category identity
    // without introducing bright, high-glare blocks.
    cardBgColors: {
      // home page
      livestream:    '#321C1C',
      bulletin:      '#302719',
      tithe:         '#173028',
      discover:      '#25233B',
      hymnal:        '#172B36',
      events:        '#332719',
      // discover page
      aboutSDA:      '#321C1C',
      aboutHistory:  '#302719',
      meetTeam:      '#173028',
      join:          '#172B36',
      fellowship:    '#25233B',
      bible:         '#332719',
    },
    // Soft category colors reduce the glare of large white icons.
    iconColors: {
      // home page
      livestream:   '#FF8A80',
      bulletin:     '#F3C677',
      tithe:        '#6FD3A7',
      discover:     '#AFA8FF',
      hymnal:       '#67C7F0',
      events:       '#F4B860',
      // discover page
      aboutSDA:     '#FF8A80',
      aboutHistory: '#F3C677',
      meetTeam:     '#6FD3A7',
      join:         '#67C7F0',
      fellowship:   '#AFA8FF',
      bible:        '#F4B860',
    },
    // Low-glare equivalents of the GridMenuCard chrome used in light mode.
    gridMenuCard: {
      border: '#3F3F3F',
      decorativeIcon: 'rgba(255, 255, 255, 0.18)',
      arrowBackground: '#2C2C2C',
      arrowBorder: '#938F99',
      arrowForeground: '#AAAAAA',
    },
    // Secondary: Utility UI (Chips, Muted Actions)
    secondary: '#AAAAAA',
    onSecondary: '#0F0F0F',
    secondaryContainer: '#2C2C2C',
    onSecondaryContainer: '#F5F5F5',

    // Tertiary: Matches Primary (Active Focus) in Dark Mode
    tertiary: '#E2E8F0',
    onTertiary: '#0F172A', // Matches softened primary action content
    tertiaryContainer: '#2C2C2C',
    onTertiaryContainer: '#E2E8F0',

    // Backgrounds & Surfaces
    background: '#0F0F0F', // The Canvas
    onBackground: '#F5F5F5', // The Ink: Soft White to mitigate Irradiation Illusion
    surface: '#1E1E1E', // The Object: Cards/Containers
    bulletinSurface: '#1E1E1E', // Preserve the established charcoal card surface
    bulletinRemarkSurface: '#332A18', // Low-glare amber notice surface
    onBulletinRemarkSurface: '#F6D88A', // Warm notice text
    onSurface: '#F5F5F5', // The Ink: Soft White to prevent Halation

    // UI Variants & Boundaries
    surfaceVariant: '#2C2C2C', // Secondary UI
    onSurfaceVariant: '#AAAAAA', // Muted Intent: Top Search Bar Icon/Text
    outline: '#938F99', // Boundary (Outline)
    outlineVariant: '#3F3F3F', // Boundary (Subtle) / Divider

    // Navigation Compatibility Layer
    card: '#1E1E1E', // The Object
    text: '#F5F5F5', // The Ink
    border: '#3F3F3F', // The Divider
    notification: '#E2E8F0', // Soft active focus
    readerColors: {
      footnoteIndicator: '#3EA6FF', // Original sanctuary blue for dark-reader visibility
    },
    // Preserve existing surface, onSurface, etc.
    // surface and onSurface are already defined above, so no duplicates here

    // Branding (Standardized Monochrome in Dark Mode)
    brandYoutube: '#FFFFFF',
    brandSpotify: '#FFFFFF',
    brandZoom: '#FFFFFF',

    // Neutralizing Elevation (Hierarchy of Light)
    // This was not derived from the UI_UX.md spec, only recommended by Gemini
    elevation: {
      level0: 'transparent',
      level1: '#1E1E1E',
      level2: '#242424',
      level3: '#2C2C2C',
      level4: '#333333',
      level5: '#383838',
    },

    // Subtle Blur Effect for Glassmorphism Border for Search
    glassBorder: 'rgba(255, 255, 255, 0.1)',
    // Persistent highlight for saved Bible verses
    verseHighlight: '#5A4B16',
  },
  gradients: {
    heroOverlay: ['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.75)'] as [
      string,
      string,
      ...string[],
    ],
  },
  blurTint: 'dark' as 'light' | 'dark',
  statusBarScheme: 'light-content' as StatusBarStyle,
  roundness: 3,
};

/**
 * Context for managing the global theme state.
 * Moving this here centralizes all theme-related logic (Tenet 5).
 */
export const ThemeContext = createContext({
  toggleTheme: (val?: any) => {},
});

/**
 * Centralized helper to retrieve the correct theme object based on state.
 */
export const getAppTheme = (
  isDark: boolean,
  useSystemFonts = false,
  textScale: TextScale = DEFAULT_TEXT_SCALE,
): AppTheme => {
  const theme = isDark ? customDarkTheme : customLightTheme;

  // Plus Jakarta Sans is a Latin font and does not contain Han glyphs. React
  // Native on iOS does not reliably fall back
  // from a named custom font, so Chinese uses the platform's CJK-capable font.
  const selectedFonts = useSystemFonts
    ? isDark
      ? MD3DarkTheme.fonts
      : MD3LightTheme.fonts
    : theme.fonts;

  if (!useSystemFonts && textScale === DEFAULT_TEXT_SCALE) {
    return theme;
  }

  return {
    ...theme,
    fonts:
      textScale === DEFAULT_TEXT_SCALE
        ? selectedFonts
        : scaleTypographyRecord(selectedFonts, textScale),
  } as AppTheme;
};

export const useAppTheme = () => useTheme<AppTheme>();
