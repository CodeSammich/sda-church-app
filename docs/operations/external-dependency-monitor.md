# External dependency monitor

The app's web/PWA preview and native clients depend on public APIs, media hosts, hymn
directories, and user-facing external destinations. `.github/workflows/external-dependency-monitor.yml`
checks them daily at 5:17 PM America/New_York time and can also be run manually.

## Traffic policy

The monitor must not request every generated chapter or hymn page. It uses two
layers instead:

- Jest validates every locally generated CUV, hymnal, public-domain library,
  and curated EGW edition URL without network traffic.
- The live monitor reads a provider's catalog once when one is available, then
  requests one stable pseudo-random file or page from each large collection per
  UTC day. Retries use the same sample.

This means the 1,189-file audio collections (Mandarin and Cantonese CUV, and Spanish
RV1909) each receive one sampled media request per host per daily run, not 1,189
requests. Project Gutenberg receives one sampled
public-domain book request, and EGW Writings receives one sampled book request
for each supported edition language. The Internet Archive receives one metadata
request per linked library scan, which checks that the scan is still openly
downloadable and dated before 1928 (see [Internet Archive sources](../LEGAL.md#internet-archive-sources)).
Fixed app destinations and small API
contracts receive one request each. HTTP 429 is accepted only for
navigational websites that commonly rate-limit bots; APIs, catalogs, and media
remain strict.

It checks that each children's Sabbath School age group will open this week's
English lesson: Adventech lists this quarter's Junior, Teen, and Youth issues, and
has weekly PDFs for this quarter's Alive in Jesus Beginner, Kindergarten, and
Primary books. A failure means the app is opening that age group's Alive in Jesus
website instead, usually because a new quarter isn't published yet or the catalog
changed. The six age-group websites are checked too, since they're the fallback.
See `features/sabbath-school/ChildrenLessons.ts`.

It also checks the church's own website: the privacy policy, support, and download
pages at `app.nyccsda.org`, which the store listings and QR codes depend on. Each must
load through the custom domain and still contain its expected text. See
[The app website](admin-runbook.md#the-app-website-appnyccsdaorg).

Run it locally with:

```sh
npm run test:integration:external
```

The command writes `external-dependency-report.json`, which is ignored by Git
and uploaded by Actions for 30 days.

## Alerts and recovery

When a run fails, the workflow:

1. uploads the JSON report;
2. opens one issue named `[monitor] External dependency health check failed`,
   or comments on the existing open issue; and
3. fails the workflow run.

The issue is closed automatically after the next successful run. GitHub Actions
notifications must be enabled in the maintainer's notification settings to
receive email or web alerts. This is monitoring, not a guaranteed phone/SMS
page; add a webhook-based paging service later if that becomes necessary.

Scheduled workflows only run from the default branch. GitHub may delay them at
busy times, which is why this schedule avoids the top of the hour. GitHub also
automatically disables schedules in public repositories after 60 days without
repository activity.

- [GitHub scheduled workflow behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [GitHub Actions notification settings](https://docs.github.com/en/subscriptions-and-notifications/how-tos/managing-github-actions-notifications)
