# Persona walk-throughs

What happened when the app was used the way four kinds of people would use it. Each
walk-through was done by hand on an Android emulator, task by task, and each report
lists where that person would hesitate, be misled, or get stuck, and what worked well
([#598](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/598)).

**The people are made up.** So is every name in the screenshots: the walk-throughs used
a key-screens build, which shows made-up bulletin and team data
([Key screens](../../operations/native-builds.md#key-screens)).

## The reports

| Persona | Who they are | Report |
| --- | --- | --- |
| Mrs. Lin | 76. Reads Traditional Chinese, uses text size 150%, taps words rather than small icons. First time opening the app. | [Mrs. Lin](mrs-lin/report.md) |
| Mr. Wong | 68. Speaks Cantonese and mostly listens to the Bible read aloud. Flaky Wi-Fi at home and little mobile data. | [Mr. Wong](mr-wong/report.md) |
| Sam | 30. English-speaking, not a member, invited by a friend. Found the app on the store the night before a first visit. | [Sam](sam/report.md) |

## How to read a report

- **Bottom line**: could this person do what they came to do, and what would stop them.
- **Findings, by severity**:
  - **Blocker**: they can't finish the task.
  - **Major**: they finish only with help or luck, or are misled.
  - **Minor**: they hesitate, or something looks wrong, but they get there.
  - **Note**: worth knowing, not a problem.
- **Task by task**: what they saw and did, and how many taps it took.
- **What worked well**, and the **limits** of the walk-through.
- **Proposed issues**: the findings grouped into issues. The ones that were filed are
  linked from #598.

A walk-through is one tester acting as one person, on an emulator. It finds where
someone is likely to stumble; it doesn't measure how many people would.
