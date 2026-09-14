/**
 * Unmodified provider assets downloaded from the providers' official brand
 * resource pages. Keep each asset clickable when it is rendered in the UI.
 */
export const EXTERNAL_BRAND_ASSETS = {
  youtubeIcon: {
    light: require('../assets/images/brand/youtube-icon-red.png'),
    // The official red mark has better visual weight on our dark card than the
    // white export, while retaining the provider-supplied artwork unchanged.
    dark: require('../assets/images/brand/youtube-icon-red.png'),
  },
  spotifyIcon: {
    light: require('../assets/images/brand/spotify-icon-green.png'),
    // Keep Spotify's official green mark visible in both themes.
    dark: require('../assets/images/brand/spotify-icon-green.png'),
  },
} as const;

/**
 * YouTube's official PNG includes a large transparent canvas around the mark.
 * Render that source at a larger pixel size and clip only the transparent
 * margins so it has the same visual weight as the other provider icons.
 */
export const EXTERNAL_BRAND_ICON_CONTENT_SCALE = {
  youtube: 1.5,
  spotify: 1,
} as const;
