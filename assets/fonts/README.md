# Bundled font sources and licenses

The application bundles the following script-specific fonts for its
original-language Bible display. The font files are loaded in `app/_layout.tsx`,
and their registered React Native family names are centralized in
`constants/Themes.ts`.

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

## What the licenses allow

Both fonts may be used, embedded, copied, and redistributed with this app,
including in a commercial app, without a fee or separate permission. The
licenses are open, but they are not condition-free: among other terms, the OFL
requires its copyright and license notices to accompany redistributed font
software, prohibits selling the fonts by themselves, and applies naming rules
to modified versions. This repository preserves the upstream notices beside
the font files. See the linked official license text and the bundled notices for
the complete terms.
