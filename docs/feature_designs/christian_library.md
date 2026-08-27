# Christian Library

Issue: [#37](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/37)

## Content policy

The catalog is curated, not an open web search. A work may be copied into the app only when all of the following are recorded for the exact edition:

1. The work supports, or does not conflict with, Seventh-day Adventist beliefs.
2. The original work and the specific translation are public domain in the app's distribution territory.
3. A stable source identifies the title, author, edition, publication year, and rights status.
4. The imported text can retain the source's required attribution or license notice.

When any point is uncertain, the work is not included. Copyrighted material may appear only as a link to the rights holder's or denomination's official service.

## Initial catalog

The first release links to source records rather than copying full text. This validates navigation, localization, catalog metadata, and rights labeling before a native reader and offline storage are introduced.

Public-domain works use original, text-free cover illustrations generated for this app. They are decorative rather than reproductions of historical covers. Book titles and all actionable information remain real text outside the images. The default two-column bookshelf changes to a single-column, horizontal-cover list when the screen is narrow or effective text scale is enlarged.

The EGW collection also uses original, text-free thematic illustrations generated for this app. Official White Estate covers were not supplied to the generator, copied, hotlinked, or used as style references. Prompts describe only broad themes from each work and explicitly exclude the official covers' distinctive imagery, typography, branding, and layouts. Edition titles and language actions remain accessible live text.

For Chinese app languages, the curated EGW cards may replace that bundled fallback artwork with current cover thumbnails from the Chinese Union Mission's official catalog. The app fetches only catalog metadata and images, validates image URLs against the Mission's storage host, and does not copy or render the linked book text. If the catalog or an image is unavailable, the original bundled artwork remains visible.

The Library is one browsing surface: EGW books appear first, followed by Adventist pioneers and Christian classics. Selecting an EGW cover opens an accessible edition dialog rather than navigating to a separate collection page. At enlarged text sizes or narrow widths, every shelf becomes a single-column list.

| Work or collection | Access | Reason |
| --- | --- | --- |
| Joseph Bates, *The Seventh Day Sabbath, a Perpetual Sign* (1847) | Project Gutenberg record | Explicitly marked public domain in the U.S.; foundational Adventist doctrine |
| J. N. Andrews, *History of the Sabbath and First Day of the Week* (1873) | Project Gutenberg record | Explicitly marked public domain in the U.S.; foundational Adventist scholarship |
| John Bunyan, *The Pilgrim's Progress* (1678) | Project Gutenberg record | Explicitly marked public domain in the U.S.; broadly accepted Protestant classic |
| Ellen G. White writings | Official EGW Writings website | Copyright and edition rights remain with the official service |

### EGW Writings editions

The EGW collection is organized by work, not by the website's current catalog language. Each curated work stores a separate official book ID and first readable paragraph for English, Chinese, and Spanish. The reader's app language is shown first in the edition dialog, but all three editions remain visible. Edition buttons deep-link directly into the selected translation.

## Chinese Adventist research queue

These authors are strong discovery candidates, but no work is bundled until an exact edition and its rights have been verified.

| Author | Why notable | Current decision |
| --- | --- | --- |
| 郭子穎 / Guo Ziying (1865–1937) | First ordained national Chinese Adventist minister; wrote a 20-chapter Chinese statement of Adventist beliefs and prophetic pamphlets | Best public-domain lead. Locate a pre-1928 scan and verify its bibliographic record before importing. |
| 康克典 / Khang Kiat Tien (1895–1987) | Chinese evangelist and author on biblical concepts in Chinese characters | Skip native inclusion. Known editions date from 1950 onward and later reprints may remain protected. |
| 林堯喜 / David Yaoxi Lin (1917–2011) | Chinese pastor, Bible correspondence-course writer, and author of *China Letters* | Skip native inclusion; modern works require permission or an official link. |
| 曹俊凱 / Cao Junkai | Prolific Chinese Adventist author, editor, poet, and translator | Skip native inclusion; identified books are modern and require publisher or estate permission. |
| Lo Hing So (1916–1988) | Author and translator of Chinese devotional and periodical writing | Skip native inclusion until the official publisher identifies licensed digital editions. |

Primary discovery sources are the [Encyclopedia of Seventh-day Adventists](https://encyclopedia.adventist.org/) and the [Signs of the Times Publishing Association](https://www.stpa.org/). Their historical or biographical descriptions do not by themselves grant republication rights.

## Next implementation slices

1. Add a native reader for one verified Project Gutenberg edition, preserving its license header and source metadata.
2. Add chapter-level navigation and saved reading position.
3. Add catalog search, language filters, and favorites after the native-reader data model is stable.
4. Ask 時兆出版社 and the relevant archives about licensed Chinese digital editions, starting with Guo Ziying's early works.
5. Add verified, handpicked Chinese Adventist books and verified official English covers as tracked in [issue #176](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/176). The Chinese cover refresh alone does not complete that work.
