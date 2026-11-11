# Status page

The [status page](https://new-york-chinese-seventh-day-adventist.github.io/sda-church-app-status/),
also at `app.nyccsda.org/status`, checks the services the app depends on every
hour. For each one, it shows whether the service is up, how fast it answers,
and its history. It runs on
[Upptime](https://upptime.js.org) in a separate public repository,
[sda-church-app-status](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app-status),
using only GitHub Actions, Issues and Pages. It costs nothing, and it can't open
issues in this repository.

The [external dependency monitor](external-dependency-monitor.md) checks once a
day that each service still gives the app what it expects: catalogs, file
lists, the bulletin's fields. The status page only checks that each service
answers, but it does so every hour. An outage shows within the hour, and so
does a host that starts refusing the church's files, for example Adventist
Connect answering 403 or 429
([#618](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/618)).
It checks from GitHub's servers, so it can't see a host turning away members'
phones.

## Contents

- [What it checks](#what-it-checks)
- [Alerts](#alerts)
- [Changing the checks](#changing-the-checks)
- [The GitHub App](#the-github-app)
- [Upkeep](#upkeep)
- [Setting it up](#setting-it-up)
- [The short address](#the-short-address)

## What it checks

The checks live in `.upptimerc.yml` in the status repository. Each audio check
asks for John 3. `HEAD` asks only for the file's headers, never the recording,
and Upptime sends a real `HEAD` request
([its request code](https://github.com/upptime/uptime-monitor/blob/master/src/helpers/request.ts)).
On 2026-11-10, all six audio hosts answered `HEAD` with 200 and a range request
with 206 ([measured on #618](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/618#issuecomment-6784525193)).

| Check | Address | Request |
| --- | --- | --- |
| Adventist Connect, Mandarin audio | `https://assets.adventistconnect.org/newyork2/2026/08/12224153/CUV_B43C003.mp3` | `HEAD` |
| Adventist Connect, Cantonese audio | `https://assets.adventistconnect.org/newyork2/2026/09/30185746/CANTONESE_B43C003.mp3` | `HEAD` |
| Adventist Connect, Spanish audio | `https://assets.adventistconnect.org/newyork2/2026/09/30215519/RV1909_B43C003.mp3` | `HEAD` |
| Internet Archive, Mandarin fallback | `https://archive.org/download/CUV_201911/CUV_B43C003.mp3` | `HEAD` |
| Audio Power, Mandarin fallback | `https://theaudiopower.com/CUV/Recordings/%E7%BA%A6%E7%BF%B0%E7%A6%8F%E9%9F%B3%203.mp3` | `HEAD` |
| HelloAO, English audio | `https://audio.bible.helloao.org/api/BSB/JHN/3/audio/souer.mp3` | `HEAD` |
| Bulletin API | `https://script.google.com/macros/s/AKfycbzBDlptzh5JpDyAiucJBXO4pQXe2hy2X3DL_1t6NixK-2tV3md_WbyhdDAtCGvGCwzX/exec?changeovers=1&client=check` | `GET`; down unless the answer contains `"ok":true` |
| Chinese hymnal pages | `https://m.zgaxr.com/index.php?m=content&c=index&a=lists&catid=59` | `HEAD` |
| EGW Writings | `https://text.egwwritings.org/` | `HEAD` |

The bulletin API's `changeovers=1` answer
([Changeovers](../feature_designs/bulletin_spreadsheet_tags.md#changeovers))
needs no date and reads no bulletin. The API answers it before it notes older
apps' calls, so it's never counted as one. `client=check` marks it as a check
anyway, as the API's other checks are marked.

Some services aren't on the status page:

- **CHTV's YouTube feed**, which finds the Mandarin mission video
  (`features/sabbath-school/ChineseMissionSpotlight.ts`). It answers 404 to
  GitHub's servers: the daily monitor got 404 on every run from 2026-11-05 to
  2026-11-10, and the status page's first check got it 3 times in a row
  ([measured on #618](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/618#issuecomment-6784525193),
  [status repository #1](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app-status/issues/1)).
  The app already copes: each phone offers the last video it found. Checked
  every hour, the feed would only open issues that need nothing done. The
  daily monitor checks it instead. It ignores the feed's errors until Friday,
  then warns.
- **Hymns for Worship**, which the hymnal opens for English scores. On
  2026-11-11 it stopped answering GitHub's servers for several minutes, while it
  answered other networks in under a second
  ([sda-church-app-status#4](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app-status/pull/4)).
  It's a small site whose owner gave the church permission for its scores, and
  frequent checks from a data centre are what a security plugin flags. The app
  only links to it, and the daily monitor checks it.
- **HelloAO's Bible text API.** The app ships the text it uses, so it never
  calls the API.
- Anything that needs a closer look than "does it answer". The daily monitor
  covers those.

## Alerts

When a check fails, Upptime tries twice more in the same run, 2 and then 10
seconds later. If the last try fails too, or the service takes over a minute to
answer, it opens an issue in the status repository
([`update.ts`](https://github.com/upptime/uptime-monitor/blob/master/src/update.ts)).
When the service is back, it closes that issue. Outage issues never reach this repository: the
[GitHub App](#the-github-app) that opens them is installed only on the status
repository.

To get them, watch the status repository with **Watch → Custom → Issues**. The
config is public, so it names no assignees and doesn't show who's on call.

A short outage needs nothing done. To check again without waiting for the next
hour, run **Actions → Uptime CI → Run workflow** in the status repository. For
an outage that lasts, open the address in a browser:

- If Adventist Connect refuses the church's audio (403 or 429), or a file has
  gone, see [Adventist Connect media](adventist-connect-media.md) and
  [#616](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/616).
  Cantonese and Spanish have no other copy.
- If the bulletin API is down, see
  [Bulletin automation](bulletin-automation.md). The app shows each week's
  stored copy with an error, so only a week a phone never loaded is blank.

## Changing the checks

Edit `.upptimerc.yml` in the status repository on GitHub, or open a pull
request to it. `workflowSchedule.uptime` sets how often it checks: every hour,
at 17 minutes past, away from the top of the hour when GitHub is busiest.
Upptime's default is every 5 minutes
([Upptime's configuration](https://upptime.js.org/docs/configuration/)), more
than the church needs. Upptime has one fixed schedule, so it can't check more
often while something is down. Committing it to `master` starts **Setup CI**
([`setup.yml`](https://github.com/upptime/upptime/blob/master/.github/workflows/setup.yml)), which rebuilds the workflows and the page. Only list public
addresses, never the bulletin spreadsheet or anything with names, and use `HEAD`
for files so a check never downloads one.

When the app's addresses change, change the status page too. For example, the
church may upload the audio to Adventist Connect again, or the bulletin API may
get a new deployment. `test/status-page.test.ts` fails when an audio or bulletin
address in the table above no longer matches the one the app uses. It can't see
`.upptimerc.yml`, so once the table is fixed, make the same change there.

## The GitHub App

Upptime commits to its repository and opens issues with a token from a GitHub App
([Upptime's setup guide](https://upptime.js.org/docs/get-started/)):

- The organization owns the App, so it doesn't depend on any one person.
- It's installed only on `sda-church-app-status`, with read and write access to
  Actions, Contents, Issues and Workflows. Nothing else.
- The status repository's **Actions** variable `GH_APP_ID` holds the App's
  **Client ID** (not its App ID). The **Actions** secret `GH_APP_PRIVATE_KEY`
  holds its private key. The key must be a secret: variables aren't hidden.
- The key doesn't expire
  ([GitHub's docs](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps)).
  If it may have leaked, go to the organization's **Settings → Developer
  settings → GitHub Apps → Edit → Credentials → Key pairs**. Choose **New key**,
  save it as the secret, then delete the old key.

A personal access token would work too, but it expires and belongs to one
maintainer. And GitHub doesn't notify you about your own activity unless you
ask it to
([GitHub's blog](https://github.blog/news-insights/email-updates-about-your-own-activity/)),
so that maintainer wouldn't hear about the issues the token opens.

## Upkeep

- **Updates:** Upptime updates its own workflows every day (**Update Template
  CI**, [`update-template.yml`](https://github.com/upptime/upptime/blob/master/.github/workflows/update-template.yml)). If a
  release of Upptime breaks, the status page stops until Upptime fixes it. The
  app isn't affected.
- **Schedules:** GitHub turns off a public repository's schedules after 60 days
  without activity
  ([GitHub's docs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)).
  Upptime commits its response times and graphs every day
  ([`response-time.yml`](https://github.com/upptime/upptime/blob/master/.github/workflows/response-time.yml),
  [`graphs.yml`](https://github.com/upptime/upptime/blob/master/.github/workflows/graphs.yml)), and a commit is the activity known to count
  ([Maintenance releases](admin-runbook.md#maintenance-releases)), so they stay
  on. GitHub may also
  start a scheduled run late at busy times
  ([GitHub scheduled workflow behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)).
- **Cost:** none. It's a public repository on GitHub's free plan, and nothing in
  it has a payment method ([Payment methods](../architecture.md#payment-methods)).
- **Yearly:** the [yearly checkup](admin-runbook.md#yearly-checkup) asks
  whether the page still updates, whether its checks still match the app, and
  whether the App is still installed only on the status repository.

## Setting it up

To set up the status page again, or for another church's copy of the app:

1. On [upptime/upptime](https://github.com/upptime/upptime), choose **Use this
   template → Create a new repository**. Pick the organization in the
   **Owner** menu, not a personal account. Make it public, and tick **Include all
   branches**.
2. In the organization's **Settings → Developer settings → GitHub Apps**, choose
   **New GitHub App**:
   - Untick the webhook's **Active**.
   - Give it read and write access to Actions, Contents, Issues and Workflows.
   - Allow it only on this account.
   - After creating it, copy its **Client ID** and generate a private key.
3. Install the App on the new repository only.
4. In the repository's **Settings → Secrets and variables → Actions**, add the
   variable `GH_APP_ID` (the Client ID) and the secret `GH_APP_PRIVATE_KEY` (the
   whole `.pem` file). Then delete the downloaded file.
5. Replace `.upptimerc.yml` with the checks above. Set `owner` and `repo`, and
   `status-website.baseUrl` to `/` plus the repository's name. Commit it.
6. When **Static Site CI** has run, check **Settings → Pages**: it should deploy
   from the `gh-pages` branch.
7. Watch the repository for issues.

If **Setup CI** fails with "Permission … denied to github-actions[bot]", the
workflow didn't get the App's token: check the variable's and the secret's names
and where they're saved, then run it again.

## The short address

`app.nyccsda.org/status` leads to the dashboard. A Cloudflare redirect rule,
**Status page short link**, sends `/status` and `/status/` on `app.nyccsda.org`,
in any capitalisation, to the dashboard with a temporary (302) redirect. It
comes just before the rule that sends the rest of `app.nyccsda.org` to the app's
website ([The app website](admin-runbook.md#the-app-website-appnyccsdaorg)).
Cloudflare uses the first redirect rule that matches
([Cloudflare's docs](https://developers.cloudflare.com/rules/url-forwarding/#execution-order)),
so if the order is swapped, `/status` leads to a missing page on the app's
website. The rule's expression is:

```
(http.host eq "app.nyccsda.org" and lower(http.request.uri.path) in {"/status" "/status/"})
```

If `app.nyccsda.org` ever serves the app's website itself instead of
redirecting, as the runbook plans for app links, Cloudflare's redirect rules no
longer apply to it. The short address then needs another home, such as a page at
`public/status/index.html` that forwards to the dashboard.
