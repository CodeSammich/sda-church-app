import type { AppTheme } from '@/constants/Themes';

/** Keeps every Paper dialog/modal flush with the app canvas in both themes. */
export const getPopupSurfaceStyle = (theme: AppTheme) => ({
  backgroundColor: theme.colors.background,
});
