/**
 * Unmodified provider assets downloaded from the providers' official brand
 * resource pages. Keep each asset clickable when it is rendered in the UI.
 */
export const EXTERNAL_BRAND_ASSETS = {
  youtubeIcon: {
    light: require('../public/brand/youtube-icon-red.png'),
    dark: require('../public/brand/youtube-icon-white.png'),
  },
  spotifyIcon: {
    light: require('../public/brand/spotify-icon-green.png'),
    dark: require('../public/brand/spotify-icon-white.png'),
  },
} as const;
