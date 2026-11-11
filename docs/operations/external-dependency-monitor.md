# External dependency monitor

The app's web/PWA preview and native clients depend on public APIs, media hosts, hymn
directories, and user-facing external destinations. `.github/workflows/external-dependency-monitor.yml`
checks them daily at 5:17 PM America/New_York time and can also be run manually.
The [status page](status-page.md) checks the audio hosts, the bulletin API and a
few other services every hour, but only that each one answers.

## Traffic policy

The monitor must not request every generated chapter or hymn page. It uses two
layers instead:

- Jest validates every locally generated CUV, hymnal, public-domain library,
  and curated EGW edition URL without network traffic.
- The live monitor reads a provider's catalog once when one is available, then
  requests three stable pseudo-random files or pages from each large collection
  per UTC day. Retries use the same samples.

This means the 1,189-file audio collections (Mandarin and Cantonese CUV, and Spanish
RV1909) each receive three sampled media requests per host per daily run, not 1,189
requests. Project Gutenberg receives three sampled
public-domain book requests, and EGW Writings receives three sampled book requests
for each supported edition language. The Internet Archive receives one metadata
request per linked library scan, which checks that the scan is still openly
downloadable and dated before 1928 (see [Internet Archive sources](../LEGAL.md#internet-archive-sources)).
HathiTrust receives one catalog request per Chinese library edition, which checks
that the volume is still public domain and in full view; its page viewer turns
away scripts, so the monitor reads the catalog record instead.
Fixed app destinations and small API
contracts receive one request each. HTTP 429 is accepted only for
navigational websites that commonly rate-limit bots; APIs, catalogs, and media
remain strict. Two links also accept a refusal: the bulletin's schedule sheet
(401 or 403, since it needs a sign-in) and Adventist Giving (403, from its bot
protection). The app no longer opens the sheet (#553), but the bulletin is made
from it, so the monitor still checks that it's there.

It checks that each children's Sabbath School age group will open this week's
English lesson: Adventech lists this quarter's Junior, Teen, and Youth issues, and
has weekly PDFs for this quarter's Alive in Jesus Beginner, Kindergarten, and
Primary books. A failure means the app is opening that age group's Alive in Jesus
website instead, usually because a new quarter isn't published yet or the catalog
changed. In a quarter's first 14 days, missing lessons are only a warning, because
Adventech often publishes them late. The six age-group websites are checked too,
since they're the fallback.
See `features/sabbath-school/ChildrenLessons.ts` and
[Children's Sabbath School Lessons](../feature_designs/sabbath_school_lessons.md).

It reads CHTV 希望電視台's YouTube feed once, as phones do with the app in
Chinese, and looks for the coming Sabbath's 聖工剪影, CHTV's Mandarin Mission
Spotlight (#508). CHTV posts it the Tuesday before, and phones offer the last one
they found until then, so this check never fails. From Friday, a missing video,
or a feed YouTube won't serve, is a warning. Earlier in the week the feed's brief
errors are ignored. See `features/sabbath-school/ChineseMissionSpotlight.ts`.

It also checks the church's own website: the privacy policy, legal disclaimer,
support, and download pages at `app.nyccsda.org`, which the store listings, the app,
and QR codes depend on. Each must
load through the custom domain and still contain its expected text. See
[The app website](admin-runbook.md#the-app-website-appnyccsdaorg).

The workflow also reads the bulletin API's changeovers (`?changeovers=1`), the older
ways of answering the API keeps for older apps; the local command below doesn't. For each one no older app has needed for 14
days, it opens a cleanup issue, once. Its own bulletin requests send `client=check`,
so the API doesn't take them for an older app. See
[Changeovers](../feature_designs/bulletin_spreadsheet_tags.md#changeovers).

Run it locally with:

```sh
npm run test:integration:external
```

The command writes `external-dependency-report.json`, which is ignored by Git
and uploaded by Actions for 30 days.

## What the monitor can't check

The Sabbath School screen's **This Week's Mission Video** opens Adventist
Mission's Mission Spotlight page, or its Spanish edition (#508). Both sit behind
Vercel's security checkpoint, which answers every request from a script with
HTTP 429, even for a page that doesn't exist. So the monitor accepts 429 there,
and its check shows only that `adventistmission.org` still answers. The
[yearly checkup](../../scripts/yearly-checkup.cjs) asks someone to open the
button in English and in Spanish instead.

If the page has moved, find it on adventistmission.org under Mission+ → Mission
Promotion → For Sabbath School → Mission Spotlight, and the Spanish edition in
that page's language menu. Then update `getMissionSpotlightUrl` in
`constants/ExternalLinks.ts` and the two Mission Spotlight entries in
`test/integration/external-dependencies.mjs`.

## Failures and warnings

A request that times out, can't connect, or gets a temporary error status such as
403, 429, or 5xx is retried up to twice. A check that still fails is run once more
a minute later, so only failures that last raise the alarm.

A check can also pass with a warning. Warnings show in the run's summary and the
report but open no issue:

- one of a collection's three samples fails (the check fails only when most of
  them do);
- fewer than half of the curated books are missing from the Chinese cover
  catalog; or
- a children's lesson isn't published yet in the first 14 days of a quarter; or
- from Friday, the coming Sabbath's 聖工剪影 isn't in CHTV's feed, or the feed
  can't be read.

## Alerts and recovery

When a run fails, the workflow:

1. uploads the JSON report;
2. opens one issue named `[monitor] External dependency health check failed`,
   or comments on the existing open issue; and
3. fails the workflow run.

A new issue is assigned to the usernames in the `MONITOR_ALERT_ASSIGNEES` Actions
variable, which notifies them even if they don't watch the repository; if that is
empty, or GitHub rejects an assignee, the issue @mentions the run's actor instead
(`scripts/monitor-alert-issue.cjs`). See
[Getting notified only when action is needed](admin-runbook.md#getting-notified-only-when-action-is-needed).

The issue is closed automatically after the next successful run. This is
monitoring, not a guaranteed phone/SMS page; add a webhook-based paging service
later if that becomes necessary.

Scheduled workflows only run from the default branch. GitHub may delay them at
busy times, which is why this schedule avoids the top of the hour. GitHub also
automatically disables schedules in public repositories after 60 days without
repository activity.

- [GitHub scheduled workflow behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [GitHub Actions notification settings](https://docs.github.com/en/subscriptions-and-notifications/how-tos/managing-github-actions-notifications)
