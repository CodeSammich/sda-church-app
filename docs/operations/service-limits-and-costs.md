# Service limits and costs

What every service the app depends on costs, what limits it publishes, what happens
when a limit is hit, and how much load the app actually puts on it. Free operation is
a hard constraint: the "Sustainable" tenet in [Project Tenets](../project-tenets.md)
rules out anything that could produce a surprise bill (see
[#261](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/261)
for how that ruled out Cloudflare R2).

Numbers marked *measured* were taken on 2026-09-25/26 with single requests; published
limits link to the provider's page as checked on those dates. Review this page once a
year with the [upkeep calendar](../architecture.md#upkeep-calendar), and whenever a
provider changes its terms.

## Contents

- [Summary](#summary)
- [Load model](#load-model)
- [Deliberate architecture choices](#deliberate-architecture-choices)
- [Runtime services](#runtime-services)
- [Build, hosting, and admin services](#build-hosting-and-admin-services)
- [Link-only websites](#link-only-websites)
- [Known gaps](#known-gaps)

## Summary

"At the limit" says what happens if the app exceeds the provider's limit. **No
service in this table can bill the church for usage.** The only recurring cost in the
whole system is the domain.

| Service | Used for | Cost | Published limit | At the limit | Load concern |
| --- | --- | --- | --- | --- | --- |
| [Adventist Connect](#adventist-connect-media-library) | Photos, CUV Bible audio (primary) | Free (NAD platform) | None published; Cloudflare CDN terms apply to NAD's account | Unknown; no agreement | **Medium**: most of the app's bytes |
| [Internet Archive](#internet-archive) | CUV audio, 2nd source | Free | None published | Throttling possible | Low: built for bulk downloads |
| [Audio Power](#audio-power) | CUV audio, 3rd source | Free (permission) | None published | Unknown | Low: reached only if two sources fail |
| [HelloAO](#helloao) | Bible text, English BSB audio | Free | "No usage limits" | n/a | Low: CDN |
| [fetch(bible)](#fetchbible) | Original-language, CUV, RV1909 text | Free | "No limits from us" | n/a | Low: CDN |
| [Bulletin API (Apps Script)](#bulletin-api-apps-script) | Digital bulletin | Free (Workspace for Nonprofits) | 30 simultaneous executions per user | Requests fail with an error | **Medium at scale**: one account's ceiling |
| [Adventech](#adventech-sabbath-school) | Children's Sabbath School catalog | Free | None published | Unknown | Low: CDN |
| [Chinese Union Mission library](#chinese-union-mission-library) | Chinese EGW cover thumbnails | Free | None published | Unknown | Low: cached on the device for a day |
| [EGW Writings covers](#egw-writings-covers) | Library thumbnails | Free | None published | Unknown | Low: Cloudflare |
| [Sunrise-Sunset](#sunrise-sunset) | Sunset times on the printed Queens bulletin | Free, **attribution required** | "Reasonable" volume; `429` + `Retry-After` | Throttled | None: one request per printed bulletin; the app no longer calls it |
| [GitHub Actions](#github-actions) | Tests, builds, deploys | Free (public repo) | Fair use, concurrency | Queued jobs | None |
| [GitHub Pages](#github-pages) | `app.nyccsda.org` | Free | 1 GB site, 100 GB/month soft | `429` or a GitHub email | None |
| [Google Workspace](#google-workspace-and-drive) | Roster, Drive, Apps Script | Free (nonprofit) | 100 TB pooled storage | Quota errors | None |
| [Google Cloud](#google-cloud-play-upload-service-account) | Service account for automatic Google Play uploads | Free; **never link a billing account** | Play Developer API: 3,000 queries per minute | Uploads fail with an error | None: about ten requests per release |
| [Cloudflare](#cloudflare) | Domain and DNS | **~$10/year** (domain only) | n/a | n/a | None |
| [App stores](#app-stores) | Distribution | Free (Apple nonprofit waiver; Play $25 paid once) | n/a | n/a | None |

## Load model

The church has no usage analytics, so these are scenarios, not measurements. The
congregation is about 250 people (from the original design discussion in
[#5](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/5)).

| Scenario | Who | Bible listening | Sabbath-morning bulletin opens |
| --- | --- | --- | --- |
| Congregation | ~250 members | 200 people × 20 min/day | ~250 within an hour |
| Heavy use | ~1,000 users | 1,000 × 30 min/day | ~1,000 within 30 minutes |
| Wide adoption | ~10,000 users | 10,000 × 60 min/day | ~5,000 within 10 minutes |

Per-use costs, *measured*:

| Request | Size | Notes |
| --- | --- | --- |
| CUV audio, one hour | ~10.8 MB | 24 kbps mono; whole Bible 939 MB / ~87 hours |
| BSB English audio, one chapter | ~4.4 MB (John 3, Souer) | Much larger than the Chinese recordings |
| HelloAO chapter | ~3 KB (gzip) | One request per chapter viewed |
| HelloAO translation list | ~150 KB | Once per app session |
| fetch(bible) book | ~30 KB (CUV John) | One request per book, kept in memory for the session |
| Bulletin API | < 1 KB to a few KB | 5.7 s cold, 1.5 s warm |
| Chinese library catalog | ~40 KB | 1.1 s; at most once a day per device |
| Adventech quarterly index | ~124 KB | CDN-cached |

The conclusion: **text APIs are negligible at every scenario, and audio is the only
real load.** Adventist Connect carries it, and the fallback chain decides who carries
it when Adventist Connect can't. See [Internet Archive](#internet-archive).

## Deliberate architecture choices

These choices exist to keep the app free and within every provider's limits:

- **Bible text from static CDNs, not metered APIs.** HelloAO and fetch(bible) serve
  pre-built files from AWS CloudFront with no API key and no quota. Metered options
  were rejected: api.bible's free tier allows 5,000 calls a month, and
  bible-api.com throttles at 15 requests per 30 seconds
  ([Bible integration design](../feature_designs/bible_integration_design.md)).
  Choosing public-domain and openly licensed translations also means text can be
  cached and downloaded without login or licence limits.
- **No API keys in the app.** A shipped key can be extracted and abused, which could
  exhaust a quota or bill an account. Every runtime service the app calls works
  without a key, and the bulletin data goes through the church's own Apps Script
  instead of the Google Sheets API.
- **The church hosts its own copy of the CUV audio.** Audio Power's owner allowed
  self-hosting ([#134](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/134#issuecomment-5274730608)),
  so the church's copy on Adventist Connect is tried first, then the Internet
  Archive, and Audio Power's small server only serves listeners when both fail. Audio is streamed on demand, with
  only the next chapter preloaded on web, instead of downloading whole books.
- **Caching at every layer of the bulletin.** The Apps Script caches each response
  for 2 minutes, the app caches each Sabbath's bulletin on the device, and manual
  refresh has a 5-minute cooldown. Most bulletin opens never reach Apps Script.
- **Nothing billable.** Cloudflare R2 and paid object storage were rejected because
  usage-based billing can't be ruled out
  ([#261](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/261)).
- **The dependency monitor samples instead of crawling.** One sampled file per large
  collection per day, so monitoring adds almost no load
  ([External dependency monitor](external-dependency-monitor.md)).

## Runtime services

### Adventist Connect media library

Hosts the church's photos, hymnal lookup charts, and the primary copy of the CUV
Bible audio, behind NAD's Cloudflare CDN with Wasabi storage. Free to the church as
part of NAD's church-website platform, with no agreement or published limits. The
full hosting chain and scaling analysis are in
[Adventist Connect media hosting](adventist-connect-media.md): at congregation scale
it carries about 22 GB of audio a month, which is ordinary traffic for that platform;
at wide adoption, terabytes a month could draw attention under Cloudflare's CDN
terms.

### Internet Archive

`archive.org`, the second source for CUV audio, redirecting to its storage servers
(*measured*). Free, nonprofit, and built for large public downloads, though it
publishes no guaranteed rate and can slow heavy users. It is second so that an
Adventist Connect failure moves listeners here rather than onto Audio Power's server;
the daily [dependency monitor](external-dependency-monitor.md) checks that its
collection still holds every chapter.

### Audio Power

`theaudiopower.com`, the third and last source for CUV audio. A single nginx server
with no CDN (*measured*), run by a small ministry that gave the church permission to
use and self-host its Chinese recordings (see
[Audio Power permission scope](../LEGAL.md#audio-power-permission-scope); its Spanish
and English recordings are not covered). It publishes no limits and nothing is cached
in front of it.

**Load:** until 0.39 it was the second source, so an Adventist Connect failure would
have moved every listener onto it at once. It is now tried only when both Adventist
Connect and the Internet Archive fail for a chapter, which keeps that load off the
ministry's server. The app moves past a source that fails outright as soon as the
player reports it, and past a slow one after 15 seconds
([#262](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/262)),
so reaching Audio Power takes seconds rather than minutes.

### HelloAO

`bible.helloao.org` (text) and `audio.bible.helloao.org` (English BSB audio). Static
files on AWS S3 behind CloudFront with a one-day cache (*measured*). Its
documentation says: "No usage limits, no API Keys required, and no copyright
restrictions whatsoever." The app requests one small JSON file per chapter.

English audio is the one heavy HelloAO load: about 4.4 MB per chapter, streamed
directly from HelloAO, with no church copy. That is fine at every scenario because it
is served from CloudFront, but it is the largest dependency with no fallback other
than choosing another narrator.

### fetch(bible)

`v1.fetch.bible`, static files on S3 and CloudFront (*measured*), used for the
original-language texts and the CUV and RV1909 reader text. Its
[access policy](https://fetch.bible/access/#no-limits-from-us) offers the CDN with
"no API key, usage fee, request quota, or provider-imposed caching limit." The app
loads a whole book once (about 30 KB) and keeps it in memory for the session.

### Bulletin API (Apps Script)

The church's own Apps Script web app. Free under Google Workspace for Nonprofits.
It runs as the deploying account (`executeAs: USER_DEPLOYING`), so **every anonymous
request from every phone counts against that one account's
[Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)**:

- **30 simultaneous executions per user.** Requests beyond that fail with an error;
  there is no charge.
- 6 minutes per execution and 6 hours of trigger runtime a day, far above what the
  API uses.

*Measured* latency is about 1.5 s warm and 5.7 s cold, so the account can serve
roughly 20 requests a second before hitting the 30-execution ceiling. Caching keeps
real traffic far below that: the 2-minute server cache, the per-Sabbath device cache,
and the manual-refresh cooldown mean each phone asks about once per Sabbath. At
congregation and heavy-use scale this is well under 1 request a second. Wide
adoption, with thousands opening the bulletin in the same few minutes, is the one
case that could approach the ceiling. When a request fails, the app shows the last
copy it stored for that Sabbath, even an outdated one, with the error and a retry
button; only phones that never loaded that Sabbath see a failed load until traffic
drops. The daily [dependency monitor](external-dependency-monitor.md) checks the
public bulletin response.

Translation (`LanguageApp`) only runs on a cache miss, so its quota isn't a concern.

### Adventech Sabbath School

`sabbath-school.adventech.io`. The app downloads the quarterly index (about 124 KB)
when the children's Sabbath School screen opens, from S3 and CloudFront with a warm
cache (*measured*). Free, no key, no published limits.

### Chinese Union Mission library

`api.sdabible.org` (catalog) and `cms.sdabible.site` (cover images), used only for
the cover thumbnails of the Chinese EGW editions; the books open on EGW Writings. The
catalog is about 40 KB and took 1.1 s from a plain Apache server with no CDN or cache
headers (*measured*). Free, no key, no published limits.

**Load:** this is the smallest server the app talks to regularly, so the app keeps
the cover list from the catalog on the device and refreshes it at most once a day.
If a refresh fails, the cached covers stay in place.

### EGW Writings covers

`a.egwwritings.org`, small thumbnails loaded in the library, behind Cloudflare. Free,
no published limits. The platform image cache keeps repeat loads down. Reading
itself opens in the browser.

### Sunrise-Sunset

The app no longer uses `api.sunrise-sunset.org`. It calculates sunrise and sunset on
the device with the [`suncalc`](https://github.com/mourner/suncalc) library
(BSD-2-Clause), which matches the U.S. Naval Observatory's published times to the
minute (*measured*; the API ran 1 to 1.5 minutes later). That removed a network
dependency and the API's attribution requirement from the app.

The printed Queens bulletin's Apps Script still calls the API, once per bulletin, for
the sunset times it prints. Its [terms](https://sunrise-sunset.org/api) ask for "a
visible link to sunrise-sunset.org in the app or page where you show the data", so
that script should either credit it or calculate the times itself.

## Build, hosting, and admin services

### GitHub Actions

Free for public repositories on standard GitHub-hosted runners, including macOS, per
[GitHub's billing policy](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
Concurrency and fair-use limits apply; hitting them queues jobs, it doesn't bill. The
private-repository estimates in [Native Builds](native-builds.md#github-actions-minutes-and-maintenance)
only matter if the repository ever becomes private.

### GitHub Pages

Serves `app.nyccsda.org`: the privacy policy, the download page, and the unsupported
PWA preview. [Limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits):
1 GB per site, a soft 100 GB of bandwidth a month, and `429` responses when rate
limited. Going over the soft limit gets an email from GitHub, not a bill. The pages
that matter are tiny.

### Google Workspace and Drive

Free under Google Workspace for Nonprofits, with 100 TB of storage pooled across the
organization. It holds the roster, the bulletin files, the media backup copy, and the
preview APKs the Android PR workflow uploads. Those APKs accumulate over time, so
clear old ones out occasionally; this is housekeeping, not a cost risk. Exceeding an
API quota returns an error.

### Google Cloud (Play upload service account)

The [automatic Google Play upload](native-builds.md#automatic-store-uploads) signs in as
a service account in a Google Cloud project the church owns (`sda-church-app-play`).
**It costs nothing, and it can't start costing anything while the project has no
billing account.** That protection doesn't depend on Google's prices.

- **Nothing can be billed without a billing account.** In Google Cloud, a Cloud
  Billing account "defines who pays for a given set of Google Cloud resources"
  ([Cloud Billing concepts](https://docs.cloud.google.com/billing/docs/concepts)); it's
  where a payment method lives. The church's project isn't linked to one, so there's
  no one to charge.
- **Everything the project uses is free today.** The service account and the keyless
  sign-in (Workload Identity Federation, with Google's token exchange) are part of
  Identity and Access Management: "All use of Identity and Access Management API is
  free of charge" ([IAM pricing](https://cloud.google.com/iam/pricing)). The Google
  Play Developer API isn't a paid Google Cloud product: Google's
  [setup guide](https://developers.google.com/android-publisher/getting_started) and
  [quota page](https://developers.google.com/android-publisher/quotas) name no charge,
  only a limit of 3,000 queries per minute. One upload makes about ten requests,
  counting the sign-in.
- **If Google ever changed that,** the upload would fail with an error rather than
  bill anyone, because there's no billing account to bill. Uploads would go back to
  being made by hand in Play Console until the church decides what to do.

The rules that keep it free:

- **Never link a billing account to this project**, and never start a Google Cloud
  free trial: the trial asks for a card and creates a billing account. This is also a
  [governance rule](../architecture.md#google-cloud-free-only).
- **If any screen asks for billing to continue, stop.** Nothing in this setup needs
  it, so being asked means something changed.
- **Once a year**, with the [upkeep calendar](../architecture.md#upkeep-calendar), open
  the project's **Billing** page and confirm it has no billing account.

Checked 2026-09-28.

### Cloudflare

The domain is the **only recurring cost**: about $10 a year, paid through Cloudflare
Registrar, which can register up to 10 years at a time. The account has a card on
file for that, which is exactly why no usage-billed Cloudflare product may be added
to it ([#261](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/261)).
DNS itself is free.

### App stores

- **Apple:** the $99 annual developer fee is waived through nonprofit status, which
  must be resubmitted yearly. No payment method is on file, so a lapse removes the
  app; it doesn't charge the church.
- **Google Play:** the one-time $25 registration was paid. No recurring cost.
- Both are nonprofit organization accounts, so the app must stay free and never
  earn money through the stores: no paid app, in-app purchases, subscriptions, or
  ads. External donation links opened in the browser are fine. See
  [App stores](../architecture.md#app-stores).

## Link-only websites

These only open in the browser, so the app puts no load on them and they have no
cost: YouTube, Spotify, Zoom, AdventistGiving, zgaxr (Chinese hymnals), Hymns for
Worship, the Adventech and Alive in Jesus lesson readers, EGW Writings reading,
Project Gutenberg, the Chinese Union Mission 506 hymnal store pages, and the
conference and union sites. Their availability risks, such as zgaxr's, are covered
in [Architecture](../architecture.md#third-party-apis-and-websites).

## Known gaps

Found while writing this page and resolved in
[#264](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/264):

- **Sunrise-Sunset attribution and caching.** Fixed by no longer calling the API from
  the app: sunrise and sunset are calculated on the device. The printed Queens
  bulletin's Apps Script still uses the API; see [Sunrise-Sunset](#sunrise-sunset).
- **Chinese library catalog caching.** Fixed: the cover list is cached on the device
  and refreshed at most daily, keeping the cached copy if a refresh fails.
- **Audio Power absorbing every listener if Adventist Connect fails.** Fixed: the
  Internet Archive is now the second source and Audio Power the last. The slow
  native fallback is fixed too
  ([#262](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/262)).
- **The bulletin API's execution ceiling.** Accepted: caching keeps real traffic well
  under 1 request a second, against a ceiling of about 20. The dependency monitor
  checks the API daily, and a failed request now falls back to the last stored copy.
  Revisit if the app reaches thousands of simultaneous Sabbath-morning users.
