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

Books outside the EGW collection use original covers made for this app: typographic covers in the style of gilt cloth bindings, each with an emblem for its title, drawn by `scripts/generate-library-covers.py` with open-licensed fonts. They are decorative rather than reproductions of historical covers. Book titles and all actionable information remain real text beside or below the images. On a shelf's own page, the default two-column bookshelf changes to a single-column, horizontal-cover list when the screen is narrow or effective text scale is enlarged.

The EGW collection retains original, text-free thematic illustrations generated for this app as its final offline fallback. Official White Estate covers were not supplied to the generator, copied into the repository, or used as style references. Prompts describe only broad themes from each work and explicitly exclude the official covers' distinctive imagery, typography, branding, and layouts. Edition titles and language actions remain accessible live text.

The cards request small, remotely hosted cover thumbnails from the official provider for the current app language. English and Spanish covers use the book IDs already published by EGW Writings; Chinese covers use the Chinese Union Mission's live catalog and validate image URLs against the Mission's storage host. Spanish falls back to English, Chinese falls back to English, and all languages finally fall back to the bundled original artwork. No provider cover or linked book text is copied into the repository. The provider thumbnails are used only for identifying books that lead to their official reader editions. The White Estate copyright notice reserves rights in its website and app content, so this limited navigational thumbnail use is a fair-use assessment rather than an express license.

The Library page shows each shelf as a row of covers that scrolls sideways, in this order: Christian Classics, Children, Youth / Young Adults, Ellen G. White, and Adventist Pioneers (`LIBRARY_SHELVES` in `features/library/LibraryShelves.ts`). General Christian books come first so a visitor meets the wider Christian shelf before the denomination's own writers. A new book lengthens its row rather than the page, and a new kind of book becomes a new row. Within a shelf, a few chosen books lead (`LIBRARY_SHELF_LEADERS`): *The Bruised Reed* in Christian Classics, *Pastor Hsi* in Youth / Young Adults, and in the Ellen G. White shelf, *Sabbath Encouragement* followed by her most-read books. The rest follow in catalog order.

The Library is a Christian library with an Adventist section, not an Ellen G. White library (#391). On every shelf but her own, other writers' books come before hers, even ahead of a shelf's leading books (`orderShelfBooks`). Her books sit on one other shelf at most (`EGW_BOOK_IDS_BY_SHELF`): *Education* and *Messages to Young People* on Youth / Young Adults. *Child Guidance* and *Christ's Object Lessons* are written for adults, so they stay on her shelf. The Children and Youth shelves each hold more books by other writers than by her, and the featured books at the top of the page include one of hers at most: *Steps to Christ*, her most widely read. `test/library-balance.test.ts` checks all of this in every app language. Each row's "See all" opens that shelf's own page, and the page's search finds any book. Selecting a cover opens the book in the app language's edition when it has one, Ellen G. White's books included. Covers grow with the text size, so titles stay readable beneath them.

| Work or collection | Access | Reason |
| --- | --- | --- |
| Joseph Bates, *The Seventh Day Sabbath, a Perpetual Sign* (1847) | Project Gutenberg record | Explicitly marked public domain in the U.S.; foundational Adventist doctrine |
| J. N. Andrews, *History of the Sabbath and First Day of the Week* (1873) | Project Gutenberg record | Explicitly marked public domain in the U.S.; foundational Adventist scholarship |
| John Bunyan, *The Pilgrim's Progress* (1678) | Project Gutenberg record | Explicitly marked public domain in the U.S.; broadly accepted Protestant classic |
| Jesse Lyman Hurlbut, *Story of the Bible Told for Young and Old* (1904) and *Hurlbut's Life of Christ for Young and Old* (1915) | Internet Archive scan of the 1905 edition; Project Gutenberg record | Public domain in the U.S.; Bible stories for children and families on the Children shelf |
| Mrs. Howard Taylor, *Pastor Hsi* (1903), and Dr. and Mrs. Howard Taylor, *Hudson Taylor in Early Years* (1911) | Internet Archive scans of the first editions | Public domain in the U.S.; Christian lives tied to China for the Youth / Young Adults shelf |
| Ellen G. White writings | Official EGW Writings website | Copyright and edition rights remain with the official service |

Three books have a Spanish edition, which Spanish readers see and open instead, with a Spanish version of its cover (`spanish` in `features/library/LibraryCatalog.ts`):

| Book | Spanish edition | Source |
| --- | --- | --- |
| *The Story of Jesus* | *Cristo Nuestro Salvador* | EGW Writings, the official Spanish edition |
| J. N. Andrews, *History of the Sabbath* | *Historia del Sábado* | EGW Writings, the Adventist Pioneer Library's 2020 translation of the 1873 edition |
| *The Pilgrim's Progress* | *El progreso del peregrino para todos (condensado)* | Chapel Library's free PDF, an abridged edition it allows anyone to copy |

One book has a Chinese edition, which Chinese readers see and open instead, titled in Traditional or Simplified characters to match the app language and with a Chinese cover (`chineseEdition` in `features/library/LibraryCatalog.ts`). One edition serves both scripts, even when it is printed in traditional characters only:

| Book | Chinese edition | Source |
| --- | --- | --- |
| *The Pilgrim's Progress* | 天路歷程 (天路历程), the 1869 Mandarin (官話) edition of William C. Burns's translation of Part 1 | HathiTrust's public-domain scan |

No other non–Ellen White book had a Chinese or Spanish edition that is public domain or offered free when checked on 2026-10-01, so those books show in English to Chinese and Spanish readers.

Their rights bases are in [Library Sources and Licensing](../LEGAL.md#library-sources-and-licensing).

### EGW Writings editions

The EGW collection is organized by work, not by the website's current catalog language. Each curated work stores a separate official book ID and first readable paragraph for English, Chinese, and Spanish. Selecting a book opens the app language's edition directly, deep-linked to its first paragraph, as other Library books do. Traditional and Simplified Chinese share the one Chinese edition. Until 1.0.0 an edition dialog listed all three, from when only her books had other languages.

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
5. Add verified, handpicked Chinese Adventist books when exact editions and rights can be documented. The language-aware official cover refresh is tracked in [issue #176](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/176).
