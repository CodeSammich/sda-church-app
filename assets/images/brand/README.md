# External brand assets

`nad-symbol.svg` is the church symbol, and the rest are external services' marks.

## The church symbol

`nad-symbol.svg` is `symbol/symbol_square-RGB.svg` from the NAD's symbol pack
(<https://assets.adventistconnect.org/nadadven/2025/08/14085452/NAD-symbol.zip>, linked
from the [NAD brand guidelines](https://www.nadadventist.org/about/brand-guidelines/logo/)),
downloaded October 31, 2026, unmodified. The app doesn't bundle it:
`scripts/make-launch-symbol.py` writes its paths into `constants/ChurchSymbol.ts` for the
launch animation. The rules for using it are in
[LEGAL_BRANDING.md](../../../docs/LEGAL_BRANDING.md).

## External services

These files are unmodified provider assets used inside clickable controls that open
the corresponding fixed external service link.

- `youtube-icon-red.png` was extracted from YouTube's official `youtube-icon.zip`:
  <https://www.gstatic.com/marketing-cms/89/d9/cf95c4f345709f4998dc581221b0/youtube-icon.zip>
- `spotify-icon-green.png` was extracted from Spotify's official logo/icon pack:
  <https://developer.spotify.com/images/guidelines/design/2024-spotify-logo-icon.zip>

Downloaded September 12, 2026. Do not recolor, distort, crop, or use these assets
in the app icon, app name, store listing graphics, or unrelated marketing. Review
the current provider brand guidelines before changing their use. The app uses the
high-resolution PNG exports because the project does not currently include a native
SVG renderer. They are rendered without tinting; YouTube's transparent canvas is
visually compensated at render time so its mark has appropriate weight without
changing the provider-supplied pixels. The renderer selects the official colored
variant in both themes.

The app intentionally does not bundle a Zoom logo. The Zoom link uses a generic
video icon because the current Zoom terms grant logo rights in narrower partner
and SDK contexts.
