import { createContext } from 'react';
import { StatusBarStyle } from 'react-native';
import {
  configureFonts,
  MD3DarkTheme,
  MD3LightTheme,
  useTheme,
} from 'react-native-paper';

/**
 * Material Design 3 Theme definitions for both React Native Paper and React Navigation.
 * This ensures a cohesive "Digital Sanctuary" across the entire application.
 *
 * Ref: https://callstack.github.io/react-native-paper/docs/guides/theming
 */

export const THEME_STORAGE_KEY = 'user-theme';
export const THEME_DARK = 'dark';
export const THEME_LIGHT = 'light';

// AdventSans font is used for physical signage and branding
// but NotoSans is used for digital interfaces for better readability and multilingual support
// AdventSans also has special branded styles for certain words that can be problematic
// "SDA" becomes the Adventist logo inline, which can be difficult to render consistently
// https://www.nadadventist.org/about/brand-guidelines/color-typography/
const baseVariants = {
  displayLarge: { fontFamily: 'NotoSans-Bold' },
  displayMedium: { fontFamily: 'NotoSans-Bold' },
  displaySmall: { fontFamily: 'NotoSans-Bold' },
  headlineLarge: { fontFamily: 'NotoSans-Bold' },
  headlineMedium: { fontFamily: 'NotoSans-Bold' },
  headlineSmall: { fontFamily: 'NotoSans-Bold' },
  titleLarge: { fontFamily: 'NotoSans-Medium' },
  titleMedium: { fontFamily: 'NotoSans-Medium' },
  titleSmall: { fontFamily: 'NotoSans-Medium' },
  labelLarge: { fontFamily: 'NotoSans-Medium' },
  labelMedium: { fontFamily: 'NotoSans-Medium' },
  labelSmall: { fontFamily: 'NotoSans-Medium' },
  bodyLarge: { fontFamily: 'NotoSans-Regular' },
  bodyMedium: { fontFamily: 'NotoSans-Regular' },
  bodySmall: { fontFamily: 'NotoSans-Regular' },
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
    // Primary: Sanctuary Blue
    primary: '#3EA6FF', // Primary Interaction Color Accent
    onPrimary: '#F8F9FA', // Inverted Text (The Stencil)
    primaryContainer: '#E3F2FD', // Selection Container
    onPrimaryContainer: '#3EA6FF', // General Iconography
    // Card background colors for light mode
    cardBgColors: {
      // home page
      livestream:           '#FCE8E6', // Soft blush
      bulletin:             '#FFFBEB', // Warm cream
      tithe:                '#F0FDF4', // Faint mint
      discover:             '#F5F3FF', // Soft periwinkle / lavender
      prayer:               '#EBF5FF', // Sky blue
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
      prayer:               'rgba(2, 132, 199, 1.00)',  // Deep ocean blue
      events:               'rgba(217, 119, 6, 1.00)',  // Warm burnt amber / Terracotta
      // discover page
      aboutSDA:             'rgba(185,28,28,1.00)',     // Rich crimson
      aboutHistory:         'rgba(146,64,14,1.00)',     // Warm amber/brown
      meetTeam:             'rgba(4,120,87,1.00)',      // Deep forest/emerald green
      join:                 'rgba(2, 132, 199, 1.00)',  // Deep ocean blue
      fellowship:           'rgba(55,48,163,1.00)',     // Deep indigo/navy   
      bible:                'rgba(217, 119, 6, 1.00)',  // Warm burnt amber / Terracotta
    },
    // Secondary: Utility UI (Chips, Muted Actions)
    secondary: '#606060',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#F1F3F4',
    onSecondaryContainer: '#1A1A1A',

    // Tertiary: Identical to Primary in Light Mode for uniform UI color
    tertiary: '#3EA6FF',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#E3F2FD',
    onTertiaryContainer: '#3EA6FF',

    // Backgrounds & Surfaces
    background: '#F2E6DF', // The Canvas
    onBackground: '#1A1A1A', // The Ink: High-contrast text on Canvas
    surface: '#F7F7F7', // The Object: Cards/Containers
    onSurface: '#1A1A1A', // The Ink: High-contrast text on Surfaces

    // UI Variants & Boundaries
    surfaceVariant: '#F1F3F4', // Secondary UI / Top Search Bar BG
    onSurfaceVariant: '#606060', // Muted Intent: Top Search Bar Icon/Text
    outline: '#CAC4D0', // Boundary (Outline)
    outlineVariant: '#E0E0E0', // Boundary (Subtle) / Divider

    // Navigation Compatibility Layer
    card: '#FFFFFF', // The Object
    text: '#1A1A1A', // The Ink
    border: '#E0E0E0', // The Divider
    notification: '#3EA6FF', // Sanctuary Blue

    // Branding (Special External Brand Colors)
    brandYoutube: '#FF0000',
    brandSpotify: '#1DB954',
    brandZoom: '#0B5CFF',

    // Neutralizing Elevation (Hierarchy of Light - Light Mode)
    // This was not derived from the UI_UX.md spec, only recommended by Gemini
    elevation: {
      level0: 'transparent',
      level1: '#FFFFFF', // Pure White (Standard Surface)
      level2: '#F1F3F4', // Surface Variant (Subtle Lift)
      level3: '#E0E0E0', // Boundary Subtle (Noticeable Lift)
      level4: '#D1D1D1',
      level5: '#C0C0C0',
    },

    // Subtle Blur Effect for Glassmorphism Border for Search
    glassBorder: 'rgba(0,0,0,0.1)',
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
    // Primary: Active Focus
    primary: '#FFFFFF', // Primary Interaction Color Accent
    onPrimary: '#0F0F0F', // The Stencil / Inverted Text
    primaryContainer: '#2C2C2C', // Selection Container
    onPrimaryContainer: '#FFFFFF', // General Iconography
    // Card background colors for dark mode – use surface color for all cards
    cardBgColors: {
      // home page
      livestream:    '#1E1E1E', // surface
      bulletin:      '#1E1E1E',
      tithe:         '#1E1E1E',
      discover:      '#1E1E1E',
      prayer:        '#1E1E1E',
      events:        '#1E1E1E',
      // discover page
      aboutSDA:      '#1E1E1E', 
      aboutHistory:  '#1E1E1E', 
      meetTeam:      '#1E1E1E', 
      join:          '#1E1E1E', 
      fellowship:    '#1E1E1E', 
      bible:         '#1E1E1E', 
    },
    // Icon colors for dark mode – use onSurface for all icons
    iconColors: {
      // home page
      livestream:   '#F5F5F5', // onSurface
      bulletin:     '#F5F5F5',
      tithe:        '#F5F5F5',
      discover:     '#F5F5F5',
      prayer:       '#F5F5F5',
      events:       '#F5F5F5',
      // discover page
      aboutSDA:     '#F5F5F5', 
      aboutHistory: '#F5F5F5', 
      meetTeam:     '#F5F5F5', 
      join:         '#F5F5F5', 
      fellowship:   '#F5F5F5', 
      bible:        '#F5F5F5', 
    },
    // Secondary: Utility UI (Chips, Muted Actions)
    secondary: '#AAAAAA',
    onSecondary: '#0F0F0F',
    secondaryContainer: '#2C2C2C',
    onSecondaryContainer: '#F5F5F5',

    // Tertiary: Matches Primary (Active Focus) in Dark Mode
    tertiary: '#FFFFFF',
    onTertiary: '#0F0F0F', // Matches Background/Stencil
    tertiaryContainer: '#2C2C2C',
    onTertiaryContainer: '#FFFFFF',

    // Backgrounds & Surfaces
    background: '#0F0F0F', // The Canvas
    onBackground: '#F5F5F5', // The Ink: Soft White to mitigate Irradiation Illusion
    surface: '#1E1E1E', // The Object: Cards/Containers
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
    notification: '#FFFFFF', // Pure White
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
export const getAppTheme = (isDark: boolean): AppTheme =>
  isDark ? customDarkTheme : customLightTheme;

export const useAppTheme = () => useTheme<AppTheme>();
