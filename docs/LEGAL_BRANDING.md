# Branding & Trademark Policy

The source code in this repository is licensed under an open-source license, but this
software license does not grant any rights or permissions to use the proprietary branding,
registered trademarks, or official logos contained within the project.

The Seventh-day Adventist® (SDA) Church symbol is a registered trademark of the General
Conference Corporation of Seventh-day Adventists, and this project's specific visual
assets with the Seventh-day Adventist primary logo with the flame, cross, open Bible, and
the Second Coming, represent the unique, authorized brand identity of the North American
Division (NAD).

Authorization to utilize these assets is strictly limited to official Seventh-day
Adventist church organizations, while unauthorized third-party organizations are
explicitly prohibited from using them. Official church officers, such as Church Clerks,
are permitted to use these branding assets exclusively when conducting official church
business on authorized websites, documents, letters, and correspondence issued directly
under the name of the local church.

Furthermore, full-time employees of the Seventh-day Adventist Church and ordained or
licensed pastors are permitted to use these assets in a personal-professional capacity,
such as on official business cards, but personal use by general members or the public is
prohibited.

Any unauthorized reuse, redistribution, or modification of this open-source software must
completely remove these proprietary branding assets unless the modifying party has
independent, official authorization from the North American Division of Seventh-day
Adventists.

For more information, please visit the
[Official NAD Brand Guidelines](https://www.nadadventist.org/about/brand-guidelines/logo/).

## The launch animation

When the app opens, the church symbol rises into view from the bottom up: the open
Bible, then the cross, then the flame, as the symbol's meaning reads (#538). On October
31, 2026, the church decided to animate the symbol without asking for separate
permission, since the app already uses the NAD's version of it with the pastor's
approval (#23, #36). The animation stays within the NAD's logo guidelines as far as an
animation can:

- The whole symbol is uncovered from the bottom up by a soft edge, so it's never broken
  into separate pieces.
- It grows evenly as it rises, with no distortion, rotation, change of colour, or added
  elements, and the ® stays with it.
- It ends on the exact, unchanged symbol. `assets/images/church-symbol.png` is cut from
  the app icon by `scripts/make-launch-symbol.cjs`: the icon's own pixels, without the
  blue square. `test/launch-splash.test.ts` checks that it's still pure white.

Changes to the animation should keep to these rules. See
[Opening the app](UI_UX.md#opening-the-app) for how it plays.
