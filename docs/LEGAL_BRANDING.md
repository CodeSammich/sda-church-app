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

When the app opens, the church symbol is drawn as if with a pen, from the bottom up: the
open Bible and the cross, then the flame's lines, each reaching higher than the last, then
the ® (#538). That order follows the symbol's meaning: the Word of God as the
foundation, the cross at its centre, and the flame of the Holy Spirit rising above them.
On October 31, 2026, the church decided to animate the symbol without asking for
separate permission, since the app already uses the NAD's version of it with the
pastor's approval (#23, #36), and chose this pen drawing over a plain bottom-up reveal.
The animation stays within the NAD's logo guidelines as far as an animation can:

- Every shape is drawn in its own place. Nothing is moved, rotated, stretched, or
  recoloured, and nothing is added: the pen line is the shape's own outline, and it
  goes once the shape fills in.
- The ® is part of the drawing and stays with the symbol.
- It ends on the exact, unchanged symbol. The shapes are the paths of the NAD's
  official SVG, kept as `assets/images/brand/nad-symbol.svg`, which
  `scripts/make-launch-symbol.py` writes into `constants/ChurchSymbol.ts`.
  `test/launch-splash.test.ts` checks that the finished drawing matches that SVG pixel
  for pixel.

Changes to the animation should keep to these rules. See
[Opening the app](UI_UX.md#opening-the-app) for how it plays.
