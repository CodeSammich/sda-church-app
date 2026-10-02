# Bundled font sources and licenses

The application bundles the fonts below: a theme font for its interface text,
script-specific fonts for its original-language Bible display, and two icon
fonts. The font files are loaded in `app/_layout.tsx`. The registered React
Native family names of the text fonts are centralized in `constants/Themes.ts`;
the icon fonts use the family names `@expo/vector-icons` gives them.

## Plus Jakarta Sans 2.071

- Files: `PlusJakartaSans-Regular.ttf`, `PlusJakartaSans-Medium.ttf`, `PlusJakartaSans-Bold.ttf`
- Use: the app's interface text. `constants/Themes.ts` maps every theme text style to one of the three weights.
- Publisher: Tokotype
- Upstream source code: [tokotype/PlusJakartaSans](https://github.com/tokotype/PlusJakartaSans)
- License: [SIL Open Font License 1.1](https://openfontlicense.org/open-font-license-official-text/)
- Bundled license text: `PlusJakartaSans-OFL.txt`

## Gentium 7.000

- File: `Gentium-Regular.ttf`
- Use: Koine Greek Bible text
- Publisher: SIL Global
- Official source and current release: [Gentium download page](https://software.sil.org/gentium/download/)
- Upstream source code: [silnrsi/font-gentium](https://github.com/silnrsi/font-gentium)
- License: [SIL Open Font License 1.1](https://openfontlicense.org/open-font-license-official-text/)
- Bundled license text: `Gentium-OFL.txt`

Gentium 7.000 is SIL's current recommended version. The family was formerly
named Gentium Plus; SIL changed the name back to Gentium in version 7.

## Ezra SIL 2.51

- File: `EzraSIL-Regular.ttf` (upstream filename: `SILEOT.ttf`)
- Use: Biblical Hebrew and Aramaic Bible text
- Publisher: SIL International
- Official source and final release: [Ezra SIL product and download page](https://software.sil.org/ezra/)
- License: the font is distributed under the [SIL Open Font License 1.1](https://openfontlicense.org/open-font-license-official-text/); its Hebrew layout intelligence is additionally distributed under the MIT/X11 License.
- Bundled license notices: `EzraSIL-Licenses.txt`

## Icon fonts: Ionicons and Material Community Icons

- Files: `Ionicons.ttf`, `MaterialCommunityIcons.ttf`
- Use: the app's icons, drawn by `components/AppIcon.tsx` with the `Ionicons`
  and `MaterialCommunityIcons` components from `@expo/vector-icons`.
- Source: exact copies of the fonts that ship in `@expo/vector-icons` 15.1.1, in
  `node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/`.
  `app/_layout.tsx` loads them under that package's family names, `ionicons` and
  `material-community`. The package's glyph maps must match these fonts, so when
  upgrading `@expo/vector-icons`, compare the copies with the package's fonts
  (for example with `sha256sum`) and replace them if they differ.
- License: `@expo/vector-icons` is distributed under the MIT License, per its
  `package.json` and `LICENSE` file. No license file sits beside these two
  fonts, and neither the package nor the font files state the licenses of the
  upstream icon sets (Ionicons, and Material Design Icons, as
  `MaterialCommunityIcons.ttf` names itself).

## Noto Sans (present but unused)

- Files: `NotoSans-Regular.ttf`, `NotoSans-Medium.ttf`, `NotoSans-Bold.ttf` (version 2.015)
- Use: none. Nothing loads or imports these files, so Metro leaves them out of
  the app. Noto Sans was the theme font from 0.13.0 until 0.24.0 replaced it with
  Plus Jakarta Sans.
- License: the fonts' own metadata says they are licensed under the SIL Open Font
  License 1.1, © The Noto Project Authors. No license text file is bundled beside
  them.

## What the licenses allow

Plus Jakarta Sans, Gentium, and Ezra SIL may be used, embedded, copied, and
redistributed with this app, including in a commercial app, without a fee or
separate permission. The licenses are open, but they are not condition-free:
among other terms, the OFL requires its copyright and license notices to
accompany redistributed font software, prohibits selling the fonts by
themselves, and applies naming rules to modified versions. This repository
preserves the upstream notices beside these font files. See the linked official
license text and the bundled notices for the complete terms. The icon fonts'
terms are described in their section above.
