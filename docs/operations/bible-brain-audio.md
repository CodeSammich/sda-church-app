# Cantonese Bible audio (Bible Brain Worker)

Cantonese narration for the Chinese Union Version, from Faith Comes By Hearing (FCBH)
through its Bible Brain API (#241). It reaches the app through a small Cloudflare
Worker the church runs, which keeps FCBH's API key out of the app.

**Status:** built but **off**. The app ships with the feature turned off, and it stays
off until an IT administrator deploys the Worker and completes
[Before turning it on](#before-turning-it-on). The license terms it follows are in
[LEGAL.md](../LEGAL.md#bible-brain-api-license-faith-comes-by-hearing-planned-not-in-use).

## Contents

- [How it works](#how-it-works)
- [Cost](#cost)
- [Before turning it on](#before-turning-it-on)
- [Deploying the Worker](#deploying-the-worker)
- [Checking it works](#checking-it-works)
- [Turning it on in the app](#turning-it-on-in-the-app)
- [Turning it off](#turning-it-off)

## How it works

1. In the Bible, on the CUV or CUVS text, the narrator list gains
   **粵語 (Faith Comes By Hearing)** after the Mandarin narration, for chapters FCBH
   has recorded.
2. For each chapter the app plays a fixed address on the Worker,
   `…/v1/audio/<fileset>/<book>/<chapter>`. It can queue those ahead of time like any
   other recording.
3. When the player asks for a chapter, the Worker asks Bible Brain for that chapter's
   file, with the key attached, and redirects the player to the short-lived link Bible
   Brain returns. The audio itself streams straight from FCBH's servers; the Worker
   never downloads or stores it.
4. While Cantonese is the narrator, FCBH's copyright notice appears under the
   chapter, and the lock screen names Faith Comes By Hearing as the source.

What the Worker allows, in `cloudflare-workers/bible-brain-audio/src/index.js`:

| Rule | Why |
| --- | --- |
| Only `/v1/audio/…`, `/v1/copyright/…`, and `/v1/health` | FCBH's license forbids a "proxy distribution network"; nothing else of Bible Brain is reachable through it. |
| Only filesets in `ALLOWED_FILESETS` | The same; an empty list refuses everything. |
| Only real books and chapters | A request can't be bent into another Bible Brain endpoint. |
| `Cache-Control: no-store` on every answer | The license forbids caching FCBH content. |
| CORS headers only for `https://app.nyccsda.org` | Other websites can't use it from a browser. The app sends no `Origin` and needs none. |
| 60 requests a minute per address | So it can't serve as a relay. |
| The key only as an encrypted secret | The license forbids sharing it; it's never in the app, the repository, a response, or a log. |

The Mandarin narration still covers every chapter, which satisfies the license's
requirement for a fallback: FCBH can end the church's access at any time.

## Cost

The Worker must stay on Cloudflare's **Workers Free** plan. On Free, going over a
limit makes requests fail with Error 1027 until midnight UTC; nothing is ever billed
([Workers limits](https://developers.cloudflare.com/workers/platform/limits/#daily-requests)).
Charges exist only on Workers Paid, a subscription someone has to choose
([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)). The
church's Cloudflare account has a card on file for the domain, so never move this
Worker to Workers Paid (#261). [Why a free Worker can't bill](admin-runbook.md#why-a-free-worker-cant-bill)
explains this in full, including why Cloudflare keeps a free plan, and the
[yearly checkup](admin-runbook.md#yearly-checkup) re-checks it every January.
The church chose to run it in that account rather than a separate one: the card is
guarded as [The Cloudflare account and domain](admin-runbook.md#the-cloudflare-account-and-domain)
describes, with a capped card, an alert on every charge, and a yearly check that
billing lists only the domain.

Google Apps Script was also considered, since it can never bill. It can't redirect,
though, so the app would have to fetch and hold FCBH's expiring links ahead of time,
and it can't rate-limit callers or hide the key from the project's editors (#241).

| Workers Free limit | This Worker's use |
| --- | --- |
| 100,000 requests a day, then Error 1027 until midnight UTC | One request each time a Cantonese chapter starts, and occasionally a retry |
| 10 ms of CPU per request | About 1 ms. Time spent waiting for Bible Brain doesn't count. |
| 50 outgoing requests per request | 1 |
| Audio traffic | None: the audio comes from FCBH, not through Cloudflare |

A rough estimate: 50 people listening to 20 Cantonese chapters a day is 1,000
requests, 1% of the daily limit. Even 1,000 such listeners stay at 20%. If the limit
is ever reached, Cantonese chapters fail to start for the rest of the day, and the
Mandarin narration keeps working. The per-address limit caps how much any one phone,
or anyone misusing the address, can use.

A custom address such as `bible-audio.nyccsda.org` is free, because Cloudflare
already runs the domain's DNS. The `workers.dev` address works too.

Bible Brain itself is free for the church. FCBH doesn't publish a request limit, and
may throttle heavy use.

## Before turning it on

- [ ] **FCBH's answers.** The church asked FCBH whether a private, app-only proxy is
  acceptable under its proxy clause, and whether non-audio answers may be cached
  (#241). Wait for a yes to the first. The Worker caches nothing, so the second
  doesn't block this.
- [ ] **The exact recording.** Run the discovery script below with the key. Listings
  suggest FCBH's Cantonese audio is a dramatized New Testament of the *Cantonese
  Union Version*, whose wording may differ from the Mandarin CUV text on screen.
  Listen to a few chapters against the CUV text and decide whether that's acceptable,
  or whether the narrator needs a note.
- [ ] **FCBH's notice.** The discovery script prints each fileset's copyright text.
  Copy it exactly into the app (see [Turning it on in the app](#turning-it-on-in-the-app)).
- [ ] **Privacy.** Add Faith Comes By Hearing and the Worker to the providers in
  `public/privacy-policy.html` and the in-app privacy screen, with the same wording
  as the other audio hosts: they see a request's IP address, and the app sends no
  personal data. Update the architecture's third-party table and diagram
  (`docs/architecture.md`, `docs/diagrams/app-dependencies.mmd`).
- [ ] **Store listings.** Add Cantonese to the audio line in the descriptions, and
  remove it from [What not to claim](store-listing.md#what-not-to-claim).
- [ ] **Monitoring.** Add a `/v1/health` check and one sampled chapter redirect to
  `test/integration/external-dependencies.mjs`.
- [ ] **Old Testament listeners.** If FCBH has only the New Testament in Cantonese,
  don't let the narrator switch silently. Name it as New Testament only, and on an Old
  Testament chapter say that the Mandarin narration is playing instead. Today the app
  quietly plays Mandarin there and returns to Cantonese in the New Testament. The same
  display will serve other languages' partial recordings (#241).
- [ ] **Devices.** On a real iPhone and Android phone: pick the Cantonese narrator on
  a New Testament chapter, play across a chapter boundary, lock the screen, and check
  the notice under the chapter. On an Old Testament chapter, the Cantonese narrator
  shouldn't appear if that testament has no fileset.

## Deploying the Worker

From a computer with Node.js, in the repository:

```sh
cd cloudflare-workers/bible-brain-audio
npx wrangler@4 login                          # the church's Cloudflare account
npx wrangler@4 secret put BIBLE_BRAIN_KEY     # paste the key when asked
```

Then set `ALLOWED_FILESETS` in `wrangler.toml` to the filesets the app uses, and:

```sh
npx wrangler@4 deploy
```

Commit the `ALLOWED_FILESETS` change in a pull request, so the repository matches
what's deployed.

**Deploy from a computer, not through Cloudflare's GitHub integration** (Workers
Builds). The Worker rarely changes, and that integration would give a Cloudflare app
access to the church's GitHub organization and, by default, build other branches as
preview versions that can use the Worker's key.

- If the Cloudflare login has more than one account, set `CLOUDFLARE_ACCOUNT_ID` in
  the shell for the command. Don't write the account ID into `wrangler.toml`: the
  repository is public.
- If deploy rejects the `[[ratelimits]]` block on the Free plan, delete that block
  and deploy again. The Worker runs without it, relying on its allowlist.
- For a custom address, in the Cloudflare dashboard open the Worker → **Settings →
  Domains & Routes → Add → Custom domain**, and enter `bible-audio.nyccsda.org`.

The key goes only into the Worker's secret. Never put it in the repository, the app,
an issue, or a chat. If it may have leaked, ask FCBH for a new one and run
`secret put` again.

### Finding the fileset IDs

```sh
read -rs BIBLE_BRAIN_KEY && export BIBLE_BRAIN_KEY   # paste the key; it isn't shown or saved in history
node scripts/bible-brain-discover.cjs
unset BIBLE_BRAIN_KEY
```

It lists Bible Brain's Cantonese (`yue`) Bibles and their filesets. For each audio
fileset, it checks Matthew 1 and Genesis 1, says how long FCBH's links last, prints
the copyright notice, and ends with an `ALLOWED_FILESETS` line to copy. The Worker
gets a fresh link each time a chapter starts, so a link only has to outlast its
chapter. `--language cmn` does the same for Mandarin. It only reads from Bible Brain,
and never prints the key or a link.

## Checking it works

```sh
WORKER=https://bible-audio.nyccsda.org
curl -s "$WORKER/v1/health"                                 # {"ok":true}
curl -sI "$WORKER/v1/audio/<fileset>/MAT/1" | grep -iE '^(HTTP|location|cache-control)'
                                                            # 302, a Location, no-store
curl -s "$WORKER/v1/copyright/<fileset>"                    # FCBH's notice
curl -s -o /dev/null -w '%{http_code}\n' "$WORKER/v1/audio/ENGESVN2DA/MAT/1"   # 404
```

## Turning it on in the app

In `constants/ExternalLinks.ts`, fill in `BIBLE_BRAIN_AUDIO`:

- `baseUrl`: the Worker's address, such as `https://bible-audio.nyccsda.org`;
- `cantoneseFilesets`: the New Testament fileset, and the Old Testament one if FCBH
  has it (leave a testament empty if not);
- `cantoneseNotice`: FCBH's copyright text, exactly as the discovery script prints it.

That ships with the next release. Tests in `test/bible-audio-cantonese.test.ts` cover
the addresses, the narrator order, and the queue.

## Turning it off

- **In the app:** set `baseUrl` back to `''`. The Cantonese narrator disappears in
  the next release; saved choices fall back to the Mandarin narration.
- **At once, for every installed app:** empty `ALLOWED_FILESETS` and deploy, or
  delete the Worker. Cantonese chapters then fail to load; the Mandarin narration is
  unaffected.
- **If FCBH ends access:** do both, and delete the Worker's secret.
