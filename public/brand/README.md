# External brand assets

These files are unmodified provider assets used inside clickable controls that open
the corresponding fixed external service link.

- `youtube-icon-red.png` was extracted from YouTube's official `youtube-icon.zip`:
  <https://www.gstatic.com/marketing-cms/89/d9/cf95c4f345709f4998dc581221b0/youtube-icon.zip>
- `youtube-icon-white.png` was extracted from the white digital icon in that same
  official YouTube icon pack.
- `spotify-icon-green.png` was extracted from Spotify's official logo/icon pack:
  <https://developer.spotify.com/images/guidelines/design/2024-spotify-logo-icon.zip>
- `spotify-icon-white.png` was extracted from the white icon in that same official
  Spotify icon pack.

Downloaded September 12, 2026. Do not recolor, distort, crop, or use these assets
in the app icon, app name, store listing graphics, or unrelated marketing. Review
the current provider brand guidelines before changing their use. The app uses the
high-resolution PNG exports because the project does not currently include a native
SVG renderer; they are contain-fit at UI sizes so they remain sharp without tinting.
The renderer selects the colored variant in light mode and the official white
variant in dark mode.

The app intentionally does not bundle a Zoom logo. The Zoom link uses a generic
video icon because the current Zoom terms grant logo rights in narrower partner
and SDK contexts.
