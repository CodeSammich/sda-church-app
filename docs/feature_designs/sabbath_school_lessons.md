# Children's Sabbath School Lessons

Issue: [#336](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/336), fixed in #338 (0.43.0)

The Sabbath School page lists every children's age group, every week, in every app language. The age groups are Beginner, Kindergarten, Primary, Junior, Teen, and Youth, each with a student guide and a teacher guide on the Students and Teachers tabs. A separate Babies entry opens Alive in Jesus's resources for parents and teachers.

Tapping an age group opens this week's lesson. The app stores no lesson links: it looks the lesson up at the moment of the tap, in `features/sabbath-school/ChildrenLessons.ts`. So a new week or a new quarter needs no update.

## What a tap opens

`findChildrenLessonUrl` tries these in order and opens the first one it finds:

1. this week's lesson PDF in the app's language, where there is one (Chinese, for both Traditional and Simplified readers);
2. this week's English lesson PDF;
3. the age group's Alive in Jesus website, which always loads.

Spanish has no children's lessons, so Spanish readers get the English PDF.

If a source is missing, late, unreachable, or malformed, the search moves on to the next one. If nothing turns up within 12 seconds, the website opens. The lookup never fails: the worst case is a website instead of a PDF.

## Where each age group's lessons come from

`CHILDREN_AGE_GROUPS` gives each age group a website and, for each language, the sources to try in order. To change where an age group's lessons come from, edit this table, not the lookup.

| Age group | Chinese | English | Website |
| --- | --- | --- | --- |
| Beginner | Adventech quarterly `bg` | Alive in Jesus `bg` (teacher: `bg-tg`) | `beginner.aliveinjesus.info` |
| Kindergarten | Adventech quarterly `kd` | Alive in Jesus `kd` (teacher: `kd-tg`) | `kindergarten.aliveinjesus.info` |
| Primary | Adventech quarterly `pr` | Alive in Jesus `pr` (teacher: `pr-tg`) | `primary.aliveinjesus.info` |
| Junior | Adventech quarterly `pp` | Adventech quarterly `pp` | `junior.aliveinjesus.info` |
| Teen | none | Adventech quarterly `rt` | `teen.aliveinjesus.info` |
| Youth | Adventech quarterly `hant-cc`, then `cc` | Adventech quarterly `cc` | `youth.aliveinjesus.info` |

The two kinds of source handle teacher's guides differently:
- **Adventech quarterly:** each lesson lists the student's PDF first and the teacher's second, so an age group's student and teacher entries differ only in which PDF they take.
- **Alive in Jesus:** it publishes the teacher's guide as a separate book, ending in `-tg`.

Junior, Teen, and Youth have only the websites as a fallback until Alive in Jesus covers those ages, expected in 2027 or later.

## Finding this week

Each catalog has its own small reader:
- **Adventech quarterlies** (`findQuarterlyPdf`): `https://sabbath-school.adventech.io/api/v2/<language>/quarterlies` lists the issues, such as `2026-04-pp`. Each issue lists its lessons, and each lesson lists its PDFs.
- **Alive in Jesus** (`findAliveInJesusPdf`): a newer catalog, at `https://sabbath-school.adventech.io/api/v3/<language>/aij/<quarter>-<book>/`. Its `sections/index.json` lists the weeks, and `pdf.json` lists one PDF per week, matched to its week by `target`. Alive in Jesus moved to this catalog in 2026, and until #338 the app didn't read it.

`getChildrenQuarter` works out the quarter, such as `2026-04`, and the week number from the date. The two catalogs start their quarters on different days:
- **Adventech** starts a quarter on the Sabbath on or before the quarter's first day. The fourth quarter of 2026 began on Sabbath, September 26. January 1, 2027 is a Friday, so the first quarter of 2027 begins on Sabbath, December 26, 2026.
- **Alive in Jesus** weeks run Sunday to Sabbath, so its quarter starts the next day: September 27 and December 27, 2026.

Week numbers count whole weeks from the quarter's start. The day count is rounded, so a daylight saving change doesn't lose a day.

The catalogs have been wrong before, so the lookup doesn't rely on a single field:
- It looks for this quarter's issue **by name** first, such as `2026-04-cc`, and only then by dates. Adventech has listed a new quarter's issue with the previous quarter's dates, which hid Junior, Teen, and Youth for weeks.
- Within an issue, it takes the lesson whose dates include today. Failing that, it takes the lesson numbered for this week, and never one past the last lesson (`pickWeek`).

A new quarter's issues can appear late. Until they do, the age group opens its website.

## Safety

A PDF opens only if its address is HTTPS on one of Adventech's two PDF hosts, `sabbath-school-pdf.adventech.io` and `sabbath-school-resources-media.adventech.io` (`officialPdf`). So a changed or broken catalog can't send children to another site.

## Monitoring

The [external dependency monitor](../operations/external-dependency-monitor.md) checks every day that:
- each English age group would open this week's lesson PDF;
- the six age-group websites load.

It allows 14 days of grace at the start of each quarter (`QUARTER_GRACE_DAYS`), when issues are often published late. During that time a missing issue is a warning, not a failure.

## When a publisher changes its catalog

The app keeps working by opening the websites, and the monitor fails. To fix it:

1. Read the monitor's report to see which age groups now fall back.
2. If a series moved or was renamed, update `CHILDREN_AGE_GROUPS`.
3. If a catalog's format changed, update that catalog's reader: `findQuarterlyPdf` or `findAliveInJesusPdf`.
4. Add a test with the new catalog's shape to `test/children-lessons.test.ts`. The tests give the lookup a fake `fetch`, so they need no network.
5. Check against the live catalogs. `findChildrenLessonUrl(curriculum, language, date)` takes any date, so try this Sabbath and the first Sabbath of next quarter.

## Tests

`test/children-lessons.test.ts` has a test for each case the lookup handles, including:
- the catalog listing a quarter with the previous quarter's dates;
- Alive in Jesus weeks starting on Sunday;
- Chinese and Spanish readers;
- the fall back to the website when there's no lesson, or when the lookup takes too long;
- the official-host check;
- next year's first quarter starting in late December.
